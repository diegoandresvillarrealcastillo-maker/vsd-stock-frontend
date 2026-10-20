import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { LocalKeyLostError } from '../../domain/model/local-errors';
import type { Me } from '../../domain/model/me';
import type { ActiveWorkspace, LocalWorkspace } from '../../domain/ports/in/local-workspace';
import { useAccount } from '../auth/AuthProvider';

/**
 * Como va el almacenamiento de la persona que entro:
 * - `idle`: nadie ha entrado con negocio, no hay nada que preparar.
 * - `starting`: se abre su base cifrada.
 * - `ready`: lista.
 * - `lost-key`: la base tiene operaciones sin enviar pero la clave se perdio; hace falta que la persona decida (`pending`).
 * - `unavailable`: este navegador no puede guardar datos cifrados (sin IndexedDB, sin HTTPS, ventana privada).
 */
export type SetupState =
  | { readonly status: 'idle' }
  | { readonly status: 'starting' }
  | { readonly status: 'ready' }
  | { readonly status: 'lost-key'; readonly pending: number }
  | { readonly status: 'unavailable' };

/** El registro de este dispositivo con el servidor (ADR 0016): `failed` se puede reintentar. */
export type DeviceState = 'idle' | 'registering' | 'failed';

export interface LocalContext {
  readonly workspace: LocalWorkspace;
  /** Quien trabaja ahora en este dispositivo, con su base abierta, o `null`. */
  readonly active: ActiveWorkspace | null;
  readonly setup: SetupState;
  readonly device: DeviceState;
  /** Vuelve a pedir el codigo del dispositivo al servidor, tras un fallo. */
  readonly registerDevice: () => void;
  /** Tira lo guardado que no se puede leer y empieza con una base vacia. Solo tras confirmarlo la persona. */
  readonly discard: () => Promise<void>;
}

const LocalContext = createContext<LocalContext | null>(null);

type Outcome =
  | { readonly me: Me; readonly result: 'ready' | 'unavailable' }
  | { readonly me: Me; readonly result: 'lost-key'; readonly pending: number };

/**
 * Entrega a toda la interfaz el espacio de trabajo local de la persona (ADR 0018). Va dentro de la cuenta: cuando el servidor
 * confirma quien es la persona y donde trabaja, abre su base cifrada y registra el dispositivo; cuando la sesion se acaba por
 * cualquier causa, SUELTA la base y la conserva (cerrar sesion de forma explicita, que si la borra, lo decide la persona).
 */
export function LocalWorkspaceProvider({
  workspace,
  children,
}: {
  workspace: LocalWorkspace;
  children: ReactNode;
}) {
  const { state } = useAccount();
  const me = state.status === 'ready' && state.me.membership !== null ? state.me : null;

  const subscribe = useCallback(
    (onChange: () => void) => workspace.subscribe(onChange),
    [workspace],
  );
  const active = useSyncExternalStore(subscribe, () => workspace.current());

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [device, setDevice] = useState<DeviceState>('idle');

  const registerDevice = useCallback(() => {
    const code = workspace.current()?.deviceCode;
    if (code !== undefined && code !== null) return;
    setDevice('registering');
    workspace.registerDevice().then(
      () => {
        setDevice('idle');
      },
      () => {
        // Sin conexion, un servidor caido, un limite de uso: la persona puede reintentar, y vender sin red no empieza sin codigo.
        setDevice('failed');
      },
    );
  }, [workspace]);

  // La persona esta confirmada por el servidor: se abre su base y se registra el dispositivo.
  useEffect(() => {
    if (me === null) return;
    let cancelled = false;
    workspace.begin(me).then(
      () => {
        if (cancelled) return;
        setOutcome({ me, result: 'ready' });
        registerDevice();
      },
      (error: unknown) => {
        if (cancelled) return;
        setOutcome(
          error instanceof LocalKeyLostError
            ? { me, result: 'lost-key', pending: error.pending }
            : { me, result: 'unavailable' },
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [me, workspace, registerDevice]);

  // La sesion se acabo (la persona salio, caduco, el servidor la rechazo): su base se suelta, no se borra (ADR 0018, punto 8).
  // Quien esta sin sesion desde el principio y reanudo el mostrador sin conexion NO pasa por aqui: no vino de una sesion.
  const previous = useRef(state.status);
  useEffect(() => {
    if (previous.current !== 'signed-out' && state.status === 'signed-out') {
      void workspace.leave();
    }
    previous.current = state.status;
  }, [state.status, workspace]);

  const discard = useCallback(async () => {
    if (me === null) return;
    await workspace.discard(me);
    setOutcome({ me, result: 'ready' });
    registerDevice();
  }, [me, workspace, registerDevice]);

  const setup = useMemo<SetupState>(() => {
    if (me === null) return { status: 'idle' };
    if (outcome === null || outcome.me !== me) return { status: 'starting' };
    return outcome.result === 'lost-key'
      ? { status: 'lost-key', pending: outcome.pending }
      : { status: outcome.result };
  }, [me, outcome]);

  const value = useMemo<LocalContext>(
    () => ({ workspace, active, setup, device, registerDevice, discard }),
    [workspace, active, setup, device, registerDevice, discard],
  );

  return <LocalContext value={value}>{children}</LocalContext>;
}

/** El espacio de trabajo local. Solo funciona dentro de `LocalWorkspaceProvider`. */
export function useLocal(): LocalContext {
  const context = useContext(LocalContext);
  if (context === null) {
    throw new Error('useLocal debe usarse dentro de <LocalWorkspaceProvider>');
  }
  return context;
}
