import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { MonthlyReport } from '../../domain/model/monthly-report';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import {
  createFakeReports,
  emptySection,
  testReport,
  testSection,
} from '../../../test/support/reports';
import { renderScreen } from '../../../test/support/screens';
import { MonthlyReportPage } from './MonthlyReportPage';

/** 23 de octubre de 2026, 10 de la noche en Bogota (03:00 UTC del 24): para un reloj de Bogota todavia es octubre. */
const NOW = new Date('2026-10-24T03:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(reports = createFakeReports()) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'owner'));
  const view = renderScreen(<MonthlyReportPage />, { path: '/reportes', auth, reports });
  return { ...view, reports };
}

const failure = new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null });
const salesRows = () =>
  within(screen.getByRole('list', { name: 'Ventas por tarifa' })).getAllByRole('listitem');
const amounts = (name: string) => {
  const group = screen.getByRole('group', { name });
  return Object.fromEntries(
    within(group)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]),
  );
};

describe('MonthlyReportPage', () => {
  it('says it is loading, and then shows the month of today as a Bogotá clock says it', async () => {
    const { reports } = setup();

    expect(screen.getByRole('status').textContent).toContain('Cargando el reporte');
    expect(await screen.findByRole('heading', { name: 'octubre de 2026' })).toBeDefined();
    expect(reports.monthly).toHaveBeenCalledWith('2026-10');
  });

  it('still shows the month that is ending in Bogotá when it is already the next one in UTC', async () => {
    vi.setSystemTime(new Date('2026-11-01T04:30:00.000Z'));
    const { reports } = setup();

    await screen.findByRole('heading', { name: 'octubre de 2026' });
    expect(reports.monthly).toHaveBeenCalledWith('2026-10');
  });

  it('announces the month when it changes, so a screen reader says which one it is reading', async () => {
    setup();
    const month = await screen.findByRole('heading', { name: 'octubre de 2026' });

    expect(month.getAttribute('aria-live')).toBe('polite');
  });

  it('names the screen and says what it is for', async () => {
    setup();
    await screen.findByRole('list', { name: 'Ventas por tarifa' });

    expect(screen.getByRole('heading', { level: 1, name: 'Reporte mensual' })).toBeDefined();
  });

  describe('the sales of the month', () => {
    it('shows the four rows of the declaration, in order, with what each one sold', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      const rows = salesRows();
      expect(rows).toHaveLength(4);
      expect(rows[0]?.textContent).toContain('Gravado 19 %');
      expect(rows[0]?.textContent).toContain('$ 11.900');
      expect(rows[1]?.textContent).toContain('Gravado 5 %');
      expect(rows[1]?.textContent).toContain('$ 1.050');
      expect(rows[2]?.textContent).toContain('Exento');
      expect(rows[2]?.textContent).toContain('$ 700');
      expect(rows[3]?.textContent).toContain('Excluido');
      expect(rows[3]?.textContent).toContain('$ 1.000');
    });

    it('says the base and the tax of what is taxed, and that the rest carries no tax', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      const rows = salesRows();
      expect(rows[0]?.textContent).toContain('Base $ 10.000 · IVA $ 1.900');
      expect(rows[1]?.textContent).toContain('Base $ 1.000 · IVA $ 50');
      expect(rows[2]?.textContent).toContain('Sin IVA');
      expect(rows[3]?.textContent).toContain('Sin IVA');
    });

    it('adds up the section: the base without tax, the tax and the total sold', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      expect(amounts('Totales de las ventas')).toEqual({
        'Base sin IVA': '$ 12.700',
        IVA: '$ 1.950',
        'Total vendido': '$ 14.650',
      });
    });

    it('sets the total sold apart from the base and the tax, which are its parts', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      expect(screen.getByText('Total vendido').className).toContain('font-semibold');
      expect(screen.getByText('Base sin IVA').className).not.toContain('font-semibold');
    });

    it('is a block of its own, named, and without the voids block when nothing was voided', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      const block = screen.getByRole('region', { name: 'Ventas del mes' });
      expect(
        within(block).getByRole('heading', { level: 3, name: 'Ventas del mes' }),
      ).toBeDefined();
      expect(screen.queryByRole('region', { name: 'Anulaciones del mes' })).toBeNull();
    });

    it('shows the totals the server sent and does not add them up again', async () => {
      // Un reporte no coherente a proposito (la base y el IVA no suman el total): lo que sale en pantalla es lo que mando el servidor.
      setup(createFakeReports({ sales: testSection({ total: 10, base: 5, tax: 4 }) }));
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      expect(amounts('Totales de las ventas')).toEqual({
        'Base sin IVA': '$ 5',
        IVA: '$ 4',
        'Total vendido': '$ 10',
      });
    });

    it('says how many sales it adds up, in singular when it is one', async () => {
      setup(createFakeReports({ sales: testSection({ count: 1 }) }));
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      expect(screen.getByText('1 venta')).toBeDefined();
    });

    it('says how many sales it adds up, in plural', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      expect(screen.getByText('2 ventas')).toBeDefined();
    });

    it('says what was collected with each way of paying, in the order the cash register offers them', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      const group = screen.getByRole('group', { name: 'Cobrado por medio de pago' });
      expect(
        within(group)
          .getAllByRole('term')
          .map((term) => term.textContent),
      ).toEqual(['Efectivo', 'Tarjeta', 'Transferencia']);
      expect(amounts('Cobrado por medio de pago')).toEqual({
        Efectivo: '$ 1.050',
        Tarjeta: '$ 12.600',
        Transferencia: '$ 1.000',
      });
    });
  });

  describe('the voids of the month', () => {
    it('shows them apart from the sales, with the same rows and a sentence that says they are not subtracted', async () => {
      const voids = testSection({
        count: 1,
        total: 11_900,
        base: 10_000,
        tax: 1_900,
        rows: [
          { taxKind: 'taxed', rateBp: 1900, total: 11_900, base: 10_000, tax: 1_900 },
          { taxKind: 'taxed', rateBp: 500, total: 0, base: 0, tax: 0 },
          { taxKind: 'exempt', rateBp: 0, total: 0, base: 0, tax: 0 },
          { taxKind: 'excluded', rateBp: 0, total: 0, base: 0, tax: 0 },
        ],
      });
      setup(createFakeReports({ voids }));
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      const list = screen.getByRole('list', { name: 'Anulaciones por tarifa' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(4);
      expect(within(list).getAllByRole('listitem')[0]?.textContent).toContain('$ 11.900');
      expect(amounts('Totales de las anulaciones')['Total anulado']).toBe('$ 11.900');
      expect(screen.getByText('1 venta anulada')).toBeDefined();
      expect(screen.getByText(/No se restan de las ventas/)).toBeDefined();
    });

    it('says how the voided sales had been paid', async () => {
      setup(createFakeReports({ voids: testSection({ count: 1 }) }));
      await screen.findByRole('list', { name: 'Anulaciones por tarifa' });

      expect(amounts('Medio de pago de lo anulado')).toEqual({
        Efectivo: '$ 1.050',
        Tarjeta: '$ 12.600',
        Transferencia: '$ 1.000',
      });
    });

    it('says the voids also count sales of an earlier month', async () => {
      setup(createFakeReports({ voids: testSection({ count: 2 }) }));
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      expect(screen.getByText('2 ventas anuladas')).toBeDefined();
      expect(screen.getByText(/aunque se hicieran antes/)).toBeDefined();
    });

    it('does not show the block when nothing was voided', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      expect(screen.queryByRole('list', { name: 'Anulaciones por tarifa' })).toBeNull();
      expect(screen.queryByText(/No se restan/)).toBeNull();
    });

    it('shows the voids of a month in which nothing was sold: that is how a September sale voided in October is seen', async () => {
      setup(createFakeReports({ sales: emptySection(), voids: testSection({ count: 1 }) }));
      await screen.findByRole('list', { name: 'Anulaciones por tarifa' });

      expect(screen.queryByText(/no hubo ventas/)).toBeNull();
      expect(screen.getByText('1 venta anulada')).toBeDefined();
      // Sin ventas no hay bloque de ventas: no se muestran cuatro renglones en cero como si algo se hubiera vendido.
      expect(screen.queryByRole('region', { name: 'Ventas del mes' })).toBeNull();
      expect(
        within(screen.getByRole('region', { name: 'Anulaciones del mes' })).getByRole('heading', {
          level: 3,
          name: 'Anulaciones del mes',
        }),
      ).toBeDefined();
    });
  });

  describe('a month without sales', () => {
    it('says so with the name of the month, and shows no accounts', async () => {
      setup(createFakeReports({ sales: emptySection(), voids: emptySection() }));

      expect(await screen.findByText('En octubre de 2026 no hubo ventas.')).toBeDefined();
      expect(screen.queryByRole('list', { name: 'Ventas por tarifa' })).toBeNull();
      expect(screen.queryByRole('group', { name: 'Cobrado por medio de pago' })).toBeNull();
    });
  });

  describe('changing the month', () => {
    it('goes to the previous month, asks for it and shows its name', async () => {
      const { reports } = setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));

      expect(await screen.findByRole('heading', { name: 'septiembre de 2026' })).toBeDefined();
      expect(reports.monthly).toHaveBeenLastCalledWith('2026-09');
    });

    it('does not let go past the month of today: there are no sales to read in the future', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      const next = screen.getByRole('button', { name: 'Mes siguiente' });
      expect((next as HTMLButtonElement).disabled).toBe(true);
    });

    it('comes back to the month of today and the button is turned off again', async () => {
      const { reports } = setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });
      fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
      await screen.findByRole('heading', { name: 'septiembre de 2026' });

      const next = screen.getByRole('button', { name: 'Mes siguiente' });
      expect((next as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(next);

      expect(await screen.findByRole('heading', { name: 'octubre de 2026' })).toBeDefined();
      expect(reports.monthly).toHaveBeenLastCalledWith('2026-10');
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: 'Mes siguiente' }).disabled,
      ).toBe(true);
    });

    it('goes back across New Year', async () => {
      vi.setSystemTime(new Date('2026-01-15T15:00:00.000Z'));
      const { reports } = setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));

      expect(await screen.findByRole('heading', { name: 'diciembre de 2025' })).toBeDefined();
      expect(reports.monthly).toHaveBeenLastCalledWith('2025-12');
    });

    it('shows the answer of the month that is on the screen, not a late one of a month it already left', async () => {
      const answers = new Map<string, (report: MonthlyReport) => void>();
      const reports = createFakeReports();
      reports.monthly.mockImplementation(
        (month) =>
          new Promise<MonthlyReport>((resolve) => {
            answers.set(month, resolve);
          }),
      );
      setup(reports);
      fireEvent.click(await screen.findByRole('button', { name: 'Mes anterior' }));
      fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
      await screen.findByRole('heading', { name: 'agosto de 2026' });

      answers.get('2026-08')?.(testReport({ month: '2026-08', sales: testSection({ count: 7 }) }));
      await screen.findByText('7 ventas');
      answers.get('2026-10')?.(testReport({ sales: testSection({ count: 99 }) }));

      expect(await screen.findByText('7 ventas')).toBeDefined();
      expect(screen.queryByText('99 ventas')).toBeNull();
    });

    it('says it is loading again while the other month arrives, and keeps the controls', async () => {
      const reports = createFakeReports();
      setup(reports);
      await screen.findByRole('list', { name: 'Ventas por tarifa' });
      reports.monthly.mockImplementation(() => new Promise<MonthlyReport>(() => undefined));

      fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));

      expect(screen.getByRole('status').textContent).toContain('Cargando el reporte');
      expect(screen.queryByRole('list', { name: 'Ventas por tarifa' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDefined();
    });
  });

  describe('when it cannot load', () => {
    it('says what happened and offers to try again', async () => {
      const reports = createFakeReports();
      reports.monthly.mockRejectedValueOnce(failure);
      setup(reports);

      expect(await screen.findByText('No pudimos cargar el reporte')).toBeDefined();
      // Y dice por que: lo que paso, no un aviso generico.
      expect(
        screen.getByText(
          'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
        ),
      ).toBeDefined();
      reports.monthly.mockImplementation((month) => Promise.resolve(testReport({ month })));
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByRole('list', { name: 'Ventas por tarifa' })).toBeDefined();
      expect(reports.monthly).toHaveBeenCalledTimes(2);
    });

    it('keeps the controls so another month can be tried', async () => {
      const reports = createFakeReports();
      reports.monthly.mockRejectedValueOnce(failure);
      setup(reports);
      await screen.findByText('No pudimos cargar el reporte');

      fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));

      expect(await screen.findByRole('list', { name: 'Ventas por tarifa' })).toBeDefined();
      expect(reports.monthly).toHaveBeenLastCalledWith('2026-09');
    });
  });

  // La auditoría contable (25 de octubre de 2026): los cuatro renglones son un resumen de ventas para el control interno, no
  // alcanzan para preparar la declaración de IVA. El aviso va arriba, antes de cualquier cifra, y dice lo que le importa al tendero.
  describe('what the report is not', () => {
    const notice = () => screen.getByRole('note', { name: 'Para qué sirve este reporte' });

    it('says at the top, before any figure, that it is for the internal control and is not the tax declaration', async () => {
      setup();
      const month = await screen.findByRole('heading', { name: 'octubre de 2026' });

      expect(
        within(notice()).getByText(
          'Este reporte es de control interno, no es tu declaración de IVA',
        ),
      ).toBeDefined();
      expect(
        notice().compareDocumentPosition(month) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('says it does not replace the e-invoice or the tax declaration', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      expect(notice().textContent).toContain(
        'No reemplaza la factura electrónica ni la declaración de impuestos.',
      );
    });

    it('says what the declaration needs and the report does not have: purchases, deductible VAT, withholdings and its own periods', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      const text = notice().textContent ?? '';
      expect(text).toContain('tus compras y gastos');
      expect(text).toContain('el IVA que puedes descontar');
      expect(text).toContain('las retenciones');
      expect(text).toContain('los períodos de tu declaración');
      expect(text).toContain('Tu contador lo concilia');
    });

    it('tells not to copy the total sold as income, because it carries the VAT inside', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      expect(notice().textContent).toContain(
        'No copies el «Total vendido» como tus ingresos: lleva el IVA adentro. Para los ingresos usa el valor sin IVA.',
      );
    });

    it('says that a sale that arrives late changes its month, and to send everything before handing the report over', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      const text = notice().textContent ?? '';
      expect(text).toContain(
        'Si una venta hecha sin conexión llega después de cerrar el mes, ese mes cambia.',
      );
      expect(text).toContain('conecta todos los equipos y espera a que digan «Todo enviado»');
    });

    it('says that exempt and excluded are what the shop marked, and that exempt does not give the right to get the VAT of the purchases back', async () => {
      setup();
      await screen.findByRole('list', { name: 'Ventas por tarifa' });

      const text = notice().textContent ?? '';
      expect(text).toContain('Exento y excluido salen como los marcaste en cada producto');
      expect(text).toContain(
        'Que un producto sea exento no significa que puedas descontar o pedir de vuelta el IVA de tus compras',
      );
    });

    it('says it even when the month has no sales', async () => {
      setup(createFakeReports({ sales: emptySection(), voids: emptySection() }));
      await screen.findByText(/no hubo ventas/);

      expect(
        within(notice()).getByText(
          'Este reporte es de control interno, no es tu declaración de IVA',
        ),
      ).toBeDefined();
    });

    it('says it even when the report cannot load', async () => {
      const reports = createFakeReports();
      reports.monthly.mockRejectedValueOnce(failure);
      setup(reports);
      await screen.findByText('No pudimos cargar el reporte');

      expect(
        within(notice()).getByText(
          'Este reporte es de control interno, no es tu declaración de IVA',
        ),
      ).toBeDefined();
    });
  });
});
