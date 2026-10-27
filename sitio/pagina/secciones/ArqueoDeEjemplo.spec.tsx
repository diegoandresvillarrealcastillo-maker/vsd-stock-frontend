import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PESOS } from '../../../src/domain/model/money';
import { parseCash } from '../../../src/domain/model/shift';
import { contenido } from '../contenido';
import { ArqueoDeEjemplo } from './ArqueoDeEjemplo';

// El arqueo de ejemplo (C4-L5) visto desde fuera: la persona escribe el efectivo que conto y lee lo que le diria el producto. Lo
// que se dice lo escribe el dominio (`demos/arqueo.spec.ts`); aqui se vigila que el dibujo lo muestre bien: el titular y la linea
// de «Esperabas… y contaste…», el tono que acompana, que el campo solo acepte numeros y que no se lea en voz alta tecla a tecla.

const { arqueo } = contenido;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const montar = (): ReturnType<typeof render> => render(<ArqueoDeEjemplo id="prueba" />);
const campo = (): HTMLInputElement => screen.getByLabelText<HTMLInputElement>(arqueo.campo);
const escribir = (texto: string): void => {
  fireEvent.change(campo(), { target: { value: texto } });
};
/** La nota que acompana al campo: su tono sale en `data-tone`. */
const nota = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-tone]');

describe('the cash count of the example at rest', () => {
  it('opens with a drawer that is short: «Faltan $ 2.000» and «Esperabas $ 170.000 y contaste $ 168.000.»', () => {
    montar();

    expect(campo().value).toBe('168000');
    expect(screen.getByText('Faltan $ 2.000')).toBeTruthy();
    expect(screen.getByText('Esperabas $ 170.000 y contaste $ 168.000.')).toBeTruthy();
    expect(nota()?.getAttribute('data-tone')).toBe('warn');
  });

  it('says how much cash the drawer should hold', () => {
    montar();

    expect(screen.getByText(arqueo.esperadoEtiqueta).nextElementSibling?.textContent).toBe(
      '$ 170.000',
    );
  });

  it('introduces itself with its own title and sentence, and tells what to write', () => {
    montar();

    expect(screen.getByRole('heading', { name: arqueo.titulo })).toBeTruthy();
    expect(screen.getByText(arqueo.texto)).toBeTruthy();
    expect(screen.getByText(arqueo.ayuda)).toBeTruthy();
    expect(campo().getAttribute('inputmode')).toBe('numeric');
  });
});

describe('counting the cash', () => {
  it('says the drawer balances, with a calm tone, when the count is the expected one', () => {
    montar();

    escribir('170000');

    expect(screen.getByText('La caja cuadra')).toBeTruthy();
    expect(screen.getByText('Esperabas $ 170.000 y contaste $ 170.000.')).toBeTruthy();
    expect(nota()?.getAttribute('data-tone')).toBe('ok');
  });

  it('says how much is over', () => {
    montar();

    escribir('171500');

    expect(screen.getByText('Sobran $ 1.500')).toBeTruthy();
    expect(screen.getByText('Esperabas $ 170.000 y contaste $ 171.500.')).toBeTruthy();
    expect(nota()?.getAttribute('data-tone')).toBe('warn');
  });

  it('says how much is missing, with the small differences too', () => {
    montar();

    escribir('169950');

    expect(screen.getByText('Faltan $ 50')).toBeTruthy();
  });

  it('takes a zero as a count: an empty drawer is an amount', () => {
    montar();

    escribir('0');

    expect(screen.getByText('Faltan $ 170.000')).toBeTruthy();
    expect(screen.getByText('Esperabas $ 170.000 y contaste $ 0.')).toBeTruthy();
  });

  it('does not add the warning the app gives when closing: this is only an example, nothing is kept on record', () => {
    montar();

    expect(screen.queryByText(/queda anotado/)).toBeNull();
  });
});

describe('only numbers, like the app', () => {
  it('says what the app says when the cash has a point, and shows no difference', () => {
    montar();

    escribir('170.000');

    const mensaje = parseCash('170.000');
    if (mensaje.ok) throw new Error('170.000 no debia leerse');
    expect(screen.getByText(mensaje.message)).toBeTruthy();
    expect(campo().getAttribute('aria-invalid')).toBe('true');
    expect(campo().value).toBe('170.000');
    expect(nota()).toBeNull();
    expect(screen.queryByText(/Esperabas/)).toBeNull();
  });

  it('says nothing about the difference until there is a number, and asks for it', () => {
    montar();

    escribir('');

    expect(nota()).toBeNull();
    expect(
      screen.getByText('Escribe el efectivo que hay en la caja. Si está vacía, escribe 0.'),
    ).toBeTruthy();
  });

  it('refuses letters, signs and an amount above what the product takes', () => {
    montar();

    for (const texto of ['5o', '$170000', '-1', String(MAX_PESOS + 1)]) {
      escribir(texto);
      expect(campo().getAttribute('aria-invalid'), texto).toBe('true');
      expect(nota(), texto).toBeNull();
    }
  });

  it('comes back to the difference as soon as the cash reads again', () => {
    montar();
    escribir('170.000');

    escribir('170000');

    expect(campo().getAttribute('aria-invalid')).toBe('false');
    expect(screen.getByText('La caja cuadra')).toBeTruthy();
    expect(screen.getByText(arqueo.ayuda)).toBeTruthy();
  });
});

describe('reading it', () => {
  it('links the field with the help and with the difference, so it is read with the field', () => {
    montar();

    const ids = campo().getAttribute('aria-describedby')?.split(' ') ?? [];

    expect(ids).toContain(screen.getByText(arqueo.ayuda).id);
    expect(ids).toContain(nota()?.id);
  });

  it('keeps the message of a wrong count tied to the field, and drops the difference that is no longer there', () => {
    montar();

    escribir('170.000');

    const mensaje = screen.getByText('Escribe el efectivo en pesos, solo con números.');
    expect(campo().getAttribute('aria-describedby')).toBe(mensaje.id);
  });

  it('does not let the browser underline an amount as a misspelled word', () => {
    montar();

    expect(campo().getAttribute('spellcheck')).toBe('false');
  });

  it('draws and answers every key without a warning from React', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    montar();

    escribir('170000');
    escribir('170.000');
    escribir('');

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('does not read the difference aloud on every key: it is not a live region, as in the app', () => {
    montar();
    escribir('170000');

    const vivas = document.querySelectorAll('[aria-live], [role="status"], [role="alert"]');

    expect(vivas).toHaveLength(0);
  });

  it('does not say the difference with color alone: the tone has an icon and the title says it', () => {
    montar();

    expect(nota()?.querySelector('svg')).not.toBeNull();
    expect(nota()?.textContent).toContain('Faltan $ 2.000');
  });
});

describe('no countdown on money', () => {
  it('shows every figure at once: no timer is started and nothing waits to count up or down', () => {
    montar();

    escribir('171500');
    escribir('170000');

    expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByText('La caja cuadra')).toBeTruthy();
  });
});
