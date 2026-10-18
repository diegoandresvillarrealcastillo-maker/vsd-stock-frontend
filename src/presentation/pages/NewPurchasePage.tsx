import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { unitIsWhole, unitShort, type Product } from '../../domain/model/catalog';
import {
  formatPesos,
  formatQuantity,
  parsePesos,
  parseQuantityMilli,
} from '../../domain/model/quantity';
import type { PurchaseLine } from '../../domain/model/purchasing';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { LinkButton } from '../components/LinkButton';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useLoad } from '../forms/use-load';
import { useSubmit } from '../forms/use-submit';
import { usePurchasing } from '../purchasing/PurchasingProvider';
import { ProductPicker } from '../purchasing/ProductPicker';
import type { Supplier } from '../../domain/model/purchasing';

interface Line extends PurchaseLine {
  readonly product: Product;
}

interface DraftProblems {
  product?: string;
  quantity?: string;
  cost?: string;
}

const REPLAYED_NOTICE =
  'Ya estaba registrada. La conexión falló antes de ver la respuesta y la enviamos otra vez; la existencia subió una sola vez.';

/** Los problemas por linea que dice el servidor: `/lines/1/quantityMilli` es un problema de la linea 2 (la cuenta empieza en 0). */
function lineProblems(fields: Readonly<Record<string, string>>): Map<number, string[]> {
  const found = new Map<number, string[]>();
  for (const [pointer, detail] of Object.entries(fields)) {
    const match = /^\/lines\/(\d+)\//.exec(pointer);
    if (match === null) continue;
    const index = Number(match[1]);
    found.set(index, [...(found.get(index) ?? []), detail]);
  }
  return found;
}

