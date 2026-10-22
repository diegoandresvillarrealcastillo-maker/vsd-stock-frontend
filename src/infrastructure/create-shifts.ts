import { RandomIdGenerator } from '../adapters/out/ids/random-id-generator';
import { ShiftsUseCase } from '../application/usecases/shifts.usecase';
import type { LocalWorkspace } from '../domain/ports/in/local-workspace';
import type { Shifts } from '../domain/ports/in/shifts';
import type { SyncEngine } from '../domain/ports/in/sync-engine';

interface Environment {
  /** El espacio de trabajo local: ahi se guarda, cifrado, el turno de quien trabaja junto con su operacion. */
  workspace: LocalWorkspace;
  /** Del motor de envio: se le avisa de lo que se puso en la cola y se mira si la cola se movio. */
  sync: Pick<SyncEngine, 'current' | 'subscribe' | 'queued' | 'clockOffsetMs'>;
  now: () => Date;
  /** La fuente de azar del navegador. */
  fillRandom: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
}

/**
 * Arma el turno de caja con los adaptadores del navegador (ADR 0002 y 0026): se guarda en la base cifrada de la persona, su
 * operacion va a la cola de envio y los identificadores nuevos salen del azar del navegador. Recibe el entorno para poder probarse
 * sin un navegador.
 */
export function createShifts(env: Environment): Shifts {
  return new ShiftsUseCase({
    workspace: env.workspace,
    clock: { now: env.now },
    ids: new RandomIdGenerator(env.fillRandom),
    sync: env.sync,
  });
}
