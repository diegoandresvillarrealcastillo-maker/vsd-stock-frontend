import { formatMoment } from './moment';

/** Lo que hace falta saber de la copia para decirlo. `CopyState` de la copia de lectura lo cumple tal cual. */
export interface CopyFacts {
  readonly status: 'empty' | 'ready';
  readonly productCount: number;
  readonly productsAsOf: Date | null;
  readonly stockAsOf: Date | null;
  readonly downloading: boolean;
  readonly fault: 'network' | 'session' | 'other' | null;
}

export interface CopySummary {
  readonly tone: 'ok' | 'info' | 'warn';
  readonly headline: string;
  readonly detail: string | null;
  /** Si tiene sentido ofrecer «Actualizar»: no mientras baja ni cuando lo que falta es entrar de nuevo. */
  readonly canRefresh: boolean;
}

/**
 * Lo que el dispositivo dice del catalogo que guarda para vender sin conexion (C3-10). Dice siempre DE CUANDO es lo que tiene:
 * nada de esto es la verdad de hoy en todas las cajas. Un fallo no borra lo que ya habia: se dice que se sigue con esa copia.
 * La hora en espanol ya termina en punto («3:30 p. m.»): no se le agrega otro.
 */
export function summarizeCopy(state: CopyFacts): CopySummary {
  const have = state.status === 'ready' && state.productsAsOf !== null;
  const since = state.productsAsOf === null ? '' : formatMoment(state.productsAsOf);

  if (state.downloading) {
    return {
      tone: 'info',
      headline: have ? 'Actualizando el catálogo…' : 'Descargando el catálogo…',
      detail: have ? `${count(state.productCount)}, del ${since}` : null,
      canRefresh: false,
    };
  }

  if (state.fault === 'session') {
    return {
      tone: 'warn',
      headline: 'Tu sesión caducó',
      detail: have
        ? `Sigues con el catálogo del ${since} Entra de nuevo para actualizarlo.`
        : 'Todavía no hay catálogo en este equipo. Entra de nuevo para descargarlo.',
      canRefresh: false,
    };
  }

  if (state.fault === 'network') {
    return have
      ? {
          tone: 'warn',
          headline: 'No se pudo actualizar: sin conexión',
          detail: `Sigues con el catálogo del ${since}`,
          canRefresh: true,
        }
      : {
          tone: 'warn',
          headline: 'Sin conexión y sin catálogo en este equipo',
          detail: 'Conéctate para descargarlo: sin él no se puede vender sin conexión.',
          canRefresh: true,
        };
  }

  if (state.fault === 'other') {
    return have
      ? {
          tone: 'warn',
          headline: 'No se pudo actualizar el catálogo',
          detail: `Sigues con el del ${since} Inténtalo de nuevo.`,
          canRefresh: true,
        }
      : {
          tone: 'warn',
          headline: 'No se pudo descargar el catálogo',
          detail: 'Todavía no hay catálogo en este equipo. Inténtalo de nuevo.',
          canRefresh: true,
        };
  }

  if (!have) {
    return {
      tone: 'info',
      headline: 'Todavía no hay catálogo en este equipo',
      detail: 'Se descarga solo cuando hay conexión. Sin él no se puede vender sin conexión.',
      canRefresh: true,
    };
  }

  return {
    tone: 'ok',
    headline: `${count(state.productCount)} en este equipo`,
    detail:
      state.stockAsOf === null
        ? `Catálogo al ${since} Las existencias todavía no se bajaron.`
        : `Catálogo al ${since} Existencias al ${formatMoment(state.stockAsOf)}`,
    canRefresh: true,
  };
}

/** «1 producto» o «120 productos». */
function count(products: number): string {
  return `${String(products)} ${products === 1 ? 'producto' : 'productos'}`;
}
