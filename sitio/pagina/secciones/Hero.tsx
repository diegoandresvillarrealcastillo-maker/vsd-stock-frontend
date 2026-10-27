import { botonPrimario, botonSecundario, contenedor } from '../clases';
import { EnlaceExterno } from '../componentes/EnlaceExterno';
import { IconoCheck } from '../componentes/Iconos';
import { Seccion, idTitulo } from '../componentes/Seccion';
import { contenido } from '../contenido';
import { MarcoDeCaptura } from './MarcoDeCaptura';

/**
 * Lo primero que se ve: lo que VSD Stock hace por el negocio, los dos caminos (pedir el acceso o hablar con un asesor) y la aplicacion
 * de verdad, con la venta en el telefono del cajero y las existencias en el computador del dueño.
 */
export function Hero() {
  const { hero, anclas } = contenido;
  return (
    <Seccion ancla={anclas.inicio} className="bg-surface-raised">
      <div
        className={`${contenedor} grid items-center gap-12 py-12 md:py-16 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-20`}
      >
        <div>
          <h1
            id={idTitulo(anclas.inicio)}
            className="font-display text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]"
          >
            {hero.titulo}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-fg-muted">{hero.subtitulo}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <EnlaceExterno href={hero.ctaPrincipal.href} className={botonPrimario}>
              {hero.ctaPrincipal.texto}
            </EnlaceExterno>
            <EnlaceExterno href={hero.ctaSecundario.href} className={botonSecundario}>
              {hero.ctaSecundario.texto}
            </EnlaceExterno>
          </div>
          <p className="mt-4 text-sm text-fg-muted">{hero.nota}</p>
          <ul className="mt-8 space-y-2">
            {hero.puntos.map((punto) => (
              <li key={punto} className="flex items-center gap-2 font-medium">
                <IconoCheck className="size-5 shrink-0 text-success" />
                {punto}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mx-auto w-full max-w-xl pb-12 lg:max-w-none">
          <div className="ml-auto w-[90%]">
            <MarcoDeCaptura id="existencias" tipo="computador" prioritaria />
          </div>
          <div className="absolute bottom-0 left-0 w-[24%] min-w-24">
            <MarcoDeCaptura id="vender" tipo="telefono" prioritaria />
          </div>
        </div>
      </div>
    </Seccion>
  );
}
