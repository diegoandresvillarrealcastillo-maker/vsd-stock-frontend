import { useEffect, useRef, useState } from 'react';
import { contenedor, botonIcono } from '../clases';
import { EnlaceExterno } from '../componentes/EnlaceExterno';
import { IconoEquis, IconoLuna, IconoMenu, IconoSol } from '../componentes/Iconos';
import { contenido } from '../contenido';
import { almacenDelNavegador, alternarTema } from '../tema';
import { useSeccionActiva } from '../useSeccionActiva';

const SECCIONES = contenido.navegacion.enlaces.map((enlace) => enlace.href.slice(1));
const ID_MENU = 'menu-principal';

/**
 * La navegacion fija de arriba: el logo, los enlaces de la pagina (el de la seccion que se lee, marcado), el boton de tema y el
 * del telefono. En telefono los enlaces son un menu de divulgacion: un boton que los muestra u oculta. No es una ventana, no
 * atrapa el foco; se cierra con Escape o al elegir un enlace.
 */
export function Navegacion() {
  const { navegacion } = contenido;
  const [abierto, setAbierto] = useState(false);
  const activa = useSeccionActiva(SECCIONES);
  const botonMenu = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (evento: KeyboardEvent): void => {
      if (evento.key !== 'Escape') return;
      setAbierto(false);
      botonMenu.current?.focus();
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  return (
    <header className="banda sticky top-0 z-40 border-b border-white/10 bg-band text-on-band">
      <div className={`${contenedor} flex h-16 items-center justify-between gap-3`}>
        <a
          href={`#${contenido.anclas.inicio}`}
          aria-label={navegacion.inicio}
          className="flex shrink-0 items-center rounded-md"
        >
          <img src="/logo-stock.webp" alt="" width={58} height={40} className="h-10 w-auto" />
        </a>

        <nav aria-label={navegacion.principal} className="flex items-center gap-1 sm:gap-2">
          <ul
            id={ID_MENU}
            data-abierto={abierto}
            className="absolute inset-x-0 top-full hidden flex-col gap-1 border-b border-white/10 bg-band p-3 shadow-lg data-[abierto=true]:flex md:static md:flex md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0 md:shadow-none"
          >
            {navegacion.enlaces.map((enlace) => (
              <li key={enlace.href}>
                <a
                  href={enlace.href}
                  aria-current={activa === enlace.href.slice(1) ? 'location' : undefined}
                  onClick={() => {
                    setAbierto(false);
                  }}
                  className="flex min-h-touch items-center rounded-md px-3 text-sm font-medium text-on-band/80 underline-offset-8 transition-colors duration-(--duration-base) hover:text-on-band aria-[current=location]:text-on-band aria-[current=location]:underline aria-[current=location]:decoration-accent aria-[current=location]:decoration-2"
                >
                  {enlace.texto}
                </a>
              </li>
            ))}
          </ul>

          <EnlaceExterno
            href={navegacion.cta.href}
            className="hidden min-h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent transition-colors duration-(--duration-base) hover:bg-accent-hover sm:inline-flex"
          >
            {navegacion.cta.texto}
          </EnlaceExterno>

          <button
            type="button"
            aria-label={navegacion.cambiarTema}
            onClick={() => {
              alternarTema(document.documentElement, almacenDelNavegador());
            }}
            className={botonIcono}
          >
            <IconoSol className="icono-sol size-5" />
            <IconoLuna className="icono-luna size-5" />
          </button>

          <button
            ref={botonMenu}
            type="button"
            aria-label={abierto ? navegacion.cerrarMenu : navegacion.abrirMenu}
            aria-expanded={abierto}
            aria-controls={ID_MENU}
            onClick={() => {
              setAbierto((actual) => !actual);
            }}
            className={`${botonIcono} md:hidden`}
          >
            {abierto ? <IconoEquis /> : <IconoMenu />}
          </button>
        </nav>
      </div>
    </header>
  );
}