function PurchaseForm({ suppliers }: { suppliers: readonly Supplier[] }) {
  const purchasing = usePurchasing();
  const navigate = useNavigate();
  const { pending, problem, submit, clear } = useSubmit();
  // La llave de idempotencia (ADR 0019): una por pantalla. Si el envio falla, se reintenta con la misma, y el servidor no cuenta la
  // compra dos veces aunque la primera respuesta se haya perdido.
  const [operationId] = useState(() => crypto.randomUUID());
  const [supplierId, setSupplierId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<readonly Line[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [draftProblems, setDraftProblems] = useState<DraftProblems>({});
  const [noLines, setNoLines] = useState(false);

  /** Lee la linea que se esta escribiendo. Devuelve la linea, o dice lo que le falta. */
  function readDraft(): { line: Line } | { problems: DraftProblems } {
    const problems: DraftProblems = {};
    if (product === null) problems.product = 'Elige un producto.';
    else if (lines.some((line) => line.productId === product.id)) {
      problems.product = 'Ese producto ya está en la compra: quita esa línea o cambia su cantidad.';
    }
    const parsedQuantity = parseQuantityMilli(quantity, {
      whole: product === null ? false : unitIsWhole(product.unit),
    });
    if (!parsedQuantity.ok) problems.quantity = parsedQuantity.message;
    else if (parsedQuantity.value === 0) problems.quantity = 'La cantidad no puede ser cero.';
    const parsedCost = parsePesos(cost);
    if (!parsedCost.ok) problems.cost = parsedCost.message;
    if (
      product === null ||
      !parsedQuantity.ok ||
      !parsedCost.ok ||
      Object.keys(problems).length > 0
    ) {
      return { problems };
    }
    return {
      line: {
        product,
        productId: product.id,
        quantityMilli: parsedQuantity.value,
        unitCost: parsedCost.value,
      },
    };
  }

  function focusFirst(problems: DraftProblems) {
    if (problems.product !== undefined) return focusField('producto');
    if (problems.quantity !== undefined) return focusField('cantidad');
    if (problems.cost !== undefined) return focusField('costo');
  }

  function resetDraft() {
    setProduct(null);
    setQuantity('');
    setCost('');
    setDraftProblems({});
  }

  function changed() {
    setNoLines(false);
    setDraftProblems({});
    clear();
  }

  function onAddLine(event: FormEvent) {
    event.preventDefault();
    const read = readDraft();
    if ('problems' in read) {
      setDraftProblems(read.problems);
      return focusFirst(read.problems);
    }
    setLines([...lines, read.line]);
    resetDraft();
    clear();
    setNoLines(false);
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, position) => position !== index));
    changed();
  }

  function onRegister() {
    // Lo que se esta escribiendo se suma si esta completo, para no perderlo; si esta a medias, se dice que le falta.
    const started = product !== null || quantity.trim() !== '' || cost.trim() !== '';
    let all = lines;
    if (started) {
      const read = readDraft();
      if ('problems' in read) {
        setDraftProblems(read.problems);
        return focusFirst(read.problems);
      }
      all = [...lines, read.line];
    }
    if (all.length === 0) {
      setNoLines(true);
      return;
    }
    if (started) {
      setLines(all);
      resetDraft();
    }
    void submit(async () => {
      const result = await purchasing.createPurchase({
        operationId,
        supplierId: supplierId === '' ? null : supplierId,
        note: note.trim() === '' ? null : note.trim(),
        lines: all.map((line) => ({
          productId: line.productId,
          quantityMilli: line.quantityMilli,
          unitCost: line.unitCost,
        })),
      });
      void navigate('/compras', {
        state: {
          notice: result.replayed ? REPLAYED_NOTICE : 'Compra registrada: la existencia ya subió.',
        },
      });
    });
  }

  const fields = problem?.fields ?? {};
  const perLine = lineProblems(fields);
  const short = product === null ? null : unitShort(product.unit);
  const quantityHint =
    product === null || short === null
      ? undefined
      : unitIsWhole(product.unit)
        ? `En ${short}.`
        : `En ${short}. Usa coma para los decimales.`;

  return (
    <>
      {problem !== null && (
        <>
          <FormAlert title="No pudimos registrar la compra">{problem.message}</FormAlert>
          {problem.code === 'operation-id-reused' && (
            <LinkButton to="/compras" variant="accent">
              Ver las compras
            </LinkButton>
          )}
        </>
      )}
      <FormField
        id="proveedor"
        label="Proveedor (opcional)"
        value={supplierId}
        onChange={(value) => {
          setSupplierId(value);
          changed();
        }}
        disabled={pending}
        options={[
          { value: '', label: 'Sin proveedor' },
          ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
        ]}
        {...(fields['/supplierId'] === undefined ? {} : { error: fields['/supplierId'] })}
      />
      <FormField
        id="nota"
        label="Nota (opcional)"
        autoComplete="off"
        value={note}
        onChange={(value) => {
          setNote(value);
          changed();
        }}
        disabled={pending}
        {...(fields['/note'] === undefined ? {} : { error: fields['/note'] })}
      />
      {lines.length > 0 && (
        <ol aria-label="Líneas de la compra" className="flex flex-col gap-3">
          {lines.map((line, index) => (
            <li
              key={line.productId}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3"
            >
              <p className="text-base font-medium text-fg">{`Línea ${String(index + 1)}`}</p>
              <p className="text-sm text-fg-muted">
                {`${line.product.name} · ${formatQuantity(line.quantityMilli)} ${unitShort(line.product.unit)} · ${formatPesos(line.unitCost)} cada ${unitShort(line.product.unit)}`}
              </p>
              {perLine.get(index)?.map((detail) => (
                <p key={detail} className="text-sm text-accent-text">
                  {detail}
                </p>
              ))}
              <div>
                <button
                  type="button"
                  aria-label={`Quitar la línea ${String(index + 1)}`}
                  disabled={pending}
                  onClick={() => removeLine(index)}
                  className="inline-flex min-h-touch items-center text-sm font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <ProductPicker
        value={product}
        onChange={(chosen) => {
          setProduct(chosen);
          changed();
        }}
        disabled={pending}
        {...(draftProblems.product === undefined ? {} : { error: draftProblems.product })}
      />
      {product !== null && draftProblems.product !== undefined && (
        <p className="text-sm text-accent-text">{draftProblems.product}</p>
      )}
      <form noValidate onSubmit={onAddLine} className="flex flex-col gap-4">
        <FormField
          id="cantidad"
          label="Cantidad"
          inputMode="decimal"
          autoComplete="off"
          value={quantity}
          onChange={(value) => {
            setQuantity(value);
            changed();
          }}
          disabled={pending}
          {...(quantityHint === undefined ? {} : { hint: quantityHint })}
          {...(draftProblems.quantity === undefined ? {} : { error: draftProblems.quantity })}
        />
        <FormField
          id="costo"
          label="Costo por unidad"
          inputMode="numeric"
          autoComplete="off"
          value={cost}
          onChange={(value) => {
            setCost(value);
            changed();
          }}
          disabled={pending}
          hint="Pesos enteros, sin puntos."
          {...(draftProblems.cost === undefined ? {} : { error: draftProblems.cost })}
        />
        <SubmitButton pending={false} variant="accent">
          Agregar línea
        </SubmitButton>
      </form>
      {noLines && <FormAlert title="Falta algo">Agrega al menos una línea.</FormAlert>}
      <SubmitButton pending={pending} onClick={onRegister}>
        Registrar compra
      </SubmitButton>
    </>
  );
}

/** Registrar una compra (ADR 0019): la mercancia que llego sube la existencia de cada producto en una sola operacion. */
export function NewPurchasePage() {
  const purchasing = usePurchasing();
  const { state, reload } = useLoad(() => purchasing.listAllSuppliers(), []);

  return (
    <section className="flex flex-col gap-4">
      <Link to="/compras" className="text-sm font-medium text-primary underline">
        Volver a compras
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Nueva compra</h1>
        <p className="text-base text-fg-muted">
          Registra lo que llegó. Sube la existencia de una sola vez.
        </p>
      </div>
      {state.status === 'loading' && <RowsSkeleton label="Cargando…" rows={2} />}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar los proveedores"
          message={state.problem.message}
          onRetry={reload}
        />
      )}
      {state.status === 'ready' && <PurchaseForm suppliers={state.data} />}
    </section>
  );
}
