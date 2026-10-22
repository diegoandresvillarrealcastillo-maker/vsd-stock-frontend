import { memo, useState } from 'react';
import { unitIsWhole, unitShort } from '../../domain/model/catalog';
import {
  formatPesos,
  formatQuantity,
  parseQuantityMilli,
  quantityToInput,
} from '../../domain/model/quantity';
import {
  lineGross,
  lineTotalOf,
  parseDiscount,
  stockWarning,
  type CartLine,
} from '../../domain/model/sale-cart';

const INPUT =
  'min-h-touch rounded-md border bg-surface px-3 text-base text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const TEXT_BUTTON =
  'inline-flex min-h-touch items-center rounded-md px-2 text-sm font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

interface Props {
  line: CartLine;
  /** Lo que la copia sabe que queda de este producto, en milesimas; `null` si no sabe. */
  stockMilli: number | null;
  onQuantity: (productId: string, quantityMilli: number) => void;
  onDiscount: (productId: string, discount: number) => void;
  onRemove: (productId: string) => void;
}

/** Que se dice de la cantidad que se esta escribiendo: lo que esta mal, o nada si sirve. */
function quantityProblem(text: string, whole: boolean): string | null {
  const parsed = parseQuantityMilli(text, { whole });
  if (!parsed.ok) return parsed.message;
  return parsed.value < 1 ? 'La cantidad no puede ser cero.' : null;
}

/**
 * Una linea de la venta (el componente «Linea de venta» del diseno): el producto, su precio por unidad, la cantidad que se
 * escribe (con coma para lo que se pesa), la rebaja y lo que cuesta. Solo se dibuja de nuevo cuando CAMBIA su linea o lo que
 * queda del producto: con un carrito largo, tocar una linea no mueve a las demas.
 */
export const CartLineRow = memo(function CartLineRow({
  line,
  stockMilli,
  onQuantity,
  onDiscount,
  onRemove,
}: Props) {
  const whole = unitIsWhole(line.unit);
  // Mientras se escribe, lo escrito manda; al salir del campo vuelve a ser lo que dice la linea.
  const [typed, setTyped] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [discountText, setDiscountText] = useState('');
  const [discountError, setDiscountError] = useState<string | null>(null);

  const problem = typed === null ? null : quantityProblem(typed, whole);
  const warning = stockWarning(line, stockMilli);

  function changeQuantity(text: string) {
    setTyped(text);
    if (quantityProblem(text, whole) !== null) return;
    const parsed = parseQuantityMilli(text, { whole });
    if (parsed.ok && parsed.value !== line.quantityMilli) onQuantity(line.productId, parsed.value);
  }

  function openDiscount() {
    setDiscountText(line.discount > 0 ? String(line.discount) : '');
    setDiscountError(null);
    setEditing(true);
  }

  function applyDiscount() {
    const parsed = parseDiscount(discountText, lineGross(line));
    if (!parsed.ok) {
      setDiscountError(parsed.message);
      return;
    }
    onDiscount(line.productId, parsed.value);
    setEditing(false);
  }

  function removeDiscount() {
    onDiscount(line.productId, 0);
    setEditing(false);
  }

  const quantityId = `cantidad-${line.productId}`;
  const discountId = `descuento-${line.productId}`;
  return (
    <li
      aria-label={line.name}
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-base font-semibold text-fg">{line.name}</p>
        <p className="shrink-0 text-base font-semibold tabular-nums text-fg">
          {formatPesos(lineTotalOf(line))}
        </p>
      </div>
      <p className="text-sm text-fg-muted">{`${formatPesos(line.unitPrice)} c/u`}</p>
      {line.discount > 0 && (
        <p className="text-sm text-accent-text">{`Descuento − ${formatPesos(line.discount)}`}</p>
      )}
      {warning !== null && (
        <p className="text-sm font-medium text-accent-text">
          {warning.kind === 'none'
            ? 'Sin existencias'
            : `Quedan ${formatQuantity(warning.leftMilli)}`}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={quantityId}
          aria-label={`Cantidad de ${line.name}`}
          inputMode="decimal"
          autoComplete="off"
          value={typed ?? quantityToInput(line.quantityMilli)}
          aria-invalid={problem === null ? undefined : true}
          onChange={(event) => {
            changeQuantity(event.target.value);
          }}
          onBlur={() => {
            setTyped(null);
          }}
          className={`${INPUT} w-24 text-center ${problem === null ? 'border-border' : 'border-2 border-accent-text'}`}
        />
        {line.unit !== 'unit' && (
          <span className="text-sm text-fg-muted">{unitShort(line.unit)}</span>
        )}
        <button
          type="button"
          onClick={
            editing
              ? () => {
                  setEditing(false);
                }
              : openDiscount
          }
          aria-expanded={editing}
          className={TEXT_BUTTON}
        >
          Descuento
        </button>
        <button
          type="button"
          aria-label={`Quitar ${line.name}`}
          onClick={() => {
            onRemove(line.productId);
          }}
          className={TEXT_BUTTON}
        >
          Quitar
        </button>
      </div>
      {problem !== null && <p className="text-sm text-accent-text">{problem}</p>}
      {editing && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
          <input
            id={discountId}
            aria-label={`Descuento en pesos de ${line.name}`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={discountText}
            aria-invalid={discountError === null ? undefined : true}
            onChange={(event) => {
              setDiscountText(event.target.value);
              setDiscountError(null);
            }}
            className={`${INPUT} w-full ${discountError === null ? 'border-border' : 'border-2 border-accent-text'}`}
          />
          {discountError !== null && <p className="text-sm text-accent-text">{discountError}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyDiscount}
              className="inline-flex min-h-touch items-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Aplicar descuento
            </button>
            {line.discount > 0 && (
              <button type="button" onClick={removeDiscount} className={TEXT_BUTTON}>
                Quitar descuento
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
});
