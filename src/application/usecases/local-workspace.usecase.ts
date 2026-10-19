import { DeviceCode } from '../../domain/model/device-code';
import { Folio } from '../../domain/model/folio';
import {
  CounterLockedError,
  DeviceNotRegisteredError,
  NoWorkspaceError,
} from '../../domain/model/local-errors';
import { counterAccess, profileOf } from '../../domain/model/local-profile';
import type { Me } from '../../domain/model/me';
import type {
  ActiveWorkspace,
  LocalWorkspace,
  Resumption,
} from '../../domain/ports/in/local-workspace';
import type { Clock } from '../../domain/ports/out/clock';
import type { DeviceRegistry } from '../../domain/ports/out/device-registry';
import type { IdGenerator } from '../../domain/ports/out/id-generator';
import type { LocalStore, LocalStores } from '../../domain/ports/out/local-store';
import type { PersonPointer } from '../../domain/ports/out/person-pointer';

interface Dependencies {
  readonly stores: LocalStores;
  readonly pointer: PersonPointer;
  readonly registry: DeviceRegistry;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/** El espacio abierto: la base de la persona y lo que la interfaz ve de ella. */
interface Open {
  readonly store: LocalStore;
  readonly value: ActiveWorkspace;
}

/**
 * Caso de uso: el espacio de trabajo local de la persona que usa este dispositivo (ADR 0018, 0022 y 0016). Una base cifrada por
 * persona; entrar con conexion anota que el servidor la confirmo ahora; sin conexion el mostrador se reanuda con ese registro
 * hasta setenta y dos horas despues; cambiar de persona conserva lo guardado y cerrar sesion lo olvida; y reparte el folio de
 * cada venta con la serie del dispositivo.
 */
export class LocalWorkspaceUseCase implements LocalWorkspace {
  private readonly stores: LocalStores;
  private readonly pointer: PersonPointer;
  private readonly registry: DeviceRegistry;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private open: Open | null = null;
  private readonly listeners = new Set<() => void>();

  constructor({ stores, pointer, registry, clock, ids }: Dependencies) {
    this.stores = stores;
    this.pointer = pointer;
    this.registry = registry;
    this.clock = clock;
    this.ids = ids;
  }

  current(): ActiveWorkspace | null {
    return this.open?.value ?? null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async lastPerson(): Promise<Resumption> {
    const authUserId = this.pointer.get();
    if (authUserId === null) return { state: 'none' };
    let store: LocalStore;
    try {
      store = await this.stores.open(authUserId);
    } catch {
      // Una base que no se abre (el navegador no deja, la clave se perdio) no es alguien a quien ofrecer «continuar».
      return { state: 'none' };
    }
    try {
      const profile = await store.readProfile();
      if (profile === null) return { state: 'none' };
      return { state: 'available', profile, access: counterAccess(profile, this.clock.now()) };
    } finally {
      store.close();
    }
  }

  async begin(me: Me): Promise<void> {
    const profile = profileOf(me, this.clock.now());
    if (profile === null) return;
    const store = await this.stores.open(profile.authUserId);
    try {
      await store.writeProfile(profile);
      const device = await store.readDevice();
      this.replace({ store, value: { profile, deviceCode: device?.code ?? null, resumed: false } });
    } catch (error) {
      store.close();
      throw error;
    }
    this.pointer.set(profile.authUserId);
  }

  async discard(me: Me): Promise<void> {
    // La base de otra persona no se toca, y si esta persona estaba abierta se suelta antes de borrarla.
    if (this.open?.value.profile.authUserId === me.identity.id) this.replace(null);
    await this.stores.forget(me.identity.id);
    await this.begin(me);
  }

  async resume(): Promise<void> {
    const authUserId = this.pointer.get();
    if (authUserId === null) throw new NoWorkspaceError();
    const store = await this.stores.open(authUserId);
    try {
      const profile = await store.readProfile();
      if (profile === null) throw new NoWorkspaceError();
      const access = counterAccess(profile, this.clock.now());
      if (access.state === 'locked') throw new CounterLockedError(access.reason);
      const device = await store.readDevice();
      this.replace({ store, value: { profile, deviceCode: device?.code ?? null, resumed: true } });
    } catch (error) {
      store.close();
      throw error;
    }
  }

  async registerDevice(): Promise<void> {
    const active = this.requireOpen();
    // El identificador se guarda ANTES de preguntar: si la respuesta se pierde, se repite con el mismo y el servidor devuelve el
    // mismo dispositivo. `claimDevice` decide con quien llega primero (un intento anterior o la otra pestaña): el candidato solo
    // vale si no habia ninguno, y entonces todas terminan con el mismo.
    const claimed = await active.store.claimDevice({ id: this.ids.newId(), code: null });
    if (claimed.code !== null) return this.knowCode(active, claimed.code);

    const registered = await this.registry.register(claimed.id);
    if (registered.id !== claimed.id) {
      throw new Error('The server registered another device than the one that was asked for');
    }
    const code = DeviceCode.parse(registered.code).value;
    // Si la persona cambio mientras tanto, su base ya esta cerrada: el codigo se pedira de nuevo con el mismo identificador.
    if (this.open?.store !== active.store) return;
    await active.store.completeDevice({ id: claimed.id, code });
    this.knowCode(active, code);
  }

  async nextFolio(): Promise<string> {
    const active = this.requireOpen();
    const code = active.value.deviceCode;
    if (code === null) throw new DeviceNotRegisteredError();
    const serial = await active.store.reserveSerial();
    return Folio.of(DeviceCode.parse(code), serial).toString();
  }

  async pendingCount(): Promise<number> {
    const { store } = this.requireOpen();
    return await store.countPending();
  }

  leave(): Promise<void> {
    this.replace(null);
    return Promise.resolve();
  }

  async forget(): Promise<void> {
    const active = this.open;
    if (active === null) return;
    // Cerrar primero: una base con una conexion abierta no se deja borrar.
    this.replace(null);
    await this.stores.forget(active.value.profile.authUserId);
    this.pointer.clear();
  }

  private requireOpen(): Open {
    if (this.open === null) throw new NoWorkspaceError();
    return this.open;
  }

  /** Pone el codigo del dispositivo en el espacio abierto, si sigue siendo el mismo, y avisa. */
  private knowCode(active: Open, code: string): void {
    const current = this.open;
    if (current?.store !== active.store || current.value.deviceCode === code) return;
    this.open = { store: current.store, value: { ...current.value, deviceCode: code } };
    this.notify();
  }

  /** Cambia el espacio abierto: suelta la base anterior (sin olvidarla) y avisa. */
  private replace(next: Open | null): void {
    const previous = this.open;
    this.open = next;
    if (previous !== null) previous.store.close();
    this.notify();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
