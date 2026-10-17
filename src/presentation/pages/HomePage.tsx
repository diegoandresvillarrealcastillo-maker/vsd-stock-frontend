import { useState } from 'react';
import logoUrl from '../assets/logo-stock.webp';
import { Button } from '../components/Button';
import { SamplePanel, type SampleItem } from '../components/SamplePanel';
import { ThemeToggle } from '../components/ThemeToggle';

// Datos ficticios para mostrar el diseno. El contenido de verdad llega con los
// ciclos siguientes; esta pantalla es la muestra del sistema de diseno.
const SAMPLE_ITEMS: readonly SampleItem[] = [
  { id: 'arroz', name: 'Arroz 500 g', units: 24, price: 3200 },
  { id: 'aceite', name: 'Aceite 1 L', units: 6, price: 12500 },
  { id: 'panela', name: 'Panela', units: 0, price: 2800 },
];

/**
 * Pagina de inicio. Una banda azul oscuro con el logo (las letras blancas del
 * logo no se leen sobre fondo blanco, por eso va en una banda en los dos temas)
 * y el boton de tema, y debajo la muestra del sistema de diseno: tokens,
 * skeleton y movimiento.
 */
export function HomePage() {
  const [loading, setLoading] = useState(false);

  return (
    <>
      <header className="bg-band px-gutter pt-3">
        <div className="mx-auto flex max-w-2xl justify-end">
          <ThemeToggle />
        </div>
      </header>

      <main>
        <section className="rounded-b-xl bg-band px-gutter pb-8 text-center text-on-band">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
            <h1>
              {/* Con width y height el navegador reserva el espacio antes de bajar la imagen. */}
              <img src={logoUrl} alt="VSD Stock" width={420} height={289} className="h-auto w-52" />
            </h1>
            <p className="text-base">
              Inventario, punto de venta y caja para tu negocio. Estamos construyendo la primera
              versión.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="muestra-titulo"
          className="mx-auto flex max-w-2xl flex-col gap-4 px-gutter py-6"
        >
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
    </>
  );
}
