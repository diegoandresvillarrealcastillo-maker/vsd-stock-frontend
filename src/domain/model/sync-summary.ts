import type { ConnectionStatus } from './connection';
import { formatMoment, formatTime } from './moment';

/** Lo que hace falta saber del envio para decirlo. `SyncState` del motor lo cumple tal cual. */
export interface SyncFacts {
  readonly phase: 'idle' | 'sending' | 'waiting';
  readonly pending: number;
  readonly attention: number;
  readonly lastSyncedAt: Date | null;
  readonly sessionExpired: boolean;
  readonly nextTryAt: Date | null;
  readonly fault: { readonly status: number | null; readonly code: string | null } | null;
}

/** `ok`: nada que hacer. `info`: avanza solo. `warn`: alguien tiene que mirar o esperar. */
export type SyncTone = 'ok' | 'info' | 'warn';

/** Lo que la persona puede hacer ahi mismo: reintentar ya o entrar de nuevo. */
export type SyncAction = 'retry' | 'sign-in' | null;

export interface SyncSummary {
  readonly tone: SyncTone;
  readonly headline: string;
  readonly detail: string | null;
  readonly action: SyncAction;
}

const records = (count: number): string =>
  `${String(count)} ${count === 1 ? 'registro' : 'registros'}`;

/** «3 registros por enviar.» o nada si no hay ninguno. */
const waiting = (pending: number): string | null =>
  pending > 0 ? `${records(pending)} por enviar.` : null;

const join = (parts: readonly (string | null)[]): string | null => {
  const text = parts.filter((part) => part !== null).join(' ');
  return text === '' ? null : text;
};

/**
 * Lo que el dispositivo dice sobre lo que ha enviado y lo que no (ADR 0009: nada se pierde en silencio). Cada caso dice la
 * verdad completa: no afirma «en linea» si solo comprobo, ni «todo enviado» si hay algo guardado solo aqui. Va en orden de
 * lo que mas importa: la sesion caducada, lo que el servidor no acepto, el envio en curso, la falta de conexion, el envio que
 * fallo, lo que espera y, al final, que todo esta en orden.
 */
export function summarizeSync(connection: ConnectionStatus, state: SyncFacts): SyncSummary {
  const { pending, attention } = state;

  if (state.sessionExpired) {
    return {
      tone: 'warn',
      headline: 'Tu sesión caducó',
      detail: join([
        waiting(pending),
        pending > 0
          ? 'Entra de nuevo para seguir enviando. Los registros guardados no se pierden.'
          : 'Entra de nuevo para seguir enviando.',
      ]),
      action: 'sign-in',
    };
  }

  if (attention > 0) {
    return {
      tone: 'warn',
      headline: `${String(attention)} ${attention === 1 ? 'requiere' : 'requieren'} atención`,
      detail: join([
        attention === 1
          ? 'El servidor no la aceptó. Hay que revisarla.'
          : 'El servidor no las aceptó. Hay que revisarlas.',
        waiting(pending),
      ]),
      action: state.phase === 'waiting' ? 'retry' : null,
    };
  }

  if (state.phase === 'sending') {
    return { tone: 'info', headline: 'Enviando…', detail: waiting(pending), action: null };
  }

  if (pending > 0 && connection === 'offline') {
    return {
      tone: 'warn',
      headline: 'Sin conexión',
      detail: `${records(pending)} por enviar. ${pending === 1 ? 'Está guardado' : 'Están guardados'} solo en este equipo.`,
      action: null,
    };
  }

  if (pending > 0 && connection === 'checking') {
    return {
      tone: 'info',
      headline: 'Comprobando conexión…',
      detail: waiting(pending),
      action: null,
    };
  }

  if (state.phase === 'waiting') {
    return {
      tone: 'warn',
      headline: 'No se pudo enviar',
      detail: join([
        waiting(pending),
        state.fault === null
          ? null
          : `El servidor respondió ${state.fault.code ?? String(state.fault.status)}.`,
        state.nextTryAt === null
          ? null
          : // La hora en espanol ya termina en punto («3:30 p. m.»): no se le agrega otro.
            `Vamos a reintentar a las ${formatTime(state.nextTryAt)}`,
      ]),
      action: 'retry',
    };
  }

  if (pending > 0) {
    return { tone: 'info', headline: 'Por enviar', detail: waiting(pending), action: null };
  }

  if (state.lastSyncedAt !== null) {
    return {
      tone: 'ok',
      headline: 'Todo enviado',
      detail: `Última vez: ${formatMoment(state.lastSyncedAt)}`,
      action: null,
    };
  }

  return { tone: 'ok', headline: 'Nada por enviar', detail: null, action: null };
}
