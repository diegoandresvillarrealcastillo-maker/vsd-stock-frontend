import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

const BUTTON =
  'inline-flex min-h-touch min-w-touch items-center justify-center rounded-md px-5 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * Una pregunta que hay que contestar antes de seguir, sobre todo lo demas. Es un dialogo modal: el foco entra a el, se queda
 * adentro (Tab da la vuelta) y Escape lo cancela; al cerrarse devuelve el foco a lo que lo abrio. El foco empieza en
 * «cancelar», el lado seguro: confirmar una perdida de datos nunca es lo que Enter hace por descuido.
 *
 * No usa el elemento `<dialog>`: su `showModal` no existe en el entorno de pruebas, y el comportamiento que importa (foco,
 * Escape, lectura) es el mismo escrito a mano.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Mientras la accion confirmada corre, los dos botones se apagan. */
  busy?: boolean;
}) {
  const titleId = useId();
  const bodyId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancel.current?.focus();
    return () => {
      opener?.focus();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
    if (focusable === undefined || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-gutter">
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-md flex-col gap-4 rounded-md border border-border bg-surface-raised p-5 text-fg"
      >
        <h2 id={titleId} className="text-xl font-semibold">
          {title}
        </h2>
        <div id={bodyId} className="flex flex-col gap-2 text-base text-fg-muted">
          {children}
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            ref={cancel}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`${BUTTON} border border-border bg-surface text-fg disabled:opacity-60`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`${BUTTON} bg-primary text-on-primary disabled:opacity-60`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
