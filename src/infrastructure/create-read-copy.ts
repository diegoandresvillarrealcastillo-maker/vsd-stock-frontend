import { ApiReadCopy } from '../adapters/out/api/api-read-copy';
import { ReadCopyUseCase } from '../application/usecases/read-copy.usecase';
import type { ConnectionMonitor } from '../domain/ports/in/connection-monitor';
import type { LocalWorkspace } from '../domain/ports/in/local-workspace';
import type { ReadCopy } from '../domain/ports/in/read-copy';
import type { SyncEngine } from '../domain/ports/in/sync-engine';
import type { ApiGateway } from '../domain/ports/out/api-gateway';

interface Environment {
  /** La API con el token de la sesion puesto: de aqui salen `GET /v1/sync/products` y `/stock`. */
  api: ApiGateway;
  /** El espacio de trabajo local: ahi se guarda la copia, cifrada, de quien trabaja. */
  workspace: LocalWorkspace;
  connection: ConnectionMonitor;
  /** Del motor de envio solo se mira cuando el servidor acepto algo: la existencia se movio. */
  sync: Pick<SyncEngine, 'current' | 'subscribe'>;
}

/**
 * Arma la copia de lectura del catalogo y de la existencia con la API de la sesion (ADR 0002 y 0028). Recibe el entorno para
 * poder probarse sin un navegador.
 */
export function createReadCopy(env: Environment): ReadCopy {
  return new ReadCopyUseCase({
    workspace: env.workspace,
    api: new ApiReadCopy(env.api),
    connection: env.connection,
    sync: env.sync,
  });
}
