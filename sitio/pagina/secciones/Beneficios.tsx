import { contenedor, respiro } from '../clases';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';

/** Lo que cambia en el dia a dia del dueño: cuatro beneficios, cada uno con su titulo y una frase. Sin tarjetas: una linea los separa. */
export function Beneficios() {
  const { beneficios, anclas } = contenido;
  return (
    <Seccion ancla={anclas.beneficios} className={respiro}>
      <div className={contenedor}>
        <EncabezadoSeccion ancla={anclas.beneficios} titulo={beneficios.titulo} />
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {beneficios.items.map((beneficio) => (
            <article key={beneficio.id} className="border-t-2 border-primary pt-5">
              <h3 className="font-display text-xl leading-snug font-bold text-balance">
                {beneficio.titulo}
              </h3>
              <p className="mt-3 text-fg-muted">{beneficio.texto}</p>
            </article>
          ))}
        </div>
      </div>
    </Seccion>
  );
}
