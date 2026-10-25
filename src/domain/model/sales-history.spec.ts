import { describe, expect, it } from 'vitest';
import type { QueuedOperation } from './outbox';
import {
  MAX_REASON_LENGTH,
  attentionNotes,
  localSaleOf,
  parseReason,
  parseSaleDetail,
  parseSaleRecord,
  saleLineAmount,
  saleStatus,
  statusLabel,
} from './sales-history';

const wireRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'f0000000-0000-4000-8000-000000000001',
  operationId: 'f0000000-0000-4000-8000-0000000000a1',
  shiftId: 'f0000000-0000-4000-8000-0000000000b1',
  deviceId: 'f0000000-0000-4000-8000-0000000000d1',
  userId: 'f0000000-0000-4000-8000-0000000000c1',
  folio: 'AA-000141',
  folioReported: 'AA-000141',
  folioConflict: false,
  total: 14_800,
  needsAdjustment: false,
  flags: [],
  timeFlags: [],
  occurredAt: '2026-10-19T15:10:00.000Z',
  receivedAt: '2026-10-19T15:10:20.000Z',
  review: null,
  voided: null,
  attention: false,
  ...overrides,
});

/** Una linea como la manda el servidor: gravada al 19 %, con el tipo que le toca. */
const wireLine = (overrides: Record<string, unknown> = {}) => ({
  productId: 'p',
  quantityMilli: 1_000,
  unitPrice: 1_000,
  discount: 0,
  taxRateBp: 1_900,
  taxKind: 'taxed',
  ...overrides,
});

const wireDetail = (overrides: Record<string, unknown> = {}) => ({
  ...wireRecord(),
  lines: [
    wireLine({ productId: 'p-arroz', quantityMilli: 2_000, unitPrice: 3_200 }),
    wireLine({ productId: 'p-pan', quantityMilli: 3_000, unitPrice: 2_800 }),
  ],
  payments: [{ method: 'cash', amount: 14_800, reference: null }],
  summary: {
    total: 14_800,
    base: 12_437,
    tax: 2_363,
    byRate: [{ rateBp: 1_900, total: 14_800, base: 12_437, tax: 2_363 }],
  },
  ...overrides,
});

const record = (overrides: Record<string, unknown> = {}) => {
  const parsed = parseSaleRecord(wireRecord(overrides));
  if (parsed === null) throw new Error('el registro de la prueba no se pudo leer');
  return parsed;
};

