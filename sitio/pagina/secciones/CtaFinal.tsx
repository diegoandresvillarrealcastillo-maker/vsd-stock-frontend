import { botonContornoSobreNaranja, botonSobreNaranja, contenedor } from '../clases';
import { EnlaceExterno } from '../componentes/EnlaceExterno';
import { Seccion, idTitulo } from '../componentes/Seccion';
import { contenido } from '../contenido';

/** El cierre: la banda naranja con los dos caminos de siempre, pedir el acceso o hablar con un asesor por WhatsApp. */
export function CtaFinal() {
  const { cta, anclas } = contenido;
  return (
    <Seccion ancla={anclas.contacto} className="banda-naranja bg-accent text-on-accent">
      <div className={`${contenedor} py-20 text-center md:py-24`}>
        <h2
          id={idTitulo(anclas.contacto)}
          className="mx-auto max-w-3xl font-display text-3xl font-extrabold tracking-tight text-balance sm:text-5xl"
        >
          {cta.titulo}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg">{cta.subtitulo}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-start">
          <EnlaceExterno href={cta.principal.href} className={botonSobreNaranja}>
            {cta.principal.texto}
          </EnlaceExterno>
          <div className="flex flex-col items-center gap-2">
            <EnlaceExterno href={cta.secundario.href} className={botonContornoSobreNaranja}>
              {cta.secundario.texto}
            </EnlaceExterno>
            <p className="text-sm font-medium">{cta.avisoAsesor}</p>
          </div>
        </div>
      </div>
    </Seccion>
  );
}
