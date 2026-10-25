import { useEffect, useState } from 'react';
import { EnlaceExterno } from '../componentes/EnlaceExterno';
import { IconoEquis } from '../componentes/Iconos';
import { contenido } from '../contenido';

/**
 * La barra de abajo del telefono: aparece cuando el hero ya paso, lleva a WhatsApp (no a la cuenta: el contacto de las tiendas piloto) y se puede cerrar. No existe hasta que el
 * navegador dice que el hero salio de la pantalla (el servidor no lo sabe), y si el navegador no sabe decirlo, no aparece nunca:
 * es mejor no mostrarla que taparle la pantalla a alguien sin poder saber cuando quitarla.
 */
export function BarraContacto() {
  const { barraContacto } = contenido;
  const [heroPaso, setHeroPaso] = useState(false);
  const [cerrada, setCerrada] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(contenido.anclas.inicio);
    if (hero === null || typeof IntersectionObserver === 'undefined') return;
    const observador = new IntersectionObserver((cambios) => {
      const ultimo = cambios.at(-1);
      if (ultimo !== undefined) setHeroPaso(!ultimo.isIntersecting);
    });
    observador.observe(hero);
    return () => {
      observador.disconnect();
    };
  }, []);

  if (!heroPaso || cerrada) return null;

  return (
    <aside
      aria-label={barraContacto.etiqueta}
      className="banda fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-white/10 bg-band px-gutter py-2 text-on-band shadow-lg md:hidden"
    >
      <p className="min-w-0 flex-1 text-sm font-medium">{barraContacto.texto}</p>
      <EnlaceExterno
        href={barraContacto.href}
        className="inline-flex min-h-touch shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover"
      >
        {barraContacto.boton}
      </EnlaceExterno>
      <button
        type="button"
        aria-label={barraContacto.cerrar}
        onClick={() => {
          setCerrada(true);
        }}
        className="inline-flex size-touch shrink-0 items-center justify-center rounded-lg text-on-band/80 hover:bg-white/10 hover:text-on-band"
      >
        <IconoEquis />
      </button>
    </aside>
  );
}
