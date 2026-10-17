import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { Supplier } from '../../domain/model/purchasing';
import { Button } from '../components/Button';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useLoad } from '../forms/use-load';
import { useSubmit } from '../forms/use-submit';
import { usePurchasing } from '../purchasing/PurchasingProvider';

const NAME_MISSING = 'Escribe el nombre del proveedor.';

/** Lo ultimo que se hizo sobre una fila, para titular el aviso si fallo. */
interface Acting {
  readonly kind: 'change' | 'delete';
  readonly name: string;
}

interface Editing {
  readonly id: string;
  readonly name: string;
  readonly contact: string;
  readonly missing?: string;
}

/** Los proveedores del negocio (ADR 0015): a quien se le compra. Solo el nombre y un contacto. */
export function SuppliersPage() {
  const purchasing = usePurchasing();
  const { state, reload, previous } = useLoad(() => purchasing.listAllSuppliers(), []);
  // Mientras se pide la lista de nuevo (despues de agregar, cambiar o borrar) se sigue viendo la anterior.
  const suppliers = state.status === 'ready' ? state.data : previous;
  const add = useSubmit();
  const row = useSubmit();
  const [newName, setNewName] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newMissing, setNewMissing] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirming, setConfirming] = useState<Supplier | null>(null);
  const [acting, setActing] = useState<Acting | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function onAdd(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (newName.trim() === '') {
      setNewMissing(NAME_MISSING);
      return focusField('proveedor-nombre');
    }
    const name = newName.trim();
    const contact = newContact.trim() === '' ? null : newContact.trim();
    void add.submit(async () => {
      await purchasing.createSupplier({ name, contact });
      setNewName('');
      setNewContact('');
      setNotice(`Agregamos «${name}».`);
      reload();
    });
  }

  function startEditing(supplier: Supplier) {
    row.clear();
    setConfirming(null);
    setNotice(null);
    setEditing({ id: supplier.id, name: supplier.name, contact: supplier.contact ?? '' });
  }

  function startConfirming(supplier: Supplier) {
    row.clear();
    setEditing(null);
    setNotice(null);
    setConfirming(supplier);
  }

  function onChange(event: FormEvent, supplier: Supplier) {
    event.preventDefault();
    if (editing === null) return;
    const name = editing.name.trim();
    if (name === '') {
      setEditing({ ...editing, missing: NAME_MISSING });
      return focusField(`proveedor-${supplier.id}-nombre`);
    }
    const contact = editing.contact.trim() === '' ? null : editing.contact.trim();
    const change: { name?: string; contact?: string | null } = {};
    if (name !== supplier.name) change.name = name;
    if (contact !== supplier.contact) change.contact = contact;
    if (Object.keys(change).length === 0) {
      setEditing(null);
      return;
    }
    setActing({ kind: 'change', name: supplier.name });
    void row.submit(async () => {
      await purchasing.updateSupplier(supplier.id, change);
      setEditing(null);
      setNotice(`Cambiamos «${supplier.name}».`);
      reload();
    });
  }

  function onDelete(supplier: Supplier) {
    setActing({ kind: 'delete', name: supplier.name });
    void row.submit(async () => {
      await purchasing.deleteSupplier(supplier.id);
      setConfirming(null);
      setNotice(`Borramos «${supplier.name}».`);
      reload();
    });
  }

  const rowAlertTitle =
    acting === null
      ? 'No pudimos hacerlo'
      : acting.kind === 'delete'
        ? row.problem?.code === 'supplier-in-use'
          ? `No se puede borrar «${acting.name}»`
          : `No pudimos borrar «${acting.name}»`
        : `No pudimos cambiar «${acting.name}»`;
  const addFields = add.problem?.fields ?? {};
  const rowFields = row.problem?.fields ?? {};

  return (
    <section className="flex flex-col gap-4">
      <Link to="/compras" className="text-sm font-medium text-primary underline">
        Volver a compras
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Proveedores</h1>
        <p className="text-base text-fg-muted">A quién le compras. Solo el nombre y un contacto.</p>
      </div>
      {notice !== null && (
        <p role="status" className="text-sm font-medium text-success">
          {notice}
        </p>
      )}
      <form noValidate onSubmit={onAdd} className="flex flex-col gap-4">
        {add.problem !== null && (
          <FormAlert title="No pudimos guardar el proveedor">{add.problem.message}</FormAlert>
        )}
        <FormField
          id="proveedor-nombre"
          label="Nombre"
          autoComplete="off"
          value={newName}
          onChange={(value) => {
            setNewName(value);
            setNewMissing(undefined);
            add.clear();
          }}
          disabled={add.pending}
          required
          {...(newMissing !== undefined
            ? { error: newMissing }
            : addFields['/name'] === undefined
              ? {}
              : { error: addFields['/name'] })}
        />
        <FormField
          id="proveedor-contacto"
          label="Contacto (opcional)"
          autoComplete="off"
          value={newContact}
          onChange={(value) => {
            setNewContact(value);
            add.clear();
          }}
          disabled={add.pending}
          hint="Un teléfono, un correo o lo que sirva para llamar."
          {...(addFields['/contact'] === undefined ? {} : { error: addFields['/contact'] })}
        />
        <SubmitButton pending={add.pending}>Guardar proveedor</SubmitButton>
      </form>
      {state.status === 'loading' && suppliers === undefined && (
        <RowsSkeleton label="Cargando proveedores…" rows={3} />
      )}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar los proveedores"
          message={state.problem.message}
          onRetry={reload}
        />
      )}
      {state.status !== 'failed' &&
        suppliers !== undefined &&
        (suppliers.length === 0 ? (
          <p className="text-base text-fg-muted">Todavía no tienes proveedores.</p>
        ) : (
          <ul aria-label="Proveedores" className="flex flex-col">
            {suppliers.map((supplier) => (
              <li
                key={supplier.id}
                className="flex flex-col gap-3 border-b border-border py-3 last:border-b-0"
              >
                {editing?.id === supplier.id ? (
                  <form
                    noValidate
                    onSubmit={(event) => onChange(event, supplier)}
                    className="flex flex-col gap-3"
                  >
                    <FormField
                      id={`proveedor-${supplier.id}-nombre`}
                      label={`Nuevo nombre de «${supplier.name}»`}
                      autoComplete="off"
                      value={editing.name}
                      onChange={(value) => {
                        setEditing({ id: editing.id, name: value, contact: editing.contact });
                        row.clear();
                      }}
                      disabled={row.pending}
                      {...(editing.missing !== undefined
                        ? { error: editing.missing }
                        : rowFields['/name'] === undefined
                          ? {}
                          : { error: rowFields['/name'] })}
                    />
                    <FormField
                      id={`proveedor-${supplier.id}-contacto`}
                      label={`Nuevo contacto de «${supplier.name}»`}
                      autoComplete="off"
                      value={editing.contact}
                      onChange={(value) => {
                        setEditing({ ...editing, contact: value });
                        row.clear();
                      }}
                      disabled={row.pending}
                      {...(rowFields['/contact'] === undefined
                        ? {}
                        : { error: rowFields['/contact'] })}
                    />
                    <div className="flex flex-wrap gap-3">
                      <SubmitButton pending={row.pending}>Guardar</SubmitButton>
                      <Button onClick={() => setEditing(null)}>Cancelar</Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <p className="truncate text-base font-medium text-fg">{supplier.name}</p>
                      <p className="truncate text-sm text-fg-muted">
                        {supplier.contact ?? 'Sin contacto'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button onClick={() => startEditing(supplier)}>Cambiar</Button>
                      <Button onClick={() => startConfirming(supplier)}>Borrar</Button>
                    </div>
                  </div>
                )}
                {confirming?.id === supplier.id && (
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
                    <p className="text-xl font-semibold text-fg">¿Borrar «{supplier.name}»?</p>
                    <p className="text-base text-fg-muted">
                      Solo se borra si no tiene compras. Las compras son historia y no se tocan.
                    </p>
                    <Button onClick={() => onDelete(supplier)}>Sí, borrar</Button>
                    <Button onClick={() => setConfirming(null)}>Cancelar</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}
      {row.problem !== null && <FormAlert title={rowAlertTitle}>{row.problem.message}</FormAlert>}
    </section>
  );
}
