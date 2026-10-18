import { useState, type FormEvent } from 'react';
import { ApiError } from '../../domain/model/api-error';
import {
  UNITS,
  isUnit,
  taxLabel,
  unitIsWhole,
  unitLabel,
  unitShort,
  type Category,
  type Product,
  type UnitCode,
} from '../../domain/model/catalog';
import { Money } from '../../domain/model/money';
import {
  formatPesos,
  formatQuantity,
  parsePesos,
  parseQuantityMilli,
  quantityToInput,
} from '../../domain/model/quantity';
import { splitTaxIncluded, TAX_RATES_BP } from '../../domain/model/tax';
import type { ProductChange } from '../../domain/ports/in/catalog';
import { Button } from '../components/Button';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { LinkButton } from '../components/LinkButton';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useSubmit } from '../forms/use-submit';
import { useCatalog } from './CatalogProvider';

type Saved = 'no' | 'saved' | 'unchanged' | 'archived' | 'reactivated';

interface Conflict {
  readonly field: 'sku' | 'barcode';
  readonly value: string;
  /** Quien lo tiene, o `null` si no se pudo saber. */
  readonly holder: Product | null;
}

interface Missing {
  name?: string;
  sku?: string;
  price?: string;
  minStock?: string;
}

const SAVED_TEXT: Record<Exclude<Saved, 'no'>, string> = {
  saved: 'Cambios guardados.',
  unchanged: 'No hiciste ningún cambio.',
  archived: 'Producto archivado. Ya no se vende, pero conserva su historia.',
  reactivated: 'Producto reactivado. Ya se puede vender.',
};

/** Lo que dice el aviso de arriba cuando el servidor dice que el SKU o el codigo de barras ya es de otro producto. */
function ConflictAlert({ conflict }: { conflict: Conflict & { holder: Product } }) {
  const { field, value, holder } = conflict;
  const what = field === 'sku' ? 'SKU' : 'código de barras';
  const archived = !holder.active;
  const advice = archived
    ? `Puedes reactivarlo en vez de crear uno nuevo, o usar otro ${what === 'SKU' ? 'SKU' : 'código'}.`
    : `Usa otro ${what === 'SKU' ? 'SKU' : 'código'}.`;
  return (
    <>
      <FormAlert
        title={`Ese ${what} ya lo tiene otro producto`}
      >{`${value} es de «${holder.name}»${archived ? ', que está archivado' : ''}. ${advice}`}</FormAlert>
      <LinkButton to={`/catalogo/${encodeURIComponent(holder.id)}`} variant="accent">
        {archived ? 'Ver el producto archivado' : 'Ver el producto'}
      </LinkButton>
    </>
  );
}

/**
 * El formulario de un producto, para crearlo (sin `product`) o para cambiarlo (con el producto que se cambia). Valida lo que
 * puede antes de molestar al servidor, y cuando el servidor dice que el SKU o el codigo de barras ya es de otro producto,
 * dice de cual. Un producto no se borra: se archiva (ADR 0015).
 */
