import { useEffect, useState } from 'react';

/**
 * El id de la primera seccion de la lista que cruza la linea del medio de la pantalla, o `null` si ninguna (o si el navegador no
 * sabe decirlo). Empieza en `null`: el servidor no sabe donde esta la persona, y la primera pintura del navegador tiene que ser
 * igual a la del servidor.
 */
export function useSeccionActiva(ids: readonly string[]): string | null {
  const [activa, setActiva] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visibles = new Set<string>();
    const observador = new IntersectionObserver(
      (cambios) => {
        for (const cambio of cambios) {
          if (cambio.isIntersecting) visibles.add(cambio.target.id);
          else visibles.delete(cambio.target.id);
        }
        setActiva(ids.find((id) => visibles.has(id)) ?? null);
      },
      // Una franja delgada alrededor del medio: solo cuenta la seccion que se esta leyendo, no la que asoma por el borde.
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const id of ids) {
      const seccion = document.getElementById(id);
      if (seccion !== null) observador.observe(seccion);
    }
    return () => {
      observador.disconnect();
    };
  }, [ids]);

  return activa;
}
