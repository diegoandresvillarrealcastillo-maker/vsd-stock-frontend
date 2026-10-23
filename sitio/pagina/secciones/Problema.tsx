import { contenedor, etiqueta, respiro, tarjeta } from '../clases';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';

/** El problema, en cuatro escenas que cualquier tendero reconoce. */
export function Problema() {
  const { problema, anclas } = contenido;
  return (
    <Seccion ancla={anclas.problema} className={respiro}>
      <div className={contenedor}>
        <EncabezadoSeccion
          ancla={anclas.problema}
          etiqueta={problema.etiqueta}
          titulo={problema.titulo}
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {problema.tarjetas.map((escena) => (
            <article key={escena.etiqueta} className={tarjeta}>
              <p className={`${etiqueta} text-accent-text`}>{escena.etiqueta}</p>
              <h3 className="mt-4 font-display text-lg leading-snug font-bold text-balance">
                {escena.titulo}
              </h3>
              <p className="mt-3 text-fg-muted">{escena.texto}</p>
            </article>
          ))}
        </div>
      </div>
    </Seccion>
  );
}
