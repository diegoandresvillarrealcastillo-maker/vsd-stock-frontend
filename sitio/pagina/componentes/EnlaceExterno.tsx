import type { ReactNode } from 'react';
import { contenido } from '../contenido';

interface Props {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Un enlace a otro sitio: se abre en otra pestana sin darle acceso a esta (`noopener`) y avisa, a quien no lo ve, que se abre
 * en otra pestana. Todo enlace `https://` de la pagina pasa por aqui; `Sitio.spec.tsx` lo comprueba.
 */
export function EnlaceExterno({ href, className, children }: Props) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only">{` (${contenido.accesibilidad.externo})`}</span>
    </a>
  );
}
