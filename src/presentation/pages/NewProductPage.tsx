import { Link, useNavigate } from 'react-router';
import { useCatalog } from '../catalog/CatalogProvider';
import { ProductForm } from '../catalog/ProductForm';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { useLoad } from '../forms/use-load';

/** Crear un producto (ADR 0015). Al guardarlo, vuelve al catalogo y dice que lo guardo. */
export function NewProductPage() {
  const catalog = useCatalog();
  const navigate = useNavigate();
  const { state, reload } = useLoad(() => catalog.listAllCategories(), []);

  return (
    <section className="flex flex-col gap-4">
      <Link to="/catalogo" className="text-sm font-medium text-primary underline">
        Volver al catálogo
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Nuevo producto</h1>
        <p className="text-base text-fg-muted">
          Lo que escribes aquí es lo que verá tu equipo al vender.
        </p>
      </div>
      {state.status === 'loading' && <RowsSkeleton label="Cargando…" rows={2} />}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar las categorías"
          message={state.problem.message}
          onRetry={reload}
        />
      )}
      {state.status === 'ready' && (
        <ProductForm
          categories={state.data}
          onCreated={(created) =>
            void navigate('/catalogo', { state: { notice: `Guardamos «${created.name}».` } })
          }
        />
      )}
    </section>
  );
}
