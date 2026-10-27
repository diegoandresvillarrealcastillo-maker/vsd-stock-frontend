import { contenedor, respiro, tarjetaClara } from '../clases';
import { IconoCheck, IconoEquis } from '../componentes/Iconos';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';

interface ColumnaProps {
  readonly titulo: string;
  readonly items: readonly string[];
  /** La palabra que lee un lector de pantalla donde la vista ve la marca. */
  readonly marca: string;
  readonly hace: boolean;
}

function Columna({ titulo, items, marca, hace }: ColumnaProps) {
  return (
    <div className={tarjetaClara}>
      <h3 className="font-display text-xl font-bold">{titulo}</h3>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${hace ? 'bg-success/15 text-success' : 'bg-rule text-fg-muted'}`}
            >
              {hace ? <IconoCheck className="size-4" /> : <IconoEquis className="size-4" />}
            </span>
            <span className="sr-only">{`${marca}: `}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lo que VSD Stock hace por ti y lo que sigue como lo haces hoy, lado a lado: lo segundo evita que alguien espere lo que no hace. */
export function Incluye() {
  const { incluye, anclas } = contenido;
  return (
    <Seccion ancla={anclas.incluye} className={`${respiro} bg-surface-raised`}>
      <div className={contenedor}>
        <EncabezadoSeccion ancla={anclas.incluye} titulo={incluye.titulo} />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Columna
            titulo={incluye.columnaHace}
            items={incluye.hace}
            marca={incluye.marcas.hace}
            hace
          />
          <Columna
            titulo={incluye.columnaNoHace}
            items={incluye.noHace}
            marca={incluye.marcas.noHace}
            hace={false}
          />
        </div>
        <p className="mt-8 max-w-3xl text-fg-muted">{incluye.pie}</p>
      </div>
    </Seccion>
  );
}