describe('reading a sale of the list', () => {
  it('reads what the server says of it, with its dates as dates', () => {
    expect(record()).toEqual({
      id: 'f0000000-0000-4000-8000-000000000001',
      operationId: 'f0000000-0000-4000-8000-0000000000a1',
      shiftId: 'f0000000-0000-4000-8000-0000000000b1',
      deviceId: 'f0000000-0000-4000-8000-0000000000d1',
      userId: 'f0000000-0000-4000-8000-0000000000c1',
      folio: 'AA-000141',
      folioReported: 'AA-000141',
      folioConflict: false,
      total: 14_800,
      needsAdjustment: false,
      flags: [],
      timeFlags: [],
      occurredAt: new Date('2026-10-19T15:10:00.000Z'),
      receivedAt: new Date('2026-10-19T15:10:20.000Z'),
      review: null,
      voided: null,
      attention: false,
    });
  });

  it('allows a sale without a device: the shift may have none', () => {
    expect(record({ deviceId: null }).deviceId).toBeNull();
  });

  it('reads who reviewed it and who voided it', () => {
    const reviewed = record({
      review: { reviewedAt: '2026-10-19T16:00:00.000Z', reviewedByUserId: 'u-2', note: 'Ajustado' },
    });
    const voided = record({
      voided: {
        folio: 'ANU-000007',
        voidedAt: '2026-10-19T21:20:00.000Z',
        voidedByUserId: 'u-3',
        operationId: 'op-9',
        reason: 'El cliente se arrepintió',
      },
    });

    expect(reviewed.review).toEqual({
      reviewedAt: new Date('2026-10-19T16:00:00.000Z'),
      reviewedByUserId: 'u-2',
      note: 'Ajustado',
    });
    expect(voided.voided).toEqual({
      folio: 'ANU-000007',
      voidedAt: new Date('2026-10-19T21:20:00.000Z'),
      voidedByUserId: 'u-3',
      operationId: 'op-9',
      reason: 'El cliente se arrepintió',
    });
  });

  it('does not trust what the network brings: a field that is not what the contract says is nothing', () => {
    for (const bad of [
      null,
      'texto',
      [],
      wireRecord({ id: 7 }),
      wireRecord({ operationId: null }),
      wireRecord({ shiftId: undefined }),
      wireRecord({ deviceId: 5 }),
      wireRecord({ userId: null }),
      wireRecord({ folio: 3 }),
      wireRecord({ folioReported: null }),
      wireRecord({ folioConflict: 'no' }),
      wireRecord({ total: '14800' }),
      wireRecord({ total: 1.5 }),
      wireRecord({ needsAdjustment: null }),
      wireRecord({ flags: 'late-shift' }),
      wireRecord({ flags: ['inventada'] }),
      wireRecord({ timeFlags: [3] }),
      wireRecord({ timeFlags: ['inventada'] }),
      wireRecord({ occurredAt: 'ayer' }),
      wireRecord({ receivedAt: null }),
      wireRecord({ review: 'si' }),
      wireRecord({ review: { reviewedAt: 'ayer', reviewedByUserId: 'u', note: null } }),
      wireRecord({
        review: { reviewedAt: '2026-10-19T16:00:00.000Z', reviewedByUserId: 7, note: null },
      }),
      wireRecord({
        review: { reviewedAt: '2026-10-19T16:00:00.000Z', reviewedByUserId: 'u', note: 4 },
      }),
      wireRecord({ voided: 'si' }),
      wireRecord({
        voided: {
          folio: 'ANU-000001',
          voidedAt: 'ayer',
          voidedByUserId: 'u',
          operationId: 'o',
          reason: 'r',
        },
      }),
      wireRecord({
        voided: {
          folio: 'ANU-000001',
          voidedAt: '2026-10-19T21:20:00.000Z',
          voidedByUserId: 'u',
          operationId: 3,
          reason: 'r',
        },
      }),
      wireRecord({
        voided: {
          folio: 'ANU-000001',
          voidedAt: '2026-10-19T21:20:00.000Z',
          voidedByUserId: 'u',
          operationId: 'o',
          reason: null,
        },
      }),
      wireRecord({
        voided: {
          folio: 'ANU-000001',
          voidedAt: '2026-10-19T21:20:00.000Z',
          voidedByUserId: 7,
          operationId: 'o',
          reason: 'r',
        },
      }),
      // Una anulación sin folio, o con uno que no es texto, no es la que el contrato promete (ADR 0036 del backend).
      wireRecord({
        voided: {
          voidedAt: '2026-10-19T21:20:00.000Z',
          voidedByUserId: 'u',
          operationId: 'o',
          reason: 'r',
        },
      }),
      wireRecord({
        voided: {
          folio: 7,
          voidedAt: '2026-10-19T21:20:00.000Z',
          voidedByUserId: 'u',
          operationId: 'o',
          reason: 'r',
        },
      }),
      wireRecord({
        voided: {
          folio: null,
          voidedAt: '2026-10-19T21:20:00.000Z',
          voidedByUserId: 'u',
          operationId: 'o',
          reason: 'r',
        },
      }),
      wireRecord({ attention: 1 }),
    ]) {
      expect(parseSaleRecord(bad)).toBeNull();
    }
  });
});

