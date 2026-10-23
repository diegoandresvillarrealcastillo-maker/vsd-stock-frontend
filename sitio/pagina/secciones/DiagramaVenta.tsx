import { contenido } from '../contenido';

const { diagrama } = contenido;

// Los cuatro puestos de la venta, en el orden en que la recorre: mostrador, cola de envio, servidor y libro. Se dibujan en
// zigzag (arriba de izquierda a derecha, abajo de derecha a izquierda) para que el enlace de internet, el unico que se puede
// cortar, quede solo, en vertical, entre la cola y el servidor.
const ANCHO = 190;
const ALTO = 96;
const PUESTOS = [
  { x: 10, y: 24, nombre: diagrama.nodos.mostrador },
  { x: 280, y: 24, nombre: diagrama.nodos.cola },
  { x: 280, y: 220, nombre: diagrama.nodos.servidor },
  { x: 10, y: 220, nombre: diagrama.nodos.libro },
] as const;

/**
 * Como viaja una venta, dibujado: del mostrador a la cola de envio, de ahi por internet al servidor y al libro de movimientos.
 * Es un dibujo fijo (C4-L3); el interruptor «Cortar internet» lo anima despues (C4-L4). Todo el texto sale de `contenido`.
 */
export function DiagramaVenta() {
  return (
    <figure className="rounded-2xl border border-rule bg-surface-raised p-4 shadow-md sm:p-6">
      <svg
        role="img"
        aria-labelledby="diagrama-titulo"
        aria-describedby="diagrama-descripcion"
        viewBox="0 0 480 340"
        className="h-auto w-full font-sans"
      >
        <title id="diagrama-titulo">{diagrama.titulo}</title>
        <desc id="diagrama-descripcion">{diagrama.descripcion}</desc>
        <defs>
          <marker
            id="diagrama-flecha"
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
            id="diagrama-flecha-acento"
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
          <path d="M202 72H276" className="stroke-border" markerEnd="url(#diagrama-flecha)" />
          <path
            d="M375 122V216"
            className="stroke-accent"
            strokeDasharray="2 7"
            markerEnd="url(#diagrama-flecha-acento)"
          />
          <path d="M278 268H204" className="stroke-border" markerEnd="url(#diagrama-flecha)" />
        </g>

        <circle cx="240" cy="72" r="7" className="fill-accent" />
        <text x="240" y="98" textAnchor="middle" className="fill-fg-muted font-mono text-[11px]">
          {diagrama.folio}
        </text>

        <circle cx="351" cy="169" r="4" className="fill-success" />
        <text x="341" y="173" textAnchor="end" className="fill-fg text-[12px] font-semibold">
          {diagrama.estados.conectado}
        </text>

        {PUESTOS.map((puesto, indice) => (
          <g key={puesto.nombre}>
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
              className="fill-fg font-display text-[14.5px] font-bold"
            >
              {puesto.nombre}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-3 font-mono text-xs font-medium uppercase tracking-[0.14em] text-fg-muted">
        {diagrama.titulo}
      </figcaption>
    </figure>
  );
}
