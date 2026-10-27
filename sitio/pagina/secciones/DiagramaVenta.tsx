import type { CSSProperties } from 'react';
import { Mascota } from '../../../src/presentation/assets/mascotas/Mascota';
import { contenido } from '../contenido';
import {
  resumenDeEnvio,
  rostroDeOri,
  ultimaVenta,
  type EstadoDeLaVenta,
} from '../diagrama/maquina';
import { TRAMOS_MS, VIAJE_MS } from '../diagrama/ritmo';
import { useVentaEnVivo, type Viaje } from '../diagrama/useVentaEnVivo';

const { diagrama } = contenido;

// Los cuatro puestos de la venta, en el orden en que la recorre: mostrador, cola de envio, servidor y libro. Se dibujan en
// zigzag (arriba de izquierda a derecha, abajo de derecha a izquierda) para que el enlace de internet, el unico que se puede
// cortar, quede solo, en vertical, entre la cola y el servidor.
const ANCHO = 190;
const ALTO = 96;
const PUESTOS = [
  { clave: 'mostrador', x: 10, y: 24, nombre: diagrama.nodos.mostrador },
  { clave: 'cola', x: 280, y: 24, nombre: diagrama.nodos.cola },
  { clave: 'servidor', x: 280, y: 220, nombre: diagrama.nodos.servidor },
  { clave: 'libro', x: 10, y: 220, nombre: diagrama.nodos.libro },
] as const;

// Por donde viaja una venta (las mismas lineas que las flechas): del mostrador a la cola, por el enlace hasta el servidor y del
// servidor al libro. Cada recorrido es una linea recta, asi que se anima solo con `transform`.
const DE_MOSTRADOR_A_COLA = { x: 202, y: 72, recorrido: 74 };
const POR_EL_ENLACE = { x: 375, y: 122, recorrido: 94 };
const DE_SERVIDOR_A_LIBRO = { x: 278, y: 268, recorrido: -74 };

/** Los datos que el CSS de la animacion lee: cuanto recorre y cuanto tarda (de `ritmo.ts`, que es el unico que manda). */
function medidas(recorrido: number, duracion: number, retraso = 0): CSSProperties {
  return {
    '--recorrido': `${String(recorrido)}px`,
    '--duracion': `${String(duracion)}ms`,
    '--retraso': `${String(retraso)}ms`,
  } as CSSProperties;
}

/** La bolita de una venta con su folio debajo, sobre una linea. */
function Bolita({ folio }: { readonly folio: string }) {
  return (
    <>
      <circle r="7" className="fill-accent" />
      <text y="26" textAnchor="middle" className="fill-fg-muted font-mono text-[12.5px]">
        {folio}
      </text>
    </>
  );
}

/** La venta que viaja: la animacion es de CSS (`.viaje`, solo `transform` y `opacity`) y empieza al aparecer. */
function VentaEnCamino({ viaje }: { readonly viaje: Viaje }) {
  const folio = viaje.folio.toString();
  if (viaje.evento === 'vender') {
    return (
      <g
        data-viaje="vender"
        transform={`translate(${DE_MOSTRADOR_A_COLA.x} ${DE_MOSTRADOR_A_COLA.y})`}
      >
        <g
          className="viaje viaje-horizontal"
          style={medidas(DE_MOSTRADOR_A_COLA.recorrido, VIAJE_MS.vender)}
        >
          <Bolita folio={folio} />
        </g>
      </g>
    );
  }
  return (
    <g data-viaje="enviar">
      <g transform={`translate(${POR_EL_ENLACE.x} ${POR_EL_ENLACE.y})`}>
        <g
          className="viaje viaje-vertical"
          style={medidas(POR_EL_ENLACE.recorrido, TRAMOS_MS.enlace)}
        >
          <Bolita folio={folio} />
        </g>
      </g>
      <g transform={`translate(${DE_SERVIDOR_A_LIBRO.x} ${DE_SERVIDOR_A_LIBRO.y})`}>
        <g
          className="viaje viaje-horizontal"
          style={medidas(DE_SERVIDOR_A_LIBRO.recorrido, TRAMOS_MS.libro, TRAMOS_MS.enlace)}
        >
          <Bolita folio={folio} />
        </g>
      </g>
    </g>
  );
}