describe('reading a whole sale', () => {
  it('reads its lines, its payments and its totals by rate, besides what the list says', () => {
    const sale = parseSaleDetail(wireDetail());

    expect(sale?.folio).toBe('AA-000141');
    expect(sale?.lines).toEqual([
      {
        productId: 'p-arroz',
        quantityMilli: 2_000,
        unitPrice: 3_200,
        discount: 0,
        taxRateBp: 1_900,
        taxKind: 'taxed',
      },
      {
        productId: 'p-pan',
        quantityMilli: 3_000,
        unitPrice: 2_800,
        discount: 0,
        taxRateBp: 1_900,
        taxKind: 'taxed',
      },
    ]);
    expect(sale?.payments).toEqual([{ method: 'cash', amount: 14_800, reference: null }]);
    expect(sale?.summary).toEqual({
      total: 14_800,
      base: 12_437,
      tax: 2_363,
      byRate: [{ rateBp: 1_900, total: 14_800, base: 12_437, tax: 2_363 }],
    });
  });

  it('does not trust what the network brings in its lines, payments or totals', () => {
    for (const bad of [
      wireDetail({ lines: 'x' }),
      wireDetail({ lines: [null] }),
      wireDetail({ lines: [wireLine({ productId: 7 })] }),
      wireDetail({ lines: [wireLine({ quantityMilli: 1.5 })] }),
      wireDetail({ lines: [wireLine({ unitPrice: '1' })] }),
      wireDetail({ lines: [wireLine({ discount: null })] }),
      wireDetail({ lines: [wireLine({ taxRateBp: 700 })] }),
      wireDetail({ lines: [wireLine({ taxKind: undefined })] }),
      wireDetail({ lines: [wireLine({ taxKind: 'unclassified' })] }),
      wireDetail({ lines: [wireLine({ taxKind: 1 })] }),
      wireDetail({ lines: [wireLine({ taxKind: 'taxed', taxRateBp: 0 })] }),
      wireDetail({ lines: [wireLine({ taxKind: 'exempt', taxRateBp: 1_900 })] }),
      wireDetail({ lines: [wireLine({ taxKind: 'excluded', taxRateBp: 500 })] }),
      wireDetail({ payments: 'x' }),
      wireDetail({ payments: [null] }),
      wireDetail({ payments: [{ method: 'cheque', amount: 1, reference: null }] }),
      wireDetail({ payments: [{ method: 'cash', amount: '1', reference: null }] }),
      wireDetail({ payments: [{ method: 'cash', amount: 1, reference: 3 }] }),
      wireDetail({ summary: null }),
      wireDetail({ summary: { total: 1, base: 1, tax: 0, byRate: 'x' } }),
      wireDetail({ summary: { total: '1', base: 1, tax: 0, byRate: [] } }),
      wireDetail({ summary: { total: 1, base: 1, tax: 0, byRate: [null] } }),
      wireDetail({
        summary: { total: 1, base: 1, tax: 0, byRate: [{ rateBp: 1, total: 1, base: 1, tax: 0 }] },
      }),
      wireDetail({
        summary: { total: 1, base: 1, tax: 0, byRate: [{ rateBp: 0, total: 1, base: 1 }] },
      }),
      { ...wireDetail(), id: 7 },
    ]) {
      expect(parseSaleDetail(bad)).toBeNull();
    }
  });

  it.each([
    ['taxed', 1_900],
    ['taxed', 500],
    ['exempt', 0],
    ['excluded', 0],
  ] as const)('reads a line sold as %s at %i basis points', (taxKind, taxRateBp) => {
    const sale = parseSaleDetail(wireDetail({ lines: [wireLine({ taxKind, taxRateBp })] }));

    expect(sale?.lines[0]).toMatchObject({ taxKind, taxRateBp });
  });

  it('says what each line cost: what it is worth less the discount', () => {
    expect(
      saleLineAmount({
        productId: 'p',
        quantityMilli: 2_000,
        unitPrice: 3_200,
        discount: 0,
        taxRateBp: 1_900,
        taxKind: 'taxed',
      }),
    ).toBe(6_400);
    expect(
      saleLineAmount({
        productId: 'p',
        quantityMilli: 1_500,
        unitPrice: 8_000,
        discount: 500,
        taxRateBp: 0,
        taxKind: 'exempt',
      }),
    ).toBe(11_500);
  });
});

describe('where a sale is', () => {
  it('is sent when the server has it and nothing asks for a look', () => {
    expect(saleStatus(record())).toBe('sent');
    expect(statusLabel('sent')).toBe('Enviada');
  });

  it('asks for attention when it is in the tray', () => {
    expect(saleStatus(record({ attention: true, needsAdjustment: true }))).toBe('attention');
    expect(statusLabel('attention')).toBe('Requiere atención');
  });

  it('is reviewed once someone looked at it, even if it keeps its marks', () => {
    const reviewed = record({
      needsAdjustment: true,
      review: { reviewedAt: '2026-10-19T16:00:00.000Z', reviewedByUserId: 'u-2', note: null },
    });

    expect(saleStatus(reviewed)).toBe('reviewed');
    expect(statusLabel('reviewed')).toBe('Revisada');
  });

  it('is voided over everything else', () => {
    const voided = record({
      attention: true,
      voided: {
        folio: 'ANU-000002',
        voidedAt: '2026-10-19T21:20:00.000Z',
        voidedByUserId: 'u-3',
        operationId: 'op-9',
        reason: 'x',
      },
    });

    expect(saleStatus(voided)).toBe('voided');
    expect(statusLabel('voided')).toBe('Anulada');
  });
});

