import { useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Product } from '../../domain/model/catalog';
import { Badge } from '../components/Badge';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { useCatalog } from '../catalog/CatalogProvider';
import { ProductForm } from '../catalog/ProductForm';
import { useLoad } from '../forms/use-load';

function Back() {
  return (
    <Link to="/catalogo" className="text-sm font-medium text-primary underline">
      Volver al catálogo
    </Link>
  );
}

/** Cambiar, archivar o reactivar un producto (ADR 0015). */
export function EditProductPage() {
  const { productId = '' } = useParams();
  const catalog = useCatalog();
  const product = useLoad(() => catalog.getProduct(productId), [productId]);
  const categories = useLoad(() => catalog.listAllCategories(), []);
  // Lo ultimo que se guardo, para que el titulo siga al nombre que la persona acaba de poner.
  const [changed, setChanged] = useState<Product | null>(null);

  if (product.state.status === 'failed' && product.state.problem.code === 'product-not-found') {
    return (
      <section className="flex flex-col gap-4">
        <Back />
        <h1 className="text-3xl font-semibold text-fg">No encontramos ese producto</h1>
        <p className="text-base text-fg-muted">
          Puede que la dirección esté mal escrita. Vuelve al catálogo para ver tus productos.
        </p>
      </section>
    );
  }
  if (product.state.status === 'failed' || categories.state.status === 'failed') {
    const problem =
      product.state.status === 'failed'
        ? product.state.problem
        : categories.state.status === 'failed'
          ? categories.state.problem
          : null;
    return (
      <section className="flex flex-col gap-4">
        <Back />
        <LoadFailed
          title="No pudimos cargar el producto"
          message={problem?.message ?? ''}
          onRetry={() => {
            product.reload();
            categories.reload();
          }}
        />
      </section>
    );
  }
  if (product.state.status === 'loading' || categories.state.status === 'loading') {
    return (
      <section className="flex flex-col gap-4">
        <Back />
        <RowsSkeleton label="Cargando el producto…" rows={2} />
      </section>
    );
  }

  const shown =
    changed !== null && changed.id === product.state.data.id ? changed : product.state.data;
  return (
    <section className="flex flex-col gap-4">
      <Back />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">{shown.name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-base text-fg-muted">
          <span>{shown.sku}</span>
          {!shown.active && <Badge tone="muted">Archivado</Badge>}
        </div>
      </div>
      <ProductForm
        key={product.state.data.id}
        categories={categories.state.data}
        product={product.state.data}
        onChanged={setChanged}
      />
    </section>
  );
}
