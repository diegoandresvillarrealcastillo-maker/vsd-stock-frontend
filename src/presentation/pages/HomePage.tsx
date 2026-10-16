import { useState } from 'react';
import { Button } from '../components/Button';
import { SamplePanel, type SampleItem } from '../components/SamplePanel';

// Datos ficticios para mostrar el diseno. El contenido de verdad llega con los
// ciclos siguientes; esta pantalla es la muestra del sistema de diseno (C0-07).
const SAMPLE_ITEMS: readonly SampleItem[] = [
  { id: 'arroz', name: 'Arroz 500 g', units: 24, price: 3200 },
  { id: 'aceite', name: 'Aceite 1 L', units: 6, price: 12500 },
  { id: 'panela', name: 'Panela', units: 0, price: 2800 },
];

/**
 * Pagina de inicio. Presenta el producto y, mientras no hay pantallas de
 * verdad, muestra el sistema de diseno: tokens, skeleton y movimiento.
 */
export function HomePage() {
  const [loading, setLoading] = useState(false);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-gutter py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">VSD Stock</h1>
        <p className="text-base text-fg-muted">
          Inventario, punto de venta y caja para tu negocio. Estamos construyendo la primera
          versión.
        </p>
      </header>

      <section aria-labelledby="muestra-titulo" className="flex flex-col gap-4">
        <h2 id="muestra-titulo" className="text-xl font-semibold text-fg">
          Muestra de diseño
        </h2>
        <p className="text-sm text-fg-muted">
          Datos ficticios para ver cómo se comporta la interfaz mientras carga y cuando termina.
        </p>
        <div>
          <Button onClick={() => setLoading((current) => !current)}>
            {loading ? 'Ver contenido' : 'Ver estado de carga'}
          </Button>
        </div>
        <SamplePanel items={SAMPLE_ITEMS} loading={loading} />
      </section>
    </main>
  );
}
