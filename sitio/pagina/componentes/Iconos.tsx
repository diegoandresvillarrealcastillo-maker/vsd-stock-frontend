// Los iconos de la pagina: trazos simples que heredan el color del texto (`currentColor`). Ninguno lleva significado propio: el
// significado esta en el texto de al lado, asi que todos se esconden de los lectores de pantalla.
import type { ReactNode } from 'react';

interface Props {
  readonly className?: string;
}

function Icono({ className, children }: Props & { readonly children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ?? 'size-5'}
    >
      {children}
    </svg>
  );
}

export function IconoCheck(props: Props) {
  return (
    <Icono {...props}>
      <path d="M5 12.5 9.5 17 19 7.5" />
    </Icono>
  );
}

export function IconoEquis(props: Props) {
  return (
    <Icono {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icono>
  );
}

export function IconoFlecha(props: Props) {
  return (
    <Icono {...props}>
      <path d="M7 17 17 7M8.5 7H17v8.5" />
    </Icono>
  );
}

export function IconoChevron(props: Props) {
  return (
    <Icono {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icono>
  );
}

export function IconoMenu(props: Props) {
  return (
    <Icono {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icono>
  );
}

export function IconoSol(props: Props) {
  return (
    <Icono {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </Icono>
  );
}

export function IconoLuna(props: Props) {
  return (
    <Icono {...props}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
    </Icono>
  );
}

export function IconoAlerta(props: Props) {
  return (
    <Icono {...props}>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 10v4M12 17.2v.1" />
    </Icono>
  );
}
