import { contenedor, respiro } from '../clases';
import { IconoCheck, IconoEquis } from '../componentes/Iconos';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';

/**
 * Lo que vive un negocio sin VSD Stock y con el, lado a lado. Son dos listas, una por columna, y la fila de una corresponde a la de
 * la otra: la de «sin» va en gris y la de «con» en el azul de la marca, para que el ojo vaya de una a otra.
 */
export function AntesYDespues() {
  const { antesYDespues, anclas } = contenido;
  return (
    <Seccion ancla={anclas.antesYDespues} className={`${respiro} bg-surface-raised`}>
      <div className={contenedor}>
        <EncabezadoSeccion ancla={anclas.antesYDespues} titulo={antesYDespues.titulo} />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-rule bg-surface p-6 sm:p-8">
            <h3 className="font-display text-xl font-bold text-fg-muted">
              {antesYDespues.columnaAntes}
            </h3>
            <ul className="mt-6 space-y-5">
              {antesYDespues.filas.map((fila) => (
                <li key={fila.antes} className="flex gap-3 text-fg-muted">
                  <IconoEquis className="mt-1 size-5 shrink-0" />
                  <span>{fila.antes}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-primary p-6 text-on-primary sm:p-8">
            <h3 className="font-display text-xl font-bold">{antesYDespues.columnaDespues}</h3>
            <ul className="mt-6 space-y-5">
              {antesYDespues.filas.map((fila) => (
                <li key={fila.despues} className="flex gap-3">
                  <IconoCheck className="mt-1 size-5 shrink-0" />
                  <span>{fila.despues}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Seccion>
  );
}
