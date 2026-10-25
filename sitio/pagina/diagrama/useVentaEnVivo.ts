import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Folio } from '../../../src/domain/model/folio';
import { cortarInternet, estadoInicial, reducir, siguientePaso, volverLaRed } from './maquina';
import { PAUSA_MS, VIAJE_MS } from './ritmo';

/** Una venta que esta viajando por el dibujo. `numero` cambia en cada viaje: asi la animacion de cada uno empieza desde cero. */
export interface Viaje {
  readonly evento: 'vender' | 'enviar';
  readonly folio: Folio;
  readonly numero: number;
}

const MENOS_MOVIMIENTO = '(prefers-reduced-motion: reduce)';

function avisarCuandoCambie(avisar: () => void): () => void {
  const consulta = window.matchMedia(MENOS_MOVIMIENTO);
  consulta.addEventListener('change', avisar);
  return () => {
    consulta.removeEventListener('change', avisar);
  };
}

/** Si la persona pidio menos movimiento. El servidor no lo sabe: parte de `false` y el navegador lo corrige al montar. */
function useMenosMovimiento(): boolean {
  return useSyncExternalStore(
    avisarCuandoCambie,
    () => window.matchMedia(MENOS_MOVIMIENTO).matches,
    () => false,
  );
}

/** Si el navegador sabe decir que se ve en pantalla. El servidor no: parte de `false`. */
const sinSuscripcion = (): (() => void) => () => undefined;

function useSabeQueSeVe(): boolean {
  return useSyncExternalStore(
    sinSuscripcion,
    () => typeof IntersectionObserver !== 'undefined',
    () => false,
  );
}

/**
 * Pone en marcha la maquina de las ventas (`maquina.ts`): la hace avanzar sola, con el ritmo de `ritmo.ts`, mientras el dibujo se
 * ve en pantalla y nadie pidio menos movimiento. El interruptor llama a `alternar`.
 *
 * - **El primer dibujo es siempre el mismo:** el estado inicial, sin ningun viaje. El servidor y el navegador pintan lo mismo y
 *   nada se mueve hasta despues de montar.
 * - **Se pausa solo:** fuera de pantalla no hay ni un temporizador vivo, y al volver sigue donde se quedo.
 * - **Con menos movimiento nada se mueve solo:** el interruptor llega de una vez al resultado (varias ventas guardadas, o todo
 *   enviado) y no se dibuja ninguna venta viajando.
 * - **Un viaje en curso se cancela** si el estado cambia (el interruptor) o el dibujo deja de moverse: nunca queda una venta
 *   flotando ni se cuenta dos veces.
 */
export function useVentaEnVivo(primerFolio: string) {
  const [estado, setEstado] = useState(() => estadoInicial(primerFolio));
  const [viaje, setViaje] = useState<Viaje | null>(null);
  const [elemento, setElemento] = useState<Element | null>(null);
  const [enPantalla, setEnPantalla] = useState(false);
  const numero = useRef(0);
  const reducido = useMenosMovimiento();
  const sabe = useSabeQueSeVe();

  useEffect(() => {
    if (elemento === null || !sabe) return;
    const observador = new IntersectionObserver((cambios) => {
      const ultimo = cambios.at(-1);
      if (ultimo !== undefined) setEnPantalla(ultimo.isIntersecting);
    });
    observador.observe(elemento);
    return () => {
      observador.disconnect();
    };
  }, [elemento, sabe]);

  // Sin forma de saber si se ve, se mueve como si se viera: un dibujo quieto para siempre seria peor que uno que no se pausa.
  const animando = !reducido && (enPantalla || !sabe);

  useEffect(() => {
    if (!animando) return;
    const paso = siguientePaso(estado);
    if (paso === null) return;
    const { evento, folio } = paso;
    let llegada: ReturnType<typeof setTimeout> | undefined;
    const salida = setTimeout(() => {
      numero.current += 1;
      setViaje({ evento, folio, numero: numero.current });
      llegada = setTimeout(() => {
        setViaje(null);
        setEstado((actual) => reducir(actual, evento));
      }, VIAJE_MS[evento]);
    }, PAUSA_MS[evento]);
    return () => {
      clearTimeout(salida);
      clearTimeout(llegada);
      setViaje(null);
    };
  }, [animando, estado]);

  const alternar = useCallback(() => {
    setEstado((actual) => {
      if (reducido) return actual.conectado ? cortarInternet(actual) : volverLaRed(actual);
      return reducir(actual, actual.conectado ? 'cortar' : 'volver');
    });
  }, [reducido]);

  return { estado, viaje, alternar, referir: setElemento };
}
