import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormAlert } from './FormAlert';
import { SubmitButton } from './SubmitButton';

describe('FormAlert', () => {
  it('announces the problem to a screen reader and tells what it is', () => {
    render(
      <FormAlert title="No pudimos ingresarte">El correo o la contraseña no coinciden.</FormAlert>,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('No pudimos ingresarte');
    expect(alert.textContent).toContain('El correo o la contraseña no coinciden.');
  });

  it('takes the focus when it appears, so the person who cannot see it hears it and the keyboard starts there', () => {
    render(<FormAlert title="Algo falló">Detalle</FormAlert>);

    expect(document.activeElement).toBe(screen.getByRole('alert'));
  });
});

describe('SubmitButton', () => {
  it('submits the form it is in', () => {
    render(
      <form>
        <SubmitButton pending={false}>Ingresar</SubmitButton>
      </form>,
    );

    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Ingresar' });
    expect(button.type).toBe('submit');
    expect(button.disabled).toBe(false);
  });

  it('says it is working and does not let the form go twice while it sends', () => {
    render(
      <form>
        <SubmitButton pending>Ingresar</SubmitButton>
      </form>,
    );

    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Enviando…' });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('can be the quieter kind, for the secondary action', () => {
    render(
      <form>
        <SubmitButton pending={false} variant="accent">
          Dar de baja
        </SubmitButton>
      </form>,
    );

    expect(screen.getByRole('button', { name: 'Dar de baja' }).className).toContain('bg-accent');
  });
});