describe('what happened to a sale that asks for attention', () => {
  it('says nothing about a clean sale', () => {
    expect(attentionNotes(record())).toEqual([]);
  });

  it('says it was sold without stock, and that the stock has to be adjusted', () => {
    expect(attentionNotes(record({ needsAdjustment: true }))).toEqual([
      'Se vendió sin existencias. La venta es válida; falta ajustar la existencia.',
    ]);
  });

  it('says the folio was already another sale, and the one it was saved with', () => {
    expect(attentionNotes(record({ folioConflict: true, folio: 'AA-000141~0a1b2c3d' }))).toEqual([
      'El folio AA-000141 ya era de otra venta: esta se guardó como AA-000141~0a1b2c3d.',
    ]);
  });

  it.each([
    [
      'price-differs',
      'Algún precio o tarifa no es el del catálogo de hoy: se respetó el de la venta.',
    ],
    [
      'total-differs',
      'El total del equipo no era el que calculó el servidor: se guardó el del servidor.',
    ],
    ['payment-mismatch', 'Los cobros no suman el total de la venta.'],
    ['late-shift', 'Se vendió después de que el turno se cerró.'],
    ['revoked-device', 'Se vendió después de dar de baja el equipo.'],
    ['folio-device', 'El folio es de otro equipo, no del de su turno.'],
  ])('says what %s means', (flag, sentence) => {
    expect(attentionNotes(record({ flags: [flag] }))).toEqual([sentence]);
  });

  it.each([
    ['clock-skew', 'El reloj del equipo estaba desfasado: se corrigió la hora de la venta.'],
    [
      'clock-unverified',
      'El reloj del equipo todavía no se había medido: la hora es la que dijo el equipo.',
    ],
    ['future', 'La hora del equipo estaba en el futuro: se corrigió la hora de la venta.'],
    ['stale', 'La venta llegó mucho después de ocurrir.'],
    ['unreadable', 'No se pudo leer la hora del equipo: se usó la de llegada.'],
  ])('says what the time mark %s means', (flag, sentence) => {
    expect(attentionNotes(record({ timeFlags: [flag] }))).toEqual([sentence]);
  });

  it('says everything that applies, in the order stock, folio, marks and time', () => {
    const notes = attentionNotes(
      record({
        needsAdjustment: true,
        folioConflict: true,
        folio: 'AA-000141~0a1b2c3d',
        flags: ['late-shift', 'payment-mismatch'],
        timeFlags: ['stale'],
      }),
    );

    expect(notes).toEqual([
      'Se vendió sin existencias. La venta es válida; falta ajustar la existencia.',
      'El folio AA-000141 ya era de otra venta: esta se guardó como AA-000141~0a1b2c3d.',
      'Se vendió después de que el turno se cerró.',
      'Los cobros no suman el total de la venta.',
      'La venta llegó mucho después de ocurrir.',
    ]);
  });
});

describe('the reason to void or to review', () => {
  it('is what was written, without the spaces around it and with one space between words', () => {
    expect(parseReason('  El cliente   se arrepintió ', { required: true })).toEqual({
      ok: true,
      value: 'El cliente se arrepintió',
    });
  });

  it('is asked for when it is required and nothing was written', () => {
    expect(parseReason('   ', { required: true })).toEqual({
      ok: false,
      message: 'Escribe por qué se anula la venta.',
    });
  });

  it('can be left empty when it is a note: nothing is sent', () => {
    expect(parseReason('   ', { required: false })).toEqual({ ok: true, value: null });
  });

  it('is not longer than the server accepts', () => {
    expect(MAX_REASON_LENGTH).toBe(200);
    expect(parseReason('x'.repeat(200), { required: true })).toEqual({
      ok: true,
      value: 'x'.repeat(200),
    });
    expect(parseReason('x'.repeat(201), { required: true })).toEqual({
      ok: false,
      message: 'Es muy largo: 200 letras como máximo.',
    });
  });
});

const queued = (overrides: Partial<QueuedOperation> = {}): QueuedOperation => ({
  operationId: 'f0000000-0000-4000-8000-0000000000a9',
  kind: 'sale',
  shiftId: null,
  body: {
    operationId: 'f0000000-0000-4000-8000-0000000000a9',
    shiftId: 'f0000000-0000-4000-8000-0000000000b1',
    folio: 'AA-000142',
    total: 26_800,
    lines: [],
    payments: [],
    deviceTime: '2026-10-19T20:42:00.000Z',
  },
  createdAt: '2026-10-19T20:42:00.000Z',
  state: 'pending',
  attempts: 0,
  attention: null,
  ...overrides,
});

describe('a sale that is still in this device', () => {
  it('is read from the operation that waits in the queue', () => {
    expect(localSaleOf(queued())).toEqual({
      operationId: 'f0000000-0000-4000-8000-0000000000a9',
      folio: 'AA-000142',
      total: 26_800,
      at: new Date('2026-10-19T20:42:00.000Z'),
      rejected: false,
    });
  });

  it('says when the server did not accept it', () => {
    expect(
      localSaleOf(
        queued({
          state: 'attention',
          attention: { class: 'permanent', status: 400, code: 'unknown-shift' },
        }),
      )?.rejected,
    ).toBe(true);
  });

  it('is nothing when the operation is not a sale', () => {
    expect(localSaleOf(queued({ kind: 'shift-open' }))).toBeNull();
  });

  it('is nothing when the body is not what a sale writes: it is not shown, not guessed', () => {
    for (const body of [
      {},
      { folio: 'AA-1', total: 'x', deviceTime: '2026-10-19T20:42:00.000Z' },
      { folio: 7, total: 1, deviceTime: '2026-10-19T20:42:00.000Z' },
      { folio: 'AA-1', total: 1, deviceTime: 'ayer' },
      { folio: 'AA-1', total: 1.5, deviceTime: '2026-10-19T20:42:00.000Z' },
    ]) {
      expect(localSaleOf(queued({ body }))).toBeNull();
    }
  });
});
