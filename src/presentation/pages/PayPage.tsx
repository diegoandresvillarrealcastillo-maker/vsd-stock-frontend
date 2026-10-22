import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { formatPesos } from '../../domain/model/quantity';
import {
  PAYMENT_METHODS,
  changeOf,
  parseReceived,
  parseReference,
  quickAmounts,
  type PaymentMethod,
} from '../../domain/model/sale-payment';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useSubmit } from '../forms/use-submit';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { productsLabel } from '../selling/ChargeBar';
import { useSelling } from '../selling/SellingProvider';

const RECEIVED = 'efectivo-recibido';
const REFERENCE = 'referencia-del-cobro';

const CHIP =
  'inline-flex min-h-touch items-center rounded-full border border-border bg-surface-raised px-4 text-base font-medium text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * Cobrar la venta (C3-12, ADR 0027): el total, la forma de pago y, en efectivo, lo que entrega quien compra con su vuelto. Una sola
 * forma de pago por venta. Confirmar guarda la venta en este equipo (no hace falta conexion) y lleva al comprobante.
 */
export function PayPage() {
  const { active } = useLocal();
  const { state: sale, confirm } = useSelling();
  const { pending, problem, submit, clear } = useSubmit();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  // Lo escrito en cada forma de pago se conserva: ir y volver no borra nada.
  const [receivedText, setReceivedText] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [referenceError, setReferenceError] = useState<string | undefined>();

  if (active === null) return null;
  const lines = sale.cart.lines;
  if (lines.length === 0) {
    // Sin nada que cobrar: o no habia venta, o ya se cobro y toca el comprobante.
    return (
      <Navigate to={sale.receipt === null ? '/mostrador' : '/mostrador/comprobante'} replace />
    );
  }

  const total = sale.summary.total.amount;
  const cash = parseReceived(receivedText, total);
  const received = cash.ok ? cash.value : null;
  // Mientras no se haya escrito nada no se regana con un error: se pide con la ayuda del campo.
  const receivedError = receivedText.trim() === '' || cash.ok ? undefined : cash.message;
  const canConfirm = method !== 'cash' || cash.ok;

  function change(action: () => void) {
    action();
    setReferenceError(undefined);
    clear();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (method === 'cash') {
      if (!cash.ok) {
        focusField(RECEIVED);
        return;
      }
      void submit(async () => {
        await confirm({ method: 'cash', received: cash.value });
      });
      return;
    }
    const reference = parseReference(referenceText);
    if (!reference.ok) {
      setReferenceError(reference.message);
      focusField(REFERENCE);
      return;
    }
    void submit(async () => {
      await confirm({ method, reference: reference.value });
    });
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="sr-only">Cobrar</h1>
        <p className="text-sm text-fg-muted">Total a cobrar</p>
        <p className="text-3xl font-semibold tabular-nums text-fg">{formatPesos(total)}</p>
        <p className="text-sm text-fg-muted">{`${productsLabel(lines.length)} · IVA incluido`}</p>
      </div>

      {problem !== null && (
        <FormAlert title="No pudimos cobrar la venta">{problem.message}</FormAlert>
      )}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset disabled={pending} className="flex flex-col gap-1">
          <legend className="text-base font-medium text-fg">Forma de pago</legend>
          <div
            role="radiogroup"
            aria-label="Forma de pago"
            className="grid grid-cols-3 overflow-hidden rounded-md border border-border"
          >
            {PAYMENT_METHODS.map((option) => (
              <label key={option.method} className="relative flex">
                <input
                  type="radio"
                  name="forma-de-pago"
                  value={option.method}
                  checked={method === option.method}
                  onChange={() => {
                    change(() => {
                      setMethod(option.method);
                    });
                  }}
                  className="peer sr-only"
                />
                <span className="flex min-h-touch w-full items-center justify-center px-2 text-center text-base font-medium text-fg peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-focus">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {method === 'cash' ? (
          <>
            <FormField
              id={RECEIVED}
              label="Efectivo recibido"
              value={receivedText}
              onChange={(value) => {
                change(() => {
                  setReceivedText(value);
                });
              }}
              inputMode="numeric"
              autoComplete="off"
              hint="Lo que te entrega quien compra."
              required
              disabled={pending}
              {...(receivedError === undefined ? {} : { error: receivedError })}
            />
            <div role="group" aria-label="Montos rápidos" className="flex flex-wrap gap-2">
              {[
                { label: 'Exacto', amount: total },
                ...quickAmounts(total).map((amount) => ({ label: formatPesos(amount), amount })),
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    change(() => {
                      setReceivedText(String(chip.amount));
                    });
                  }}
                  className={CHIP}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            {received !== null && (
              <div
                role="group"
                aria-label="Vuelto"
                className="flex flex-col gap-1 rounded-lg border-2 border-success bg-surface-raised p-4"
              >
                <p className="text-sm text-fg-muted">Vuelto</p>
                <p className="text-2xl font-semibold tabular-nums text-success">
                  {formatPesos(changeOf(total, received))}
                </p>
              </div>
            )}
          </>
        ) : (
          <FormField
            id={REFERENCE}
            label="Referencia (opcional)"
            value={referenceText}
            onChange={(value) => {
              change(() => {
                setReferenceText(value);
              });
            }}
            autoComplete="off"
            hint="Los últimos dígitos o el número de aprobación."
            disabled={pending}
            {...(referenceError === undefined ? {} : { error: referenceError })}
          />
        )}

        <SubmitButton pending={pending} pendingLabel="Guardando…" disabled={!canConfirm}>
          Confirmar venta
        </SubmitButton>
      </form>

      <Link to="/mostrador" className="text-base font-semibold text-primary underline">
        Volver a la venta
      </Link>
    </>
  );
}
