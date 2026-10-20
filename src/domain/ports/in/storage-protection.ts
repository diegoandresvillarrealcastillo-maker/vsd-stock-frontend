import type { StorageProtection } from '../../model/storage-protection';

/** Lo que la interfaz sabe de si lo guardado en el dispositivo esta a salvo del borrado automatico (C3-07). */
export interface StorageProtectionStatus {
  current(): StorageProtection;
  subscribe(listener: (state: StorageProtection) => void): () => void;
  /** Pregunta si esta protegido y, si no, lo pide al navegador. Se puede llamar muchas veces. */
  ensure(): Promise<void>;
}
