import { HttpHealthApi } from '../adapters/out/api/http-health-api';
import { BrowserNetworkHints } from '../adapters/out/network/browser-network-hints';
import { TimeoutScheduler } from '../adapters/out/scheduler/timeout-scheduler';
import { ConnectionMonitorUseCase } from '../application/usecases/connection-monitor.usecase';
import type { ConnectionMonitor } from '../domain/ports/in/connection-monitor';

interface Environment {
  /** Direccion del servidor, o vacia si la API esta en el mismo origen. */
  apiBaseUrl: string;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  navigator: { readonly onLine: boolean };
  /** Donde el navegador avisa `online` y `offline` (la ventana). */
  events: EventTarget;
}

/**
 * Arma la vigilancia de la conexion con los adaptadores del navegador. Es parte
 * del cableado de `infrastructure/` (ADR 0002): aqui, y solo aqui, el caso de
 * uso conoce las APIs concretas que lo respaldan. Recibe el entorno para poder
 * probarse sin un navegador.
 */
export function createConnectionMonitor(env: Environment): ConnectionMonitor {
  return new ConnectionMonitorUseCase({
    health: new HttpHealthApi({ baseUrl: env.apiBaseUrl, fetch: env.fetch }),
    hints: new BrowserNetworkHints(env.navigator, env.events),
    scheduler: new TimeoutScheduler(),
  });
}
