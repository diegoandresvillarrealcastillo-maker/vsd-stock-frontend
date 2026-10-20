import { LocalWorkspaceUseCase } from '../../src/application/usecases/local-workspace.usecase';
import type { LocalProfile } from '../../src/domain/model/local-profile';
import type { LocalWorkspace } from '../../src/domain/ports/in/local-workspace';
import { FakeDeviceRegistry, FakeLocalStores, MemoryPointer, SequentialIds } from './fake-local';

/**
 * El espacio de trabajo local para las pruebas de la interfaz. El caso de uso es el REAL; solo se sustituye lo que hay detras:
 * las bases (en memoria), el puntero a la ultima persona, el registro de dispositivos del servidor y el reloj.
 */
export interface TestLocal {
  readonly workspace: LocalWorkspace;
  readonly stores: FakeLocalStores;
  readonly pointer: MemoryPointer;
  readonly registry: FakeDeviceRegistry;
  /** Mueve el reloj del dispositivo. */
  setNow(now: Date): void;
}

export function createTestLocal(now: Date = new Date('2026-10-17T12:00:00.000Z')): TestLocal {
  let current = now;
  const stores = new FakeLocalStores();
  const pointer = new MemoryPointer();
  const registry = new FakeDeviceRegistry();
  const workspace = new LocalWorkspaceUseCase({
    stores,
    pointer,
    registry,
    clock: { now: () => current },
    ids: new SequentialIds(),
  });
  return {
    workspace,
    stores,
    pointer,
    registry,
    setNow: (next) => {
      current = next;
    },
  };
}

/** Deja a una persona ya conocida en este dispositivo, como si hubiera entrado antes: su registro y a quien recuerda el puntero. */
export function rememberPerson(local: TestLocal, profile: LocalProfile): void {
  local.stores.dataOf(profile.authUserId).profile = profile;
  local.pointer.set(profile.authUserId);
}
