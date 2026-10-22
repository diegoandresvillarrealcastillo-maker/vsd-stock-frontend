import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Role } from '../../domain/model/permissions';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakeSalesHistory } from '../../../test/support/sales';
import { renderScreen } from '../../../test/support/screens';
import { FakeSyncEngine } from '../../../test/support/sync-engine';
import { useSales } from './SalesProvider';

function Probe() {
  const { attention, refreshAttention } = useSales();
  return (
    <>
      <p data-testid="atencion">
        {attention === null ? 'nada' : `${String(attention.count)}${attention.more ? '+' : ''}`}
      </p>
      <button type="button" onClick={refreshAttention}>
        Contar
      </button>
    </>
  );
}

function mount(
  role: Role | null,
  options: { sales?: ReturnType<typeof createFakeSalesHistory> } = {},
) {
  const sales = options.sales ?? createFakeSalesHistory();
  const sync = new FakeSyncEngine();
  const auth = createTestAuth(role === null ? {} : { stored: testSession('ana') });
  if (role !== null) auth.answer(testMe('ana', role));
  const view = renderScreen(<Probe />, { auth, sales, sync, path: '/mostrador/ventas' });
  return { ...view, sales, sync };
}

const shown = () => screen.getByTestId('atencion').textContent;

describe('SalesProvider', () => {
  it('says how many sales ask for attention to whoever can see them, once the server answered', async () => {
    const sales = createFakeSalesHistory();
    sales.attentionCount.mockResolvedValue({ count: 3, more: false });
    mount('owner', { sales });

    await waitFor(() => {
      expect(shown()).toBe('3');
    });
  });

  it('says there are more when the count was cut', async () => {
    const sales = createFakeSalesHistory();
    sales.attentionCount.mockResolvedValue({ count: 50, more: true });
    mount('admin', { sales });

    await waitFor(() => {
      expect(shown()).toBe('50+');
    });
  });

  it('does not ask a cashier: the tray is not theirs', async () => {
    const { sales } = mount('cashier');

    await screen.findByTestId('atencion');
    await act(async () => {
      await Promise.resolve();
    });

    expect(sales.attentionCount).not.toHaveBeenCalled();
    expect(shown()).toBe('nada');
  });

  it('does not ask when nobody has signed in: with no connection there is nothing to ask', async () => {
    const { sales } = mount(null);

    await act(async () => {
      await Promise.resolve();
    });

    expect(sales.attentionCount).not.toHaveBeenCalled();
    expect(shown()).toBe('nada');
  });

  it('says nothing when the server could not be asked, and does not break', async () => {
    const sales = createFakeSalesHistory();
    sales.attentionCount.mockRejectedValue(new Error('sin red'));
    mount('owner', { sales });

    await waitFor(() => {
      expect(sales.attentionCount).toHaveBeenCalled();
    });

    expect(shown()).toBe('nada');
  });

  it('asks again when the device sent something, because that is how a sale can arrive in the tray', async () => {
    const sales = createFakeSalesHistory();
    const { sync } = mount('owner', { sales });
    await waitFor(() => {
      expect(sales.attentionCount).toHaveBeenCalledTimes(1);
    });
    sales.attentionCount.mockResolvedValue({ count: 2, more: false });

    act(() => {
      sync.set({ lastSyncedAt: new Date('2026-10-19T14:00:00.000Z') });
    });

    await waitFor(() => {
      expect(shown()).toBe('2');
    });
    expect(sales.attentionCount).toHaveBeenCalledTimes(2);
  });

  it('asks again when a screen says that it changed what is in the tray', async () => {
    const sales = createFakeSalesHistory();
    mount('owner', { sales });
    await waitFor(() => {
      expect(sales.attentionCount).toHaveBeenCalledTimes(1);
    });
    sales.attentionCount.mockResolvedValue({ count: 1, more: false });

    screen.getByRole('button', { name: 'Contar' }).click();

    await waitFor(() => {
      expect(shown()).toBe('1');
    });
  });

  it('refuses to be used outside the provider, saying where it goes', () => {
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Probe />)).toThrow('useSales debe usarse dentro de <SalesProvider>');
    } finally {
      console.error = quiet;
    }
  });
});
