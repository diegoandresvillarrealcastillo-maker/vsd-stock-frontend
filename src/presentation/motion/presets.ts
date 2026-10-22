import type { TargetAndTransition, Variants } from 'framer-motion';
import { durations, eases } from './tokens';

// Variantes y gestos compartidos (ADR 0008). Reglas que se cumplen aqui y no en
// cada pantalla:
//  - solo se anima transform (x, y, scale, rotate) y opacity;
//  - con movimiento reducido, la entrada se vuelve un fundido y el resto, nada.
// Cada funcion recibe `reducedMotion` en vez de leer el navegador: asi se prueba
// sin montar nada, y el hook de use-motion.ts es lo unico que consulta la preferencia.

/** Cuantos pixeles sube un elemento al entrar. */
const RISE = 8;

/** Entrada y salida de un bloque de contenido. */
export function createReveal(reducedMotion: boolean): Variants {
  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { duration: durations.fast, ease: [...eases.standard] },
      },
      exit: { opacity: 0, transition: { duration: durations.fast, ease: [...eases.exit] } },
    };
  }
  return {
    hidden: { opacity: 0, y: RISE },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: durations.base, ease: [...eases.standard] },
    },
    exit: { opacity: 0, transition: { duration: durations.fast, ease: [...eases.exit] } },
  };
}

/** Pulso del skeleton: aparece y desaparece sin parar. Sin movimiento, se queda quieto. */
export function createPulse(reducedMotion: boolean): TargetAndTransition | undefined {
  if (reducedMotion) return undefined;
  return {
    opacity: [1, 0.5, 1],
    transition: { duration: durations.pulse, ease: 'easeInOut', repeat: Infinity },
  };
}

/** Gesto al presionar un boton. Sin movimiento, no hace nada. */
export function createTap(reducedMotion: boolean): TargetAndTransition | undefined {
  if (reducedMotion) return undefined;
  return { scale: 0.97 };
}

/**
 * Cambio de icono del boton de tema: el que sale se achica y gira, y el que
 * entra llega girando desde el otro lado. Sin movimiento, es un fundido.
 */
export function createIconSwap(reducedMotion: boolean): Variants {
  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: durations.fast, ease: [...eases.standard] } },
      exit: { opacity: 0, transition: { duration: durations.fast, ease: [...eases.exit] } },
    };
  }
  return {
    hidden: { opacity: 0, rotate: -90, scale: 0.6 },
    visible: {
      opacity: 1,
      rotate: 0,
      scale: 1,
      transition: { duration: durations.base, ease: [...eases.standard] },
    },
    exit: {
      opacity: 0,
      rotate: 90,
      scale: 0.6,
      transition: { duration: durations.fast, ease: [...eases.exit] },
    },
  };
}

/** Lo que espera cada hijo antes de entrar. Tres filas tardan 0,15 s en empezar: menos que `base`. */
const STAGGER = 0.05;

/**
 * Para una lista: el contenedor hace entrar a sus hijos uno tras otro. No anima
 * nada por si mismo; cada hijo usa su propia variante (por ejemplo `createReveal`).
 * Sin movimiento, todos entran a la vez.
 */
export function createStagger(reducedMotion: boolean): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: reducedMotion ? 0 : STAGGER } },
    exit: {},
  };
}
