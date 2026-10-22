import { botonSobreNaranja, contenedor } from '../clases';
import { EnlaceExterno } from '../componentes/EnlaceExterno';
import { Seccion, idTitulo } from '../componentes/Seccion';
import { contenido } from '../contenido';

/** El cierre: la banda naranja con una sola peticion, escribir por WhatsApp, y la salida alternativa de mirar primero la demo. */
export function CtaFinal() {
  const { cta, anclas } = contenido;
  return (
    <Seccion ancla={anclas.piloto} className="banda-naranja bg-accent text-on-accent">
      <div className={`${contenedor} py-20 text-center md:py-24`}>
        <h2
          id={idTitulo(anclas.piloto)}
          className="mx-auto max-w-3xl font-display text-3xl font-extrabold tracking-tight text-balance sm:text-5xl"
        >
          {cta.titulo}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg">{cta.subtitulo}</p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <EnlaceExterno href={cta.boton.href} className={botonSobreNaranja}>
            {cta.boton.texto}
          </EnlaceExterno>
          <p className="text-sm font-medium">{cta.avisoBoton}</p>
          <EnlaceExterno
            href={cta.enlaceDemo.href}
            className="font-semibold underline underline-offset-4"
          >
            {cta.enlaceDemo.texto}
          </EnlaceExterno>
        </div>
      </div>
    </Seccion>
  );
}