/** El interruptor «Cortar internet»: encendido es red cortada. Es un boton con `role="switch"`, asi que el teclado ya lo maneja. */
function Interruptor({
  cortado,
  alternar,
}: {
  readonly cortado: boolean;
  readonly alternar: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={cortado}
      onClick={alternar}
      className="group inline-flex min-h-touch items-center gap-3 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-fg transition-colors duration-(--duration-base) hover:bg-surface-raised motion-reduce:transition-none"
    >
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full bg-skeleton transition-colors duration-(--duration-base) group-aria-checked:bg-accent motion-reduce:transition-none"
      >
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-surface shadow-sm transition-transform duration-(--duration-base) group-aria-checked:translate-x-5 motion-reduce:transition-none" />
      </span>
      {diagrama.interruptor}
    </button>
  );
}

/**
 * La pantalla del telefono del mostrador: la ficha de la conexion, lo que dice la aplicacion sobre el envio (con sus palabras, las
 * de `summarizeSync`), a Ori con la cara que le toca y la ultima venta con la nota de su comprobante.
 */
function Telefono({ estado }: { readonly estado: EstadoDeLaVenta }) {
  const resumen = resumenDeEnvio(estado);
  const venta = ultimaVenta(estado);
  const conectado = estado.conectado;
  return (
    <div
      role="group"
      aria-label={diagrama.telefono}
      className="mx-auto w-full max-w-xs rounded-[1.75rem] border-[6px] border-bisel bg-surface p-3 shadow-lg"
    >
      <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-12 rounded-full bg-skeleton" />
      <span
        role="status"
        data-conexion={conectado ? 'con' : 'sin'}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${
          conectado ? 'border-success text-success' : 'border-accent-text text-accent-text'
        }`}
      >
        <span aria-hidden="true" className="size-2 rounded-full bg-current" />
        {conectado ? diagrama.estados.conectado : diagrama.estados.sinConexion}
      </span>
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface-raised p-3">
        <Mascota
          personaje="ori"
          estado={rostroDeOri(estado)}
          tamano={64}
          inmediata
          className="shrink-0"
        />
        <div className="min-w-0">
          {/* Sin conexion, el titular del resumen dice lo mismo que la ficha: no se repite. */}
          {resumen.titular !== diagrama.estados.sinConexion && (
            <p className="font-semibold text-fg">{resumen.titular}</p>
          )}
          {resumen.detalle !== null && <p className="text-sm text-fg-muted">{resumen.detalle}</p>}
        </div>
      </div>
      {venta !== null && (
        <div className="mt-3 px-1">
          <p className="text-xs font-medium text-fg-muted">{diagrama.ultimaVenta}</p>
          <p className="mt-1 font-mono text-sm font-medium text-fg">{venta.folio.toString()}</p>
          <p className="mt-1 text-sm text-fg-muted">
            {venta.enviada ? diagrama.enviada : diagrama.guardada}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Como viaja una venta, dibujado y vivo (C4-L4): del mostrador a la cola de envio, de ahi por internet al servidor y al libro de
 * movimientos. El interruptor «Cortar internet» rompe el enlace y la venta se queda en la cola, en el equipo; al volver la red
 * la cola baja una venta tras otra. La logica es una maquina de estados aparte (`diagrama/maquina.ts`) y esto solo la dibuja.
 * Todo el texto sale de `contenido`. `id` es con lo que empiezan los `id` de las piezas del dibujo (titulo, descripcion y puntas de
 * flecha): el dibujo sale dos veces en la pagina (arriba y en la banda de la demo) y cada uno apunta a las suyas.
 */
export function DiagramaVenta({ id = 'diagrama' }: { readonly id?: string }) {
  const { estado, viaje, alternar, referir } = useVentaEnVivo(diagrama.folio);
  const conectado = estado.conectado;
  const enCola = estado.cola.length;
  return (
    <figure
      ref={referir}
      className="rounded-2xl border border-rule bg-surface-raised p-4 text-fg shadow-md sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <figcaption className="text-sm font-medium text-fg-muted">{diagrama.titulo}</figcaption>
        <Interruptor cortado={!conectado} alternar={alternar} />
      </div>
      <div className="mt-4">
        <Telefono estado={estado} />
      </div>
      <svg
        role="img"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-descripcion`}
        viewBox="0 0 480 340"
        className="mt-4 h-auto w-full font-sans"
      >
        <title id={`${id}-titulo`}>{diagrama.titulo}</title>
        <desc id={`${id}-descripcion`}>{diagrama.descripcion}</desc>
        <defs>
          <marker
            id={`${id}-flecha`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M1 1.5 8 5 1 8.5Z" className="fill-border" />
          </marker>
          <marker
            id={`${id}-flecha-acento`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M1 1.5 8 5 1 8.5Z" className="fill-accent" />
          </marker>
        </defs>

        <g fill="none" strokeWidth="2" strokeLinecap="round">
          <path d="M202 72H276" className="stroke-border" markerEnd={`url(#${id}-flecha)`} />
          <g data-enlace={conectado ? 'activo' : 'cortado'}>
            {conectado ? (
              <path
                d="M375 122V216"
                className="stroke-accent"
                strokeDasharray="2 7"
                markerEnd={`url(#${id}-flecha-acento)`}
              />
            ) : (
              <>
                <path d="M375 122V152" className="stroke-border" strokeDasharray="2 7" />
                <path d="M375 186V216" className="stroke-border" strokeDasharray="2 7" />
                <path
                  d="M368 162 382 176M382 162 368 176"
                  className="stroke-accent-text"
                  strokeWidth="2.5"
                />
              </>
            )}
          </g>
          <path d="M278 268H204" className="stroke-border" markerEnd={`url(#${id}-flecha)`} />
        </g>

        <circle
          cx="351"
          cy="169"
          r="4"
          className={conectado ? 'fill-success' : 'fill-accent-text'}
        />
        <text x="341" y="173" textAnchor="end" className="fill-fg text-[13.5px] font-semibold">
          {conectado ? diagrama.estados.conectado : diagrama.estados.sinConexion}
        </text>

        {PUESTOS.map((puesto, indice) => (
          <g key={puesto.clave} data-puesto={puesto.clave}>
            <rect
              x={puesto.x}
              y={puesto.y}
              width={ANCHO}
              height={ALTO}
              rx="16"
              className="fill-surface stroke-border"
              strokeWidth="1.5"
            />
            <circle cx={puesto.x + 30} cy={puesto.y + 30} r="13" className="fill-accent" />
            <text
              x={puesto.x + 30}
              y={puesto.y + 35}
              textAnchor="middle"
              className="fill-on-accent font-mono text-[13px] font-medium"
            >
              {String(indice + 1)}
            </text>
            <text
              x={puesto.x + 18}
              y={puesto.y + 76}
              className="fill-fg font-display text-[15.5px] font-bold"
            >
              {puesto.nombre}
            </text>
            {puesto.clave === 'cola' && enCola > 0 && (
              <text
                x={puesto.x + 54}
                y={puesto.y + 35}
                className="fill-accent-text font-mono text-[14px] font-bold"
              >
                {String(enCola)} {diagrama.porEnviar}
              </text>
            )}
            {puesto.clave === 'libro' &&
              estado.libro.slice(-2).map((folio, i) => (
                <text
                  key={folio.toString()}
                  data-folio=""
                  x={puesto.x + 54}
                  y={puesto.y + 28 + i * 16}
                  className="fill-fg-muted font-mono text-[12.5px]"
                >
                  {folio.toString()}
                </text>
              ))}
          </g>
        ))}

        {viaje !== null && <VentaEnCamino key={viaje.numero} viaje={viaje} />}
      </svg>
    </figure>
  );
}
