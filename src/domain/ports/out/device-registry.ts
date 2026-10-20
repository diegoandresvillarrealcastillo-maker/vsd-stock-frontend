/** Lo que el servidor devuelve al registrar el dispositivo. */
export interface RegisteredDevice {
  readonly id: string;
  /** El codigo corto del dispositivo (`AA`). */
  readonly code: string;
}

/**
 * Puerto de salida: el registro de dispositivos del servidor (`POST /v1/devices`, ADR 0016). Necesita conexion. Es idempotente
 * por el identificador que el dispositivo se inventa: repetirlo devuelve el mismo dispositivo y no gasta otro codigo. Todo fallo
 * es un `ApiError`.
 */
export interface DeviceRegistry {
  register(id: string): Promise<RegisteredDevice>;
}
