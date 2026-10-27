import { contenedor, respiro } from '../clases';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';

/** Para quien es: tres negocios que se reconocen al leerlos, en un solo panel dividido por lineas finas. */
export function ParaQuien() {
  const { paraQuien, anclas } = contenido;
  return (
    <Seccion ancla={anclas.paraQuien} className={respiro}>
      <div className={contenedor}>
        <EncabezadoSeccion ancla={anclas.paraQuien} titulo={paraQuien.titulo} />
        <div className="mt-12 grid divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-surface-raised md:grid-cols-3 md:divide-x md:divide-y-0">
          {paraQuien.items.map((item) => (
            <article key={item.titulo} className="p-6 sm:p-8">
              <h3 className="font-display text-xl leading-snug font-bold text-balance">
                {item.titulo}
              </h3>
              <p className="mt-3 text-fg-muted">{item.texto}</p>
            </article>
          ))}
        </div>
      </div>
    </Seccion>
  );
}
