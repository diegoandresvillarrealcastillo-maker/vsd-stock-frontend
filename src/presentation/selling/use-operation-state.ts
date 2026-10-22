import { useEffect, useState } from 'react';
import type { OperationState } from '../../domain/model/outbox';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { useSync } from '../sync/SyncProvider';

/**
 * Donde esta una operacion: esperando a enviarse, pidiendo atencion o, si ya no esta en la cola, aceptada por el servidor
 * (`null`). `undefined` mientras todavia no se miro. Se vuelve a mirar cuando el envio dice que algo se movio.
 */
export function useOperationState(operationId: string): OperationState | null | undefined {
  const { workspace } = useLocal();
  const { state: sync } = useSync();
  const [state, setState] = useState<OperationState | null | undefined>(undefined);
  const moved = `${String(sync.pending)}/${String(sync.attention)}/${String(sync.lastSyncedAt?.getTime() ?? 0)}`;

  useEffect(() => {
    let cancelled = false;
    // Se pide dentro de una promesa: si nadie trabaja, `shifts()` lanza y eso no debe romper la pantalla.
    void Promise.resolve()
      .then(() => workspace.shifts().operationState(operationId))
      .then(
        (found) => {
          if (!cancelled) setState(found);
        },
        // Nadie trabaja ya, o no se pudo leer: no se dice nada de la operacion en vez de decir algo que no se sabe.
        () => undefined,
      );
    return () => {
      cancelled = true;
    };
  }, [workspace, operationId, moved]);

  return state;
}
