import { botonPrimario, botonSecundario, contenedor, etiqueta } from '../clases';
import { EnlaceExterno } from '../componentes/EnlaceExterno';
import { IconoCheck, IconoFlecha } from '../componentes/Iconos';
import { Seccion, idTitulo } from '../componentes/Seccion';
import { contenido } from '../contenido';
import { DiagramaVenta } from './DiagramaVenta';

/** Lo primero que se ve: lo que hace VSD Stock, a donde ir si quieres probarlo, y el dibujo de como viaja una venta. */
export function Hero() {
  const { hero, anclas } = contenido;
  return (
    <Seccion ancla={anclas.inicio} className="relative overflow-hidden">
      <div aria-hidden="true" className="cuadricula absolute inset-0" />
      <div aria-hidden="true" className="resplandor absolute inset-0" />
      <div
        className={`${contenedor} relative grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24`}
      >
        <div>
          <p className={`${etiqueta} text-accent-text`}>{hero.etiqueta}</p>
          <h1
            id={idTitulo(anclas.inicio)}
            className="mt-5 font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            {`${hero.titulo.antes} `}
            <mark className="marca">{hero.titulo.marca}</mark>
            {hero.titulo.despues}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-fg-muted">{hero.subtitulo}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <EnlaceExterno href={hero.ctaPrincipal.href} className={botonPrimario}>
              {hero.ctaPrincipal.texto}
            </EnlaceExterno>
            <EnlaceExterno href={hero.ctaSecundario.href} className={botonSecundario}>
              {hero.ctaSecundario.texto}
              <IconoFlecha className="size-4" />
            </EnlaceExterno>
          </div>
          <p className="mt-4 text-sm text-fg-muted">{hero.nota}</p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {hero.sellos.map((sello) => (
              <li
                key={sello}
                className="inline-flex items-center gap-2 rounded-full border border-rule bg-surface-raised px-3 py-1.5 text-sm font-medium"
              >
                <IconoCheck className="size-4 text-success" />
                {sello}
              </li>
            ))}
          </ul>
        </div>
        <DiagramaVenta />
      </div>
    </Seccion>
  );
}
