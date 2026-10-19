import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderScreen } from '../../../test/support/screens';
import { FakeReadCopy } from '../../../test/support/read-copy';
import type { CopyState } from '../../domain/ports/in/read-copy';
import { CopyStatus } from './CopyStatus';

// Las horas se dicen en la hora del dispositivo: se arman con ella para que la prueba no dependa de donde corra.
const READY: Partial<CopyState> = {
  status: 'ready',
  productCount: 120,
  productsAsOf: new Date(2026, 9, 19, 15, 30),
  stockAsOf: new Date(2026, 9, 19, 15, 31),
};

function mount(state: Partial<CopyState> = {}) {
  const copy = new FakeReadCopy(state);
  const view = renderScreen(<CopyStatus />, { copy });
  return { ...view, copy };
}

const region = () => screen.getByRole('status');

describe('CopyStatus', () => {
  it('says how many products this device keeps and from what hour they are', () => {
    mount(READY);

    expect(within(region()).getByText('120 productos en este equipo')).toBeDefined();
    expect(region().textContent).toContain('Catálogo al 19 oct, 3:30 p. m.');
    expect(region().textContent).toContain('Existencias al 19 oct, 3:31 p. m.');
  });

  it('says there is nothing yet, and that it is downloaded when there is a connection', () => {
    mount();

    expect(within(region()).getByText('Todavía no hay catálogo en este equipo')).toBeDefined();
    expect(region().textContent).toContain('Se descarga solo cuando hay conexión.');
  });

  it('lets the person update it, and asks the copy to', () => {
    const { copy } = mount(READY);

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(copy.refreshes).toBe(1);
  });

  it('says it is downloading, without a button: it is already doing it', () => {
    mount({ ...READY, downloading: true });

    expect(within(region()).getByText('Actualizando el catálogo…')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull();
  });

  it('says why it could not update, and that the old one still works', () => {
    mount({ ...READY, fault: 'network' });

    expect(within(region()).getByText('No se pudo actualizar: sin conexión')).toBeDefined();
    expect(region().textContent).toContain('Sigues con el catálogo del 19 oct, 3:30 p. m.');
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDefined();
  });

  it('does not offer to update when what is missing is signing in again', () => {
    mount({ ...READY, fault: 'session' });

    expect(within(region()).getByText('Tu sesión caducó')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull();
  });

  it('follows the copy as it changes', () => {
    const { copy } = mount({ downloading: true });
    expect(within(region()).getByText('Descargando el catálogo…')).toBeDefined();

    act(() => {
      copy.set({ ...READY, downloading: false });
    });

    expect(within(region()).getByText('120 productos en este equipo')).toBeDefined();
  });
});
