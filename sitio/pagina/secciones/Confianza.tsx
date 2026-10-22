import { contenedor, etiqueta, respiro, tarjetaClara } from '../clases';
import { EnlaceExterno } from '../componentes/EnlaceExterno';
import { IconoFlecha } from '../componentes/Iconos';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';

/**
 * Por que creerle a la pagina: cuatro razones que se pueden comprobar, cada una con el enlace a donde se comprueba, y las
 * decisiones escritas que las sostienen. No hay testimonios: no los hay (ni permiso para publicarlos) y la pagina no los inventa.
 */
export function Confianza() {
  const { confianza, anclas } = contenido;
  return (
    <Seccion ancla={anclas.confianza} className={`${respiro} bg-surface-raised`}>
      <div className={contenedor}>
        <EncabezadoSeccion
          ancla={anclas.confianza}
          etiqueta={confianza.etiqueta}
          titulo={confianza.titulo}
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {confianza.puntos.map((punto) => (
            <article key={punto.titulo} className={`${tarjetaClara} flex flex-col`}>
              <h3 className="font-display text-lg leading-snug font-bold text-balance">
                {punto.titulo}
              </h3>
              <p className="mt-3 text-fg-muted">{punto.texto}</p>
              {punto.enlaces.length > 0 && (
                <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4">
                  {punto.enlaces.map((enlace) => (
                    <li key={enlace.href}>
                      <EnlaceExterno
                        href={enlace.href}
                        className="inline-flex min-h-touch items-center gap-1 text-sm font-semibold text-primary underline underline-offset-4"
                      >
                        {enlace.texto}
                        <IconoFlecha className="size-4" />
                      </EnlaceExterno>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
        <p className={`${etiqueta} mt-12 text-fg-muted`}>{confianza.sellosTitulo}</p>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {confianza.sellos.map((sello) => (
            <li key={sello.href}>
              <EnlaceExterno
                href={sello.href}
                className="flex h-full flex-col gap-1 rounded-xl border border-rule bg-surface px-4 py-3 transition-colors duration-(--duration-base) hover:border-border"
              >
                <span className="font-mono text-sm font-medium text-accent-text">
                  {sello.texto}
                </span>
                <span className="text-sm text-fg-muted">{sello.detalle}</span>
              </EnlaceExterno>
            </li>
          ))}
        </ul>
      </div>
    </Seccion>
  );
}
