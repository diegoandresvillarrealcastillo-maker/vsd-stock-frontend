import { Money } from './money';
import { divideRounded } from './rounding';

/**
 * Las tarifas de IVA del catalogo, en puntos basicos (1 % = 100): exento o excluido,
 * reducida y general. HIPOTESIS pendiente de verificar con quien lleve la contabilidad
 * del negocio de referencia (ADR 0014); la aritmetica sirve para cualquier tarifa.
 */
export const TAX_RATES_BP: readonly number[] = [0, 500, 1900];

/**
 * El tipo tributario de un producto y de cada linea que se vende (ADR 0034 del backend): gravado lleva 5 % o 19 %; exento y excluido
 * llevan 0 %. Para el calculo da igual, pero para declarar van en renglones distintos. El sistema no sabe cual producto es cual:
 * guarda lo que el negocio le dice.
 */
export const TAX_KINDS = ['taxed', 'exempt', 'excluded'] as const;
export type TaxKind = (typeof TAX_KINDS)[number];

export function isTaxKind(value: unknown): value is TaxKind {
  return TAX_KINDS.includes(value as TaxKind);
}

/** Si el tipo cabe con la tarifa: lo gravado lleva 5 % o 19 %, y lo exento o excluido, 0 %. La base de datos rechaza lo que no cabe. */
export function taxKindFitsRate(kind: TaxKind, rateBp: number): boolean {
  return kind === 'taxed' ? rateBp !== 0 && TAX_RATES_BP.includes(rateBp) : rateBp === 0;
}

/**
 * El tipo de algo que se guardo antes de que existiera el tipo: lo que la migracion del backend le da a las filas que ya tenia
 * (gravado si lleva IVA, exento si no). Es un valor de arranque, no una clasificacion: el negocio lo corrige producto por producto.
 */
export function startingTaxKind(rateBp: number): TaxKind {
  return rateBp > 0 ? 'taxed' : 'exempt';
}

const KIND_LABELS: Record<TaxKind, string> = {
  taxed: 'Gravado',
  exempt: 'Exento',
  excluded: 'Excluido',
};

export function taxKindLabel(kind: TaxKind): string {
  return KIND_LABELS[kind];
}

/** Lo que se ofrece al crear o cambiar un producto: cada tipo con la tarifa que le cabe, la general primero. */
export const TAX_CHOICES: readonly { readonly kind: TaxKind; readonly rateBp: number }[] = [
  { kind: 'taxed', rateBp: 1900 },
  { kind: 'taxed', rateBp: 500 },
  { kind: 'exempt', rateBp: 0 },
  { kind: 'excluded', rateBp: 0 },
];

const BASIS_POINTS = 10_000;

export interface TaxBreakdown {
  /** Base gravable: el precio sin el impuesto, redondeada al peso. */
  readonly base: Money;
  /** El impuesto: lo que queda del total despues de la base. */
  readonly tax: Money;
}

/** Lanza RangeError si la tarifa no es un numero entero de puntos basicos entre 0 y 10.000. */
export function assertTaxRate(rateBp: number): void {
  if (!Number.isInteger(rateBp) || rateBp < 0 || rateBp > BASIS_POINTS) {
    throw new RangeError(
      `A tax rate is whole basis points between 0 and ${BASIS_POINTS}: ${String(rateBp)}`,
    );
  }
}

/**
 * Separa el impuesto de un total que ya lo incluye (ADR 0014).
 *
 * La base se redondea al peso mas cercano y el impuesto es lo que sobra, no un segundo
 * redondeo: asi `base + impuesto == total` siempre, sin un peso de mas ni de menos, y
 * ninguno de los dos se aleja mas de medio peso de su valor exacto.
 */
export function splitTaxIncluded(total: Money, rateBp: number): TaxBreakdown {
  assertTaxRate(rateBp);
  const base = divideRounded(
    BigInt(total.amount) * BigInt(BASIS_POINTS),
    BigInt(BASIS_POINTS + rateBp),
  );
  const taxableBase = Money.of(Number(base));
  return { base: taxableBase, tax: total.subtract(taxableBase) };
}
