import { CAPTURAS } from '../capturas';
import { contenedor, respiro, tarjeta } from '../clases';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido, type Destacada } from '../contenido';
import { MarcoDeCaptura } from './MarcoDeCaptura';
import { MiniaturaFuncion } from './MiniaturaFuncion';

/** Una captura mas alta que ancha es de un telefono; una mas ancha, de un computador. */
const aparatoDe = (captura: Destacada['captura']): 'telefono' | 'computador' =>
  CAPTURAS[captura].alto > CAPTURAS[captura].ancho ? 'telefono' : 'computador';

/** Una funcion grande: su texto a un lado y, al otro, la pantalla de la aplicacion donde se hace. Las filas se alternan. */
function FuncionDestacada({
  funcion,
  invertida,
}: {
  readonly funcion: Destacada;
  readonly invertida: boolean;
}) {
  const aparato = aparatoDe(funcion.captura);
  return (
    <article className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <div className={invertida ? 'lg:order-2' : undefined}>
        <h3 className="font-display text-2xl leading-snug font-bold text-balance">
          {funcion.titulo}
        </h3>
        <p className="mt-4 max-w-xl text-lg text-fg-muted">{funcion.texto}</p>
        {funcion.puntos.length > 0 && (
          <ul className="mt-5 max-w-xl space-y-2 border-l-4 border-accent pl-4 text-fg-muted">
            {funcion.puntos.map((punto) => (
              <li key={punto}>{punto}</li>
            ))}
          </ul>
        )}
      </div>
      <div className={aparato === 'telefono' ? 'mx-auto w-52 sm:w-56' : 'w-full'}>
        <MarcoDeCaptura id={funcion.captura} tipo={aparato} />
      </div>
    </article>
  );
}

/** Las funciones de VSD Stock: cuatro con la pantalla de la aplicacion y tres chicas que se explican solas. */
export function Funciones() {
  const { funciones, anclas } = contenido;
  return (
    <Seccion ancla={anclas.funciones} className={respiro}>
      <div className={contenedor}>
        <EncabezadoSeccion ancla={anclas.funciones} titulo={funciones.titulo} />
        <div className="mt-12 space-y-16 md:space-y-20">
          {funciones.destacadas.map((funcion, indice) => (
            <FuncionDestacada key={funcion.id} funcion={funcion} invertida={indice % 2 === 1} />
          ))}
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {funciones.tarjetas.map((funcion) => (
            <article key={funcion.id} className={`${tarjeta} flex flex-col`}>
              <div className="rounded-xl border border-rule bg-surface p-4">
                <MiniaturaFuncion tarjeta={funcion} />
              </div>
              <h3 className="mt-6 font-display text-xl font-bold text-balance">{funcion.titulo}</h3>
              <p className="mt-3 text-fg-muted">{funcion.texto}</p>
              {funcion.nota !== undefined && (
                <p className="mt-4 rounded-lg border-l-4 border-accent bg-surface px-3 py-2 text-sm text-fg-muted">
                  {funcion.nota}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </Seccion>
  );
}
