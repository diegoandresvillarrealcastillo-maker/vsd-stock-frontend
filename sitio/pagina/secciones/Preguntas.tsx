import { contenedor, respiro } from '../clases';
import { IconoChevron } from '../componentes/Iconos';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';

// Todas comparten el nombre: el navegador deja abierta una sola a la vez.
const GRUPO = 'preguntas';

/**
 * Las preguntas frecuentes, como `<details>`: abren y cierran sin JavaScript (se leen aunque el codigo no haya cargado) y los
 * lectores de pantalla ya saben usarlas. Las preguntas no son titulos: una lista de siete titulos seria ruido para quien los recorre.
 */
export function Preguntas() {
  const { preguntas, anclas } = contenido;
  return (
    <Seccion ancla={anclas.preguntas} className={`${respiro} bg-surface-raised`}>
      <div className={contenedor}>
        <EncabezadoSeccion
          ancla={anclas.preguntas}
          etiqueta={preguntas.etiqueta}
          titulo={preguntas.titulo}
        />
        <div className="mt-12 max-w-3xl divide-y divide-rule rounded-2xl border border-rule bg-surface">
          {preguntas.items.map((item) => (
            <details key={item.pregunta} name={GRUPO} className="group px-6">
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-lg font-bold [&::-webkit-details-marker]:hidden">
                {item.pregunta}
                <IconoChevron className="size-5 shrink-0 text-fg-muted transition-transform duration-(--duration-base) group-open:rotate-180" />
              </summary>
              <p className="pb-5 text-fg-muted">{item.respuesta}</p>
            </details>
          ))}
        </div>
      </div>
    </Seccion>
  );
}
