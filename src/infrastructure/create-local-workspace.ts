import { ApiDeviceRegistry } from '../adapters/out/api/api-device-registry';
import { RandomIdGenerator } from '../adapters/out/ids/random-id-generator';
import { IdbLocalStores } from '../adapters/out/storage/idb-local-stores';
import { LocalStoragePersonPointer } from '../adapters/out/storage/local-storage-person-pointer';
import { LocalWorkspaceUseCase } from '../application/usecases/local-workspace.usecase';
import type { LocalWorkspace } from '../domain/ports/in/local-workspace';
import type { ApiGateway } from '../domain/ports/out/api-gateway';

interface Environment {
  /** La API con el token de la sesion puesto: de aqui sale el registro del dispositivo. */
  api: ApiGateway;
  now: () => Date;
  /** El almacenamiento local del navegador. Una funcion, porque con los datos del sitio bloqueados acceder a el ya lanza. */
  getStorage: () => Storage;
  /** La fuente de azar del navegador. */
  fillRandom: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
}

/**
 * Arma el espacio de trabajo local de la persona con los adaptadores del navegador (ADR 0002): una base cifrada de IndexedDB por
 * persona (ADR 0018), el puntero a quien trabajo por ultima vez y el registro de dispositivos de la API (ADR 0016).
 */
export function createLocalWorkspace(env: Environment): LocalWorkspace {
  return new LocalWorkspaceUseCase({
    stores: new IdbLocalStores(),
    pointer: new LocalStoragePersonPointer(env.getStorage),
    registry: new ApiDeviceRegistry(env.api),
    clock: { now: env.now },
    ids: new RandomIdGenerator(env.fillRandom),
  });
}
