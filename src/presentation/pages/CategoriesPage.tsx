import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { Category } from '../../domain/model/catalog';
import { useCatalog } from '../catalog/CatalogProvider';
import { Button } from '../components/Button';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useLoad } from '../forms/use-load';
import { useSubmit } from '../forms/use-submit';

const NAME_TAKEN = 'category-name-taken';
const NAME_MISSING = 'Escribe el nombre de la categoría.';

/** Lo ultimo que se hizo sobre una fila, para titular el aviso si fallo. */
interface Acting {
  readonly kind: 'rename' | 'delete';
  readonly name: string;
}

/** Las categorias del negocio (ADR 0015): agruparlas, cambiarles el nombre y borrar las que no tienen productos. */
export function CategoriesPage() {
  const catalog = useCatalog();
  const { state, reload, previous } = useLoad(() => catalog.listAllCategories(), []);
  // Mientras se pide la lista de nuevo (despues de agregar, cambiar o borrar) se sigue viendo la anterior.
  const categories = state.status === 'ready' ? state.data : previous;
  const add = useSubmit();
  const row = useSubmit();
  const [newName, setNewName] = useState('');
  const [newMissing, setNewMissing] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState<{ id: string; name: string; missing?: string } | null>(
    null,
  );
  const [confirming, setConfirming] = useState<Category | null>(null);
  const [acting, setActing] = useState<Acting | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function onAdd(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (newName.trim() === '') {
      setNewMissing(NAME_MISSING);
      return focusField('nueva-categoria');
    }
    const name = newName.trim();
    void add.submit(async () => {
      await catalog.createCategory(name);
      setNewName('');
      setNotice(`Agregamos «${name}».`);
      reload();
    });
  }

  function startEditing(category: Category) {
    row.clear();
    setConfirming(null);
    setNotice(null);
    setEditing({ id: category.id, name: category.name });
  }

  function startConfirming(category: Category) {
    row.clear();
    setEditing(null);
    setNotice(null);
    setConfirming(category);
  }

  function onRename(event: FormEvent, category: Category) {
    event.preventDefault();
    if (editing === null) return;
    const name = editing.name.trim();
    if (name === '') {
      setEditing({ ...editing, missing: NAME_MISSING });
      return focusField(`categoria-${category.id}`);
    }
    if (name === category.name) {
      setEditing(null);
      return;
    }
    setActing({ kind: 'rename', name: category.name });
    void row.submit(async () => {
      await catalog.renameCategory(category.id, name);
      setEditing(null);
      setNotice(`Cambiamos «${category.name}» a «${name}».`);
      reload();
    });
  }

  function onDelete(category: Category) {
    setActing({ kind: 'delete', name: category.name });
    void row.submit(async () => {
      await catalog.deleteCategory(category.id);
      setConfirming(null);
      setNotice(`Borramos «${category.name}».`);
      reload();
    });
  }

  const nameTakenOnRow = row.problem?.code === NAME_TAKEN && editing !== null;
  const rowAlertTitle =
    acting === null
      ? 'No pudimos hacerlo'
      : acting.kind === 'delete'
        ? row.problem?.code === 'category-in-use'
          ? `No se puede borrar «${acting.name}»`
          : `No pudimos borrar «${acting.name}»`
        : `No pudimos cambiar el nombre de «${acting.name}»`;

  return (
    <section className="flex flex-col gap-4">
      <Link to="/catalogo" className="text-sm font-medium text-primary underline">
        Volver al catálogo
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Categorías</h1>
        <p className="text-base text-fg-muted">Agrupan tus productos. El nombre no se repite.</p>
      </div>
      {notice !== null && (
        <p role="status" className="text-sm font-medium text-success">
          {notice}
        </p>
      )}
      <form noValidate onSubmit={onAdd} className="flex flex-col gap-4">
        {add.problem !== null && add.problem.code !== NAME_TAKEN && (
          <FormAlert title="No pudimos agregar la categoría">{add.problem.message}</FormAlert>
        )}
        <FormField
          id="nueva-categoria"
          label="Nueva categoría"
          autoComplete="off"
          value={newName}
          onChange={(value) => {
            setNewName(value);
            setNewMissing(undefined);
            add.clear();
          }}
          disabled={add.pending}
          {...(newMissing !== undefined
            ? { error: newMissing }
            : add.problem?.code === NAME_TAKEN
              ? { error: add.problem.message }
              : {})}
        />
        <SubmitButton pending={add.pending}>Agregar categoría</SubmitButton>
      </form>
      {state.status === 'loading' && categories === undefined && (
        <RowsSkeleton label="Cargando categorías…" rows={3} />
      )}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar las categorías"
          message={state.problem.message}
          onRetry={reload}
        />
      )}
      {state.status !== 'failed' &&
        categories !== undefined &&
        (categories.length === 0 ? (
          <p className="text-base text-fg-muted">Todavía no tienes categorías.</p>
        ) : (
          <ul aria-label="Categorías" className="flex flex-col">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex flex-col gap-3 border-b border-border py-3 last:border-b-0"
              >
                {editing?.id === category.id ? (
                  <form
                    noValidate
                    onSubmit={(event) => onRename(event, category)}
                    className="flex flex-col gap-3"
                  >
                    <FormField
                      id={`categoria-${category.id}`}
                      label={`Nuevo nombre de «${category.name}»`}
                      autoComplete="off"
                      value={editing.name}
                      onChange={(value) => {
                        setEditing({ id: editing.id, name: value });
                        row.clear();
                      }}
                      disabled={row.pending}
                      {...(editing.missing !== undefined
                        ? { error: editing.missing }
                        : nameTakenOnRow
                          ? { error: row.problem?.message ?? '' }
                          : {})}
                    />
                    <div className="flex flex-wrap gap-3">
                      <SubmitButton pending={row.pending}>Guardar</SubmitButton>
                      <Button onClick={() => setEditing(null)}>Cancelar</Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-base font-medium text-fg">
                      {category.name}
                    </p>
                    <div className="flex shrink-0 gap-2">
                      <Button onClick={() => startEditing(category)}>Cambiar nombre</Button>
                      <Button onClick={() => startConfirming(category)}>Borrar</Button>
                    </div>
                  </div>
                )}
                {confirming?.id === category.id && (
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
                    <p className="text-xl font-semibold text-fg">¿Borrar «{category.name}»?</p>
                    <p className="text-base text-fg-muted">
                      Solo se borra si no tiene productos. Los productos nunca se borran.
                    </p>
                    <Button onClick={() => onDelete(category)}>Sí, borrar</Button>
                    <Button onClick={() => setConfirming(null)}>Cancelar</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}
      {row.problem !== null && !nameTakenOnRow && (
        <FormAlert title={rowAlertTitle}>{row.problem.message}</FormAlert>
      )}
    </section>
  );
}
