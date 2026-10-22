import { RandomIdGenerator } from '../adapters/out/ids/random-id-generator';
import { SellingUseCase } from '../application/usecases/selling.usecase';
import type { LocalWorkspace } from '../domain/ports/in/local-workspace';
import type { ReadCopy } from '../domain/ports/in/read-copy';
import type { Selling } from '../domain/ports/in/selling';
import type { Shifts } from '../domain/ports/in/shifts';
import type { SyncEngine } from '../domain/ports/in/sync-engine';

interface Environment {
  /** El espacio de trabajo local: ahi se guarda, cifrada, la venta junto con el turno y su folio. */
  workspace: LocalWorkspace;
  /** Del motor de envio: se le avisa de lo que se puso en la cola y se le pregunta cuanto se adelanta el servidor. */
  sync: Pick<SyncEngine, 'queued' | 'clockOffsetMs'>;
  /** Del turno: se le pide releer sus totales tras cada venta. */
  shifts: Pick<Shifts, 'refresh'>;
  /** De la copia de lectura: se le descuenta lo vendido de la existencia. */
  copy: Pick<ReadCopy, 'sold'>;
  now: () => Date;
  /** La fuente de azar del navegador. */
  fillRandom: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
}

/**
 * Arma el punto de venta con los adaptadores del navegador (ADR 0002 y 0027): la venta se guarda en la base cifrada de la persona,
 * su operacion va a la cola de envio y los identificadores nuevos salen del azar del navegador. Recibe el entorno para poder
 * probarse sin un navegador.
 */
export function createSelling(env: Environment): Selling {
  return new SellingUseCase({
    workspace: env.workspace,
    clock: { now: env.now },
    ids: new RandomIdGenerator(env.fillRandom),
    sync: env.sync,
    shifts: env.shifts,
    copy: env.copy,
  });
}