export function ProductForm({
  categories,
  product,
  onCreated,
  onChanged,
}: {
  categories: readonly Category[];
  product?: Product;
  /** Se llama con el producto recien creado. */
  onCreated?: (created: Product) => void;
  /** Se llama con el producto tal como quedo despues de guardar un cambio, archivarlo o reactivarlo. */
  onChanged?: (changed: Product) => void;
}) {
  const catalog = useCatalog();
  const { pending, problem, submit, clear } = useSubmit();
  // En edicion, `base` es lo ultimo que el servidor guardo; los campos parten de ahi.
  const [base, setBase] = useState<Product | undefined>(product);
  const [name, setName] = useState(product?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [unit, setUnit] = useState<UnitCode>(product?.unit ?? 'unit');
  const [price, setPrice] = useState(product === undefined ? '' : String(product.unitPrice));
  const [taxRateBp, setTaxRateBp] = useState(product?.taxRateBp ?? 0);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const [minStock, setMinStock] = useState(
    product?.minStockMilli == null ? '' : quantityToInput(product.minStockMilli),
  );
  const [missing, setMissing] = useState<Missing>({});
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [saved, setSaved] = useState<Saved>('no');

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setMissing({});
      setConflict(null);
      setSaved('no');
      clear();
    };
  }

  function show(updated: Product) {
    onChanged?.(updated);
    setBase(updated);
    setName(updated.name);
    setSku(updated.sku);
    setBarcode(updated.barcode ?? '');
    setUnit(updated.unit);
    setPrice(String(updated.unitPrice));
    setTaxRateBp(updated.taxRateBp);
    setCategoryId(updated.categoryId ?? '');
    setMinStock(updated.minStockMilli === null ? '' : quantityToInput(updated.minStockMilli));
  }

  const parsedPrice = parsePesos(price);
  const parsedMin =
    minStock.trim() === '' ? null : parseQuantityMilli(minStock, { whole: unitIsWhole(unit) });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved('no');
    setConflict(null);
    const lacking: Missing = {};
    if (name.trim() === '') lacking.name = 'Escribe el nombre del producto.';
    if (sku.trim() === '') lacking.sku = 'Escribe el SKU.';
    if (!parsedPrice.ok) lacking.price = parsedPrice.message;
    if (parsedMin !== null && !parsedMin.ok) lacking.minStock = parsedMin.message;
    setMissing(lacking);
    if (lacking.name !== undefined) return focusField('nombre');
    if (lacking.sku !== undefined) return focusField('sku');
    if (lacking.price !== undefined) return focusField('precio');
    if (lacking.minStock !== undefined) return focusField('minimo');
    if (!parsedPrice.ok) return;
    const unitPrice = parsedPrice.value;
    const minStockMilli = parsedMin === null || !parsedMin.ok ? null : parsedMin.value;
    const barcodeValue = barcode.trim() === '' ? null : barcode.trim();
    const category = categoryId === '' ? null : categoryId;

    void submit(async () => {
      try {
        if (base === undefined) {
          const created = await catalog.createProduct({
            name: name.trim(),
            sku: sku.trim(),
            barcode: barcodeValue,
            unit,
            unitPrice,
            taxRateBp,
            categoryId: category,
            minStockMilli,
          });
          onCreated?.(created);
          return;
        }
        const changes: ProductChange = {};
        if (name.trim() !== base.name) changes.name = name.trim();
        if (sku.trim() !== base.sku) changes.sku = sku.trim();
        if (barcodeValue !== base.barcode) changes.barcode = barcodeValue;
        if (unit !== base.unit) changes.unit = unit;
        if (unitPrice !== base.unitPrice) changes.unitPrice = unitPrice;
        if (taxRateBp !== base.taxRateBp) changes.taxRateBp = taxRateBp;
        if (category !== base.categoryId) changes.categoryId = category;
        if (minStockMilli !== base.minStockMilli) changes.minStockMilli = minStockMilli;
        if (Object.keys(changes).length === 0) {
          setSaved('unchanged');
          return;
        }
        show(await catalog.updateProduct(base.id, changes));
        setSaved('saved');
      } catch (error) {
        if (error instanceof ApiError) {
          const code = error.failure.problem?.code;
          if (code === 'sku-taken' || code === 'barcode-taken') {
            const field = code === 'sku-taken' ? 'sku' : 'barcode';
            const value = field === 'sku' ? sku.trim() : barcode.trim();
            // Decir CUAL producto lo tiene es lo que le deja a la persona decidir: si no se puede saber, se dice lo general.
            const holder = await catalog.findProductByCode(field, value).catch(() => null);
            setConflict({ field, value, holder });
          }
        }
        throw error;
      }
    });
  }

  function toggleActive() {
    if (base === undefined) return;
    const archiving = base.active;
    setSaved('no');
    void submit(async () => {
      show(await catalog.updateProduct(base.id, { active: !archiving }));
      setSaved(archiving ? 'archived' : 'reactivated');
    });
  }

  const fields = problem?.fields ?? {};
  const holder = conflict?.holder ?? null;
  const skuError =
    missing.sku ??
    (problem?.code === 'sku-taken'
      ? holder !== null && !holder.active
        ? 'Ya existe. Cambia el SKU o reactiva el producto archivado.'
        : holder !== null
          ? 'Ya existe. Usa otro SKU.'
          : problem.message
      : fields['/sku']);
  const barcodeError =
    problem?.code === 'barcode-taken'
      ? holder !== null
        ? `Ese código ya es de «${holder.name}»${holder.active ? '' : ' (archivado)'}.`
        : problem.message
      : fields['/barcode'];
  const unitError = problem?.code === 'unit-locked' ? problem.message : fields['/unit'];

  const priceHint = parsedPrice.ok
    ? `Se verá como ${formatPesos(parsedPrice.value)}.`
    : 'Solo números, sin puntos ni comas. Por ejemplo: 3200.';
  const taxHint = parsedPrice.ok
    ? `De ${formatPesos(parsedPrice.value)} con IVA ${taxLabel(taxRateBp)}, el IVA es ${formatPesos(
        splitTaxIncluded(Money.of(parsedPrice.value), taxRateBp).tax.amount,
      )}.`
    : undefined;
  const minHint =
    parsedMin !== null && parsedMin.ok
      ? `Te avisamos cuando haya menos de ${formatQuantity(parsedMin.value)} ${unitShort(unit)}.`
      : 'Opcional. Te avisamos cuando la existencia baje de este número.';

  return (
    <>
      {saved !== 'no' && (
        <p role="status" className="text-sm font-medium text-success">
          {SAVED_TEXT[saved]}
        </p>
      )}
      {conflict?.holder != null ? (
        <ConflictAlert conflict={{ ...conflict, holder: conflict.holder }} />
      ) : (
        problem !== null && (
          <FormAlert title="No pudimos guardar el producto">{problem.message}</FormAlert>
        )
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          id="nombre"
          label="Nombre"
          autoComplete="off"
          value={name}
          onChange={change(setName)}
          disabled={pending}
          required
          {...(missing.name !== undefined
            ? { error: missing.name }
            : fields['/name'] === undefined
              ? {}
              : { error: fields['/name'] })}
        />
        <FormField
          id="sku"
          label="SKU (código interno)"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={sku}
          onChange={change(setSku)}
          disabled={pending}
          required
          hint="Letras sin acento, números y . _ / -. No se repite en tu negocio."
          {...(skuError === undefined ? {} : { error: skuError })}
        />
        <FormField
          id="codigo-de-barras"
          label="Código de barras (opcional)"
          autoComplete="off"
          inputMode="numeric"
          spellCheck={false}
          value={barcode}
          onChange={change(setBarcode)}
          disabled={pending}
          hint="Lo lees con la cámara o el lector. 8, 12, 13 o 14 dígitos."
          {...(barcodeError === undefined ? {} : { error: barcodeError })}
        />
        <FormField
          id="unidad"
          label="Unidad"
          value={unit}
          onChange={change((value: string) => setUnit(isUnit(value) ? value : unit))}
          disabled={pending}
          options={UNITS.map((option) => ({ value: option.code, label: unitLabel(option.code) }))}
          hint="Cada presentación (unidad, paca, caja) es otro producto."
          {...(unitError === undefined ? {} : { error: unitError })}
        />
        <FormField
          id="precio"
          label="Precio de venta (IVA incluido)"
          inputMode="numeric"
          autoComplete="off"
          value={price}
          onChange={change(setPrice)}
          disabled={pending}
          required
          hint={priceHint}
          {...(missing.price !== undefined
            ? { error: missing.price }
            : fields['/unitPrice'] === undefined
              ? {}
              : { error: fields['/unitPrice'] })}
        />
        <fieldset aria-describedby="iva-mensaje" disabled={pending} className="flex flex-col gap-1">
          <legend className="text-base font-medium text-fg">IVA</legend>
          <div className="grid grid-cols-3 overflow-hidden rounded-md border border-border">
            {TAX_RATES_BP.map((rate) => (
              <label key={rate} className="relative flex">
                <input
                  type="radio"
                  name="iva"
                  value={rate}
                  checked={taxRateBp === rate}
                  onChange={() => change(setTaxRateBp)(rate)}
                  className="peer sr-only"
                />
                <span className="inline-flex min-h-touch w-full items-center justify-center border-r border-border bg-surface-raised text-base text-fg last:border-r-0 peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-focus">
                  {taxLabel(rate)}
                </span>
              </label>
            ))}
          </div>
          <p id="iva-mensaje" className="text-sm text-fg-muted">
            {taxHint ?? 'Escribe el precio para ver cuánto IVA lleva.'}
          </p>
        </fieldset>
        <FormField
          id="categoria"
          label="Categoría"
          value={categoryId}
          onChange={change(setCategoryId)}
          disabled={pending}
          options={[
            { value: '', label: 'Sin categoría' },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
          {...(fields['/categoryId'] === undefined ? {} : { error: fields['/categoryId'] })}
        />
        <FormField
          id="minimo"
          label="Existencia mínima (opcional)"
          inputMode="decimal"
          autoComplete="off"
          value={minStock}
          onChange={change(setMinStock)}
          disabled={pending}
          hint={minHint}
          {...(missing.minStock !== undefined
            ? { error: missing.minStock }
            : fields['/minStockMilli'] === undefined
              ? {}
              : { error: fields['/minStockMilli'] })}
        />
        <SubmitButton pending={pending}>Guardar producto</SubmitButton>
      </form>
      {base !== undefined && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-raised p-3">
          <p className="text-base font-medium text-fg">
            {base.active ? 'Archivar este producto' : 'Este producto está archivado'}
          </p>
          <p className="text-sm text-fg-muted">
            {base.active
              ? 'Un producto no se borra: se archiva. Deja de venderse, pero conserva su historia y puedes reactivarlo.'
              : 'No se vende. Reactívalo para volver a venderlo; su historia sigue ahí.'}
          </p>
          <Button onClick={toggleActive}>
            {base.active ? 'Archivar producto' : 'Reactivar producto'}
          </Button>
        </div>
      )}
    </>
  );
}
