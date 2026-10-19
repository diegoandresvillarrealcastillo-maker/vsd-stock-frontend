import { ApiError } from '../../../domain/model/api-error';
import { DeviceCode } from '../../../domain/model/device-code';
import type { ApiGateway } from '../../../domain/ports/out/api-gateway';
import type { DeviceRegistry, RegisteredDevice } from '../../../domain/ports/out/device-registry';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Lee la respuesta de `POST /v1/devices`. Devuelve `null` si no tiene la forma del contrato —tambien con un codigo que no es de
 * los que el servidor reparte— y NUNCA lanza: los datos de la red no son de fiar aunque el contrato diga lo contrario.
 */
function parseRegisteredDevice(body: unknown): RegisteredDevice | null {
  if (!isRecord(body)) return null;
  const { id, code } = body;
  if (typeof id !== 'string' || typeof code !== 'string') return null;
  try {
    return { id, code: DeviceCode.parse(code).value };
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

/** Registra el dispositivo en el servidor (`POST /v1/devices`, ADR 0016) por la API de la sesion. */
export class ApiDeviceRegistry implements DeviceRegistry {
  constructor(private readonly api: ApiGateway) {}

  async register(id: string): Promise<RegisteredDevice> {
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: '/v1/devices',
      body: { id },
    });
    const device = parseRegisteredDevice(response.body);
    if (device === null) {
      // Un 200 que no es el contrato no es nuestro servidor (un proxy, otra version): se trata como un fallo pasajero.
      throw new ApiError({
        class: 'transient',
        status: response.status,
        problem: null,
        retryAfterMs: null,
      });
    }
    return device;
  }
}
