import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

function setup(props: { busy?: boolean } = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      title="¿Cerrar sesión?"
      confirmLabel="Cerrar y perder"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    >
      <p>Tienes 3 ventas sin enviar.</p>
    </ConfirmDialog>,
  );
  return { onConfirm, onCancel };
}

const cancel = () => screen.getByRole('button', { name: 'Cancelar' });
const confirm = () => screen.getByRole('button', { name: 'Cerrar y perder' });

describe('ConfirmDialog', () => {
  it('is a modal dialog with a title and a description that a screen reader reads', () => {
    setup();

    const dialog = screen.getByRole('alertdialog', { name: '¿Cerrar sesión?' });

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-describedby')).toBe(
      screen.getByText('Tienes 3 ventas sin enviar.').parentElement?.id,
    );
  });

  it('puts the focus on the safe side, so Enter by mistake never confirms a loss', () => {
    setup();

    expect(document.activeElement).toBe(cancel());
  });

  it('cancels with the button and with Escape, and confirms with its own button', () => {
    const { onConfirm, onCancel } = setup();

    fireEvent.click(cancel());
    fireEvent.keyDown(cancel(), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keeps the focus inside: Tab at the last button goes to the first, Shift+Tab at the first goes to the last', () => {
    setup();

    confirm().focus();
    const forward = fireEvent.keyDown(confirm(), { key: 'Tab' });
    expect(forward).toBe(false); // preventDefault: el navegador no se lleva el foco afuera
    expect(document.activeElement).toBe(cancel());

    const backward = fireEvent.keyDown(cancel(), { key: 'Tab', shiftKey: true });
    expect(backward).toBe(false);
    expect(document.activeElement).toBe(confirm());
  });

  it('lets the browser move the focus by itself between the two buttons', () => {
    setup();

    expect(fireEvent.keyDown(cancel(), { key: 'Tab' })).toBe(true);
    confirm().focus();
    expect(fireEvent.keyDown(confirm(), { key: 'Tab', shiftKey: true })).toBe(true);
  });

  it('turns both buttons off while the confirmed action runs, and Escape does nothing then', () => {
    const { onCancel } = setup({ busy: true });

    expect((cancel() as HTMLButtonElement).disabled).toBe(true);
    expect((confirm() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('gives the focus back to what opened it when it closes', () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          {open && (
            <ConfirmDialog
              title="Pregunta"
              confirmLabel="Si"
              cancelLabel="No"
              onConfirm={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            >
              <p>Seguro.</p>
            </ConfirmDialog>
          )}
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    opener.focus();

    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'No' }));
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });

    expect(document.activeElement).toBe(opener);
  });

  it('keeps Escape for itself: whoever is behind the dialog does not hear it', () => {
    const behind = vi.fn();
    render(
      <div onKeyDown={behind}>
        <ConfirmDialog
          title="Pregunta"
          confirmLabel="Si"
          cancelLabel="No"
          onConfirm={() => undefined}
          onCancel={() => undefined}
        >
          <p>Seguro.</p>
        </ConfirmDialog>
      </div>,
    );

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });

    expect(behind).not.toHaveBeenCalled();
  });
});
