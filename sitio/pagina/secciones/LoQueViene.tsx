import { contenedor, respiro } from '../clases';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';

/**
 * Lo que falta, dicho sin adornos: cada cosa dice si ya esta decidida o si todavia esta pendiente, y no promete fechas. Las dos
 * etiquetas van sobre el fondo liso (`surface`): el verde sobre su propio tinte no llegaba a 4,5:1 en el tema claro.
 */
export function LoQueViene() {
  const { loQueViene, anclas } = contenido;
  return (
    <Seccion ancla={anclas.loQueViene} className={respiro}>
      <div className={contenedor}>
        <EncabezadoSeccion
          ancla={anclas.loQueViene}
          etiqueta={loQueViene.etiqueta}
          titulo={loQueViene.titulo}
        />
        <ul className="mt-12 max-w-3xl divide-y divide-rule rounded-2xl border border-rule bg-surface-raised">
          {loQueViene.items.map((item) => (
            <li
              key={item.texto}
              className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:gap-5"
            >
              <span
                className={`w-fit shrink-0 rounded-full border px-3 py-0.5 font-mono text-xs font-medium tracking-[0.12em] ${item.estado === 'DECIDIDO' ? 'border-success/40 bg-surface text-success' : 'border-rule bg-surface text-fg-muted'}`}
              >
                {item.estado}
              </span>
              <span>{item.texto}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-sm text-fg-muted">{loQueViene.pie}</p>
      </div>
    </Seccion>
  );
}
