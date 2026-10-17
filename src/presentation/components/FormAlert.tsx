import { useEffect, useRef, type ReactNode } from 'react';

/**
 * El aviso de que algo salio mal con un formulario. Es una region `alert`: los lectores de pantalla lo leen al aparecer, y
 * toma el foco para que quien usa solo el teclado empiece a leer aqui. Dice la causa en una frase; el color solo acompana.
 */
export function FormAlert({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="flex flex-col gap-1 rounded-md border border-accent-text bg-surface-raised p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <p className="text-base font-medium text-accent-text">{title}</p>
      <p className="text-sm text-fg-muted">{children}</p>
    </div>
  );
}
