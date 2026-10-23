import { contenedor, etiqueta } from '../clases';
import { EnlaceExterno } from '../componentes/EnlaceExterno';
import { contenido } from '../contenido';

const claseEnlace =
  'inline-flex min-h-touch items-center text-sm text-on-band/80 underline-offset-4 transition-colors duration-(--duration-base) hover:text-on-band hover:underline';

/** El pie: el logo, el aviso de que no es un facturador y los enlaces de siempre, en tres columnas. */
export function Pie() {
  const { pie, marca } = contenido;
  return (
    <footer className="banda bg-band text-on-band">
      {/* El margen de abajo en telefono deja ver el ultimo renglon aunque la barra de contacto este abierta. */}
      <div className={`${contenedor} py-14 max-md:pb-28`}>
        <div className="grid gap-10 md:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div>
            <img
              src="/logo-stock.webp"
              alt={marca}
              width={87}
              height={60}
              className="h-14 w-auto"
            />
            <p className="mt-4 max-w-xs text-sm text-on-band/80">{pie.aviso}</p>
          </div>
          {pie.columnas.map((columna) => (
            <div key={columna.titulo}>
              <h2 className={`${etiqueta} text-accent`}>{columna.titulo}</h2>
              <ul className="mt-3">
                {columna.enlaces.map((enlace) => (
                  <li key={`${enlace.href}${enlace.texto}`}>
                    {enlace.href.startsWith('#') ? (
                      <a href={enlace.href} className={claseEnlace}>
                        {enlace.texto}
                      </a>
                    ) : (
                      <EnlaceExterno href={enlace.href} className={claseEnlace}>
                        {enlace.texto}
                      </EnlaceExterno>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
