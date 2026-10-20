import type { QueuedOperation, SyncResult } from '../../model/outbox';

/** La respuesta del lote (ADR 0028): la hora del servidor y un resultado por operacion, en el mismo orden. */
export interface SyncResponse {
  readonly serverTime: Date;
  readonly results: readonly SyncResult[];
}

/**
 * Puerto de salida: el lote de sincronizacion de la API (`POST /v1/sync`, ADR 0028). Cada operacion se manda con el cuerpo exacto
 * de su ruta individual. Todo fallo de la peticion entera es un `ApiError` con su clase (ADR 0009); lo que paso con cada operacion
 * esta en su resultado, y la respuesta que no es del contrato tambien es un `ApiError` pasajero.
 */
export interface SyncApi {
  send(operations: readonly QueuedOperation[]): Promise<SyncResponse>;
}
