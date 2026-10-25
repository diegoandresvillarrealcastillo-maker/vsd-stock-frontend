import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface Pestana {
  /** Con esto se arman los `id` de la pestana y de su panel: sin espacios ni mayusculas. */
  readonly clave: string;
  readonly rotulo: string;
  readonly panel: ReactNode;
}

const pestanaBase =
  'inline-flex min-h-touch flex-1 items-center justify-center rounded-lg px-4 text-base font-semibold transition-colors duration-(--duration-base) sm:flex-none sm:px-6';

/**
 * Las pestanas de la banda de la demo, dibujadas para el fondo azul. Siguen el patron de pestanas de WAI-ARIA con activacion
 * manual: las flechas, Inicio y Fin mueven el foco, y Enter o la barra (un clic en el boton) eligen, porque elegir puede descargar
 * el contenido de la pestana y no debe pasar con cada flecha. Solo la elegida entra en el orden del teclado.
 *
 * El panel de una pestana se construye la primera vez que se elige y de ahi en adelante se queda en la pagina, escondido, para
 * que lo escrito en una demo no se pierda al mirar otra. Los paneles (los elementos con `role="tabpanel"`) estan todos desde el
 * principio, asi `aria-controls` siempre apunta a algo. Los `id` empiezan con el que da quien la pone: `useId` daria uno distinto en
 * el servidor y en el navegador.
 */
export function Pestanas({
  id,
  etiqueta,
  pestanas,
}: {
  readonly id: string;
  /** El nombre de la lista de pestanas para un lector de pantalla. */
  readonly etiqueta: string;
  readonly pestanas: readonly [Pestana, ...Pestana[]];
}) {
  const [elegida, setElegida] = useState(pestanas[0].clave);
  const [vistas, setVistas] = useState<readonly string[]>([pestanas[0].clave]);
  const botones = useRef(new Map<string, HTMLButtonElement>());

  function elegir(clave: string): void {
    setElegida(clave);
    setVistas((antes) => (antes.includes(clave) ? antes : [...antes, clave]));
  }

  function alPulsar(evento: KeyboardEvent, indice: number): void {
    const ultimo = pestanas.length - 1;
    const destino = {
      ArrowRight: indice === ultimo ? 0 : indice + 1,
      ArrowLeft: indice === 0 ? ultimo : indice - 1,
      Home: 0,
      End: ultimo,
    }[evento.key as 'ArrowRight' | 'ArrowLeft' | 'Home' | 'End'] as number | undefined;
    if (destino === undefined) return;
    evento.preventDefault();
    const clave = pestanas[destino]?.clave;
    if (clave !== undefined) botones.current.get(clave)?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={etiqueta}
        className="flex gap-1 rounded-xl border border-white/15 bg-white/5 p-1 sm:inline-flex"
      >
        {pestanas.map((pestana, indice) => {
          const estaElegida = pestana.clave === elegida;
          return (
            <button
              key={pestana.clave}
              ref={(boton) => {
                if (boton !== null) botones.current.set(pestana.clave, boton);
              }}
              type="button"
              role="tab"
              id={`${id}-pestana-${pestana.clave}`}
              aria-selected={estaElegida}
              aria-controls={`${id}-panel-${pestana.clave}`}
              tabIndex={estaElegida ? 0 : -1}
              onClick={() => {
                elegir(pestana.clave);
              }}
              onKeyDown={(evento) => {
                alPulsar(evento, indice);
              }}
              className={`${pestanaBase} ${
                estaElegida
                  ? 'bg-accent text-on-accent shadow-sm'
                  : 'text-on-band/80 hover:bg-white/10 hover:text-on-band'
              }`}
            >
              {pestana.rotulo}
            </button>
          );
        })}
      </div>
      {pestanas.map((pestana) => (
        <div
          key={pestana.clave}
          role="tabpanel"
          id={`${id}-panel-${pestana.clave}`}
          aria-labelledby={`${id}-pestana-${pestana.clave}`}
          hidden={pestana.clave !== elegida}
          className="mt-4"
        >
          {vistas.includes(pestana.clave) ? pestana.panel : null}
        </div>
      ))}
    </div>
  );
}
