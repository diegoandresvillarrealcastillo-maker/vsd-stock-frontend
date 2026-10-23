import { botonPrimario, contenedor, respiro } from '../clases';
import { EnlaceExterno } from '../componentes/EnlaceExterno';
import { IconoFlecha } from '../componentes/Iconos';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';

/** La banda azul de la demo: tres cifras que se pueden comprobar y el boton que abre la demo de pruebas. */
export function Demo() {
  const { demo, anclas } = contenido;
  return (
    <Seccion ancla={anclas.demo} className={`banda bg-band text-on-band ${respiro}`}>
      <div className={contenedor}>
        <EncabezadoSeccion
          ancla={anclas.demo}
          etiqueta={demo.etiqueta}
          titulo={demo.titulo}
          sobreBanda
        />
        <dl className="mt-12 grid gap-4 md:grid-cols-3">
          {demo.cifras.map((cifra) => (
            <div key={cifra.valor} className="rounded-2xl border border-white/15 bg-white/5 p-6">
              <dt className="font-display text-4xl font-extrabold tracking-tight text-accent">
                {cifra.valor}
              </dt>
              <dd className="mt-2 text-on-band/80">{cifra.texto}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          <EnlaceExterno href={demo.boton.href} className={botonPrimario}>
            {demo.boton.texto}
            <IconoFlecha className="size-4" />
          </EnlaceExterno>
          <p className="max-w-md text-sm text-on-band/80">{demo.nota}</p>
        </div>
      </div>
    </Seccion>
  );
}
