import { ApiSync } from '../adapters/out/api/api-sync';
import { WebLocksRunner, type LockManagerLike } from '../adapters/out/locks/web-locks-runner';
import { MathRandom } from '../adapters/out/random/math-random';
import { TimeoutScheduler } from '../adapters/out/scheduler/timeout-scheduler';
import { SyncEngineUseCase } from '../application/usecases/sync-engine.usecase';
import type { ConnectionMonitor } from '../domain/ports/in/connection-monitor';
import type { LocalWorkspace } from '../domain/ports/in/local-workspace';
import type { SyncEngine } from '../domain/ports/in/sync-engine';
import type { ApiGateway } from '../domain/ports/out/api-gateway';

interface Environment {
  /** La API con el token de la sesion puesto: de aqui sale el lote (`POST /v1/sync`). */
  api: ApiGateway;
  /** El espacio de trabajo local: de aqui sale la cola de quien trabaja. */
  workspace: LocalWorkspace;
  connection: ConnectionMonitor;
  /** Los candados del navegador (`navigator.locks`), o `undefined` en un navegador que no los tiene. */
  locks: LockManagerLike | undefined;
  now: () => Date;
}

/**
 * Arma el motor de sincronizacion con los adaptadores del navegador (ADR 0002 y 0028): el lote de la API, un candado entre
 * pestañas, el temporizador y el azar que reparte las esperas. Recibe el entorno para poder probarse sin un navegador.
 */
export function createSyncEngine(env: Environment): SyncEngine {
  return new SyncEngineUseCase({
    workspace: env.workspace,
    api: new ApiSync(env.api),
    connection: env.connection,
    runner: new WebLocksRunner(env.locks),
    scheduler: new TimeoutScheduler(),
    clock: { now: env.now },
    random: new MathRandom(),
  });
}
