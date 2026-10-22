import { EnlaceExterno } from '../componentes/EnlaceExterno';
import { etiqueta } from '../clases';
import { contenido } from '../contenido';

/** La franja de arriba: dice que la version esta en pruebas, sin esconderlo, y a donde escribir. */
export function Anuncio() {
  const { anuncio } = contenido;
  return (
    <div className="bg-accent text-on-accent">
      <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-gutter py-2 text-center text-sm font-medium">
        <span className={`${etiqueta} rounded-full bg-band px-2.5 py-0.5 text-on-band`}>
          {anuncio.etiqueta}
        </span>
        <span>{anuncio.texto}</span>
        <EnlaceExterno
          href={anuncio.enlace.href}
          className="font-semibold underline underline-offset-4"
        >
          {anuncio.enlace.texto}
        </EnlaceExterno>
      </p>
    </div>
  );
}
