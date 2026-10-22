import { ApiError } from '../../domain/model/api-error';
import { parseMe, type Me } from '../../domain/model/me';
import type { LoadMe } from '../../domain/ports/in/load-me';
import type { ApiGateway } from '../../domain/ports/out/api-gateway';

/** Caso de uso: «quien soy» (`GET /v1/me`, ADR 0022). Una persona sin negocio todavia recibe `membership: null`. */
export class LoadMeUseCase implements LoadMe {
  constructor(private readonly api: ApiGateway) {}

  async execute(): Promise<Me> {
    const response = await this.api.send<unknown>({ method: 'GET', path: '/v1/me' });
    const me = parseMe(response.body);
    if (me === null) {
      // Un 200 que no es el contrato no es nuestro servidor (un proxy, otra version): no se le cree.
      throw new ApiError({
        class: 'transient',
        status: response.status,
        problem: null,
        retryAfterMs: null,
      });
    }
    return me;
  }
}
