import { useEffect, useState } from 'react';
import type { Resumption } from '../../domain/ports/in/local-workspace';
import { useLocal } from './LocalWorkspaceProvider';

/**
 * Quien trabajo por ultima vez en este equipo y si su mostrador se puede reanudar sin conexion. `null` mientras se lee su
 * registro (una lectura de IndexedDB, que tarda unos milisegundos).
 */
export function useLastPerson(): Resumption | null {
  const { workspace } = useLocal();
  const [last, setLast] = useState<Resumption | null>(null);

  useEffect(() => {
    let cancelled = false;
    void workspace.lastPerson().then((found) => {
      if (!cancelled) setLast(found);
    });
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  return last;
}
