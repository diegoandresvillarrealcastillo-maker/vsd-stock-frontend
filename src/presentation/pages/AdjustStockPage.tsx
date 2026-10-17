import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { unitIsWhole, unitShort } from '../../domain/model/catalog';
import type { StockItem } from '../../domain/model/inventory';
import { formatQuantity, parseQuantityMilli } from '../../domain/model/quantity';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { LinkButton } from '../components/LinkButton';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useLoad } from '../forms/use-load';
import { useSubmit } from '../forms/use-submit';
import { useInventory } from '../inventory/InventoryProvider';

/** Lo mas largo que acepta el servidor para el motivo de un ajuste. */
const MAX_REASON = 500;

type Direction = 'add' | 'subtract';

interface Missing {
  direction?: string;
  quantity?: string;
  reason?: string;
}

function Back({ productId }: { productId: string }) {
  return (
    <Link
      to={`/inventario/${encodeURIComponent(productId)}`}
      className="text-sm font-medium text-primary underline"
    >
      Volver al historial
    </Link>
  );
}

function AdjustForm({ item }: { item: StockItem }) {
  const inventory = useInventory();
  const navigate = useNavigate();
  const { pending, problem, submit, clear } = useSubmit();
  // La llave de idempotencia (ADR 0019): una por pantalla. Si el envio falla, se reintenta con la misma, y el servidor no ajusta
  // dos veces aunque la primera respuesta se haya perdido.
  const [operationId] = useState(() => crypto.randomUUID());
  const [direction, setDirection] = useState<Direction | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState<Missing>({});

  const short = unitShort(item.unit);
  const whole = unitIsWhole(item.unit);
  const parsed = parseQuantityMilli(quantity, { whole });
  const historyPath = `/inventario/${encodeURIComponent(item.productId)}`;

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setMissing({});
      clear();
    };
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const lacking: Missing = {};
    if (direction === null) lacking.direction = 'Elige si suma o resta.';
    if (!parsed.ok) lacking.quantity = parsed.message;
    else if (parsed.value === 0) lacking.quantity = 'La cantidad no puede ser cero.';
    if (reason.trim() === '') lacking.reason = 'Escribe el motivo del ajuste.';
    else if (reason.trim().length > MAX_REASON) {
      lacking.reason = `El motivo es muy largo: ${String(MAX_REASON)} letras como máximo.`;
    }
    setMissing(lacking);
    if (lacking.direction !== undefined) {
      document.querySelector<HTMLInputElement>('input[name="sentido"]')?.focus();
      return;
    }
    if (lacking.quantity !== undefined) return focusField('cantidad');
    if (lacking.reason !== undefined) return focusField('motivo');
    if (direction === null || !parsed.ok) return;

    const deltaMilli = direction === 'add' ? parsed.value : -parsed.value;
    void submit(async () => {
      const result = await inventory.adjust({
        operationId,
        productId: item.productId,
        deltaMilli,
        reason: reason.trim(),
      });
      void navigate(historyPath, {
        state: {
          notice: result.replayed
            ? 'Ese ajuste ya estaba registrado: la existencia no cambió otra vez.'
            : 'Ajuste guardado.',
        },
      });
    });
  }

  const fields = problem?.fields ?? {};
  const quantityHint = whole
    ? `En unidades enteras (${short}).`
    : `En ${short}. Usa coma para los decimales.`;
  const resulting =
    direction !== null && parsed.ok && parsed.value > 0
      ? ` Quedarían ${formatQuantity(item.quantityMilli + (direction === 'add' ? parsed.value : -parsed.value))} ${short}.`
      : '';
  const quantityError = missing.quantity ?? fields['/deltaMilli'];
  const reasonError = missing.reason ?? fields['/reason'];

  return (
    <>
      {problem !== null && (
        <>
          <FormAlert title="No pudimos guardar el ajuste">{problem.message}</FormAlert>
          {problem.code === 'operation-id-reused' && (
            <LinkButton to={historyPath} variant="accent">
              Ver el historial
            </LinkButton>
          )}
        </>
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset disabled={pending} className="flex flex-col gap-1">
          <legend className="text-base font-medium text-fg">¿Qué pasó?</legend>
          <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border">
            {(
              [
                { value: 'add', label: 'Sumar' },
                { value: 'subtract', label: 'Restar' },
              ] as const
            ).map((option) => (
              <label key={option.value} className="relative flex">
                <input
                  type="radio"
                  name="sentido"
                  value={option.value}
                  checked={direction === option.value}
                  onChange={() => change(setDirection)(option.value)}
                  className="peer sr-only"
                />
                <span className="inline-flex min-h-touch w-full items-center justify-center border-r border-border bg-surface-raised text-base text-fg last:border-r-0 peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-focus">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
          {missing.direction !== undefined && (
            <p className="text-sm text-accent-text">{missing.direction}</p>
          )}
        </fieldset>
        <FormField
          id="cantidad"
          label="Cuánto"
          inputMode="decimal"
          autoComplete="off"
          value={quantity}
          onChange={change(setQuantity)}
          disabled={pending}
          required
          hint={`${quantityHint}${resulting}`}
          {...(quantityError === undefined ? {} : { error: quantityError })}
        />
        <FormField
          id="motivo"
          label="Motivo (obligatorio)"
          autoComplete="off"
          value={reason}
          onChange={change(setReason)}
          disabled={pending}
          required
          hint="Queda escrito en el historial."
          {...(reasonError === undefined ? {} : { error: reasonError })}
        />
        <SubmitButton pending={pending}>Guardar ajuste</SubmitButton>
      </form>
    </>
  );
}

/** Ajustar la existencia de un producto (ADR 0013): el ajuste es un movimiento mas, nunca se edita el numero a mano. */
export function AdjustStockPage() {
  const { productId = '' } = useParams();
  const inventory = useInventory();
  const { state, reload } = useLoad(() => inventory.findStock(productId), [productId]);

  if (state.status === 'failed' && state.problem.code === 'product-not-found') {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-fg">No encontramos ese producto</h1>
        <p className="text-base text-fg-muted">
          Puede que la dirección esté mal escrita. Vuelve a las existencias para ver tus productos.
        </p>
        <LinkButton to="/inventario">Ver las existencias</LinkButton>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <Back productId={productId} />
      {state.status === 'loading' && <RowsSkeleton label="Cargando…" rows={2} />}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar el producto"
          message={state.problem.message}
          onRetry={reload}
        />
      )}
      {state.status === 'ready' && state.data === null && (
        <LoadFailed
          title="No pudimos saber cuánto hay de este producto"
          message="Sin eso no se puede ajustar. Inténtalo de nuevo."
          onRetry={reload}
        />
      )}
      {state.status === 'ready' && state.data !== null && (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-fg">Ajustar existencia</h1>
            <p className="text-base text-fg-muted">
              {`${state.data.name} · hoy hay ${formatQuantity(state.data.quantityMilli)} ${unitShort(state.data.unit)}. Esto agrega un movimiento; no cambia el número a mano.`}
            </p>
          </div>
          <AdjustForm key={state.data.productId} item={state.data} />
        </>
      )}
    </section>
  );
}
