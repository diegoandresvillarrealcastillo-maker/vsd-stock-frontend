import { lazy, Suspense, type ReactNode } from 'react';
import { contenedor, respiro } from '../clases';
import { Pestanas } from '../componentes/Pestanas';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';
import { DiagramaVenta } from './DiagramaVenta';

const { pruebalo, anclas, calculadora } = contenido;

// La calculadora de IVA y el arqueo bajan solo cuando alguien abre su pestana: la entrada de la pagina no los necesita. El diagrama
// de la pestana Vender no se baja aparte: es la que se ve al abrir la banda.
const CalculadoraIva = lazy(() =>
  import('./CalculadoraIva').then((modulo) => ({ default: modulo.CalculadoraIva })),
);
const ArqueoDeEjemplo = lazy(() =>
  import('./ArqueoDeEjemplo').then((modulo) => ({ default: modulo.ArqueoDeEjemplo })),
);

/** Lo que se ve mientras baja la demo de una pestana: del alto de una demo, para que la pagina no salte al llegar. */
function Esqueleto() {
  return (
    <div
      aria-busy="true"
      className="min-h-80 rounded-2xl border border-white/15 bg-white/5 p-6 motion-safe:animate-pulse"
    >
      <p role="status" className="sr-only">
        {pruebalo.cargando}
      </p>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-6 w-1/3 rounded bg-white/15" />
        <div className="h-4 w-2/3 rounded bg-white/10" />
        <div className="h-4 w-1/2 rounded bg-white/10" />
        <div className="mt-8 h-12 w-full max-w-sm rounded-lg bg-white/10" />
      </div>
    </div>
  );
}

const conEsqueleto = (demostracion: ReactNode): ReactNode => (
  <Suspense fallback={<Esqueleto />}>{demostracion}</Suspense>
);

/**
 * La banda azul donde se prueba sin crear nada (C4-L6, rediseñada en LND-2): tres pestanas con lo que se puede probar sin cuenta
 * (vender sin red, separar el IVA y cuadrar la caja). Ya no lleva cifras ni enlace a una web con datos inventados: la persona ve la
 * aplicacion funcionar aqui mismo y, si le gusta, pide su acceso. Las demos son las mismas de siempre (`DiagramaVenta`,
 * `CalculadoraIva`, `ArqueoDeEjemplo`): aqui solo se juntan.
 */
export function Pruebalo() {
  return (
    <Seccion ancla={anclas.pruebalo} className={`banda bg-band text-on-band ${respiro}`}>
      <div className={contenedor}>
        <EncabezadoSeccion ancla={anclas.pruebalo} titulo={pruebalo.titulo} />
        <div className="mt-10">
          <Pestanas
            id="pruebalo"
            etiqueta={pruebalo.pestanas.etiqueta}
            pestanas={[
              {
                clave: 'vender',
                rotulo: pruebalo.pestanas.vender,
                panel: (
                  <div className="grid gap-8 md:grid-cols-2 md:items-start">
                    <div>
                      <h3 className="font-display text-xl font-bold text-balance">
                        {pruebalo.vender.titulo}
                      </h3>
                      <p className="mt-3 text-on-band/80">{pruebalo.vender.texto}</p>
                    </div>
                    <DiagramaVenta id="pruebalo-diagrama" />
                  </div>
                ),
              },
              {
                clave: 'iva',
                rotulo: pruebalo.pestanas.iva,
                panel: conEsqueleto(
                  <CalculadoraIva id="pruebalo-calculadora" ejemplo={calculadora.ejemplo} />,
                ),
              },
              {
                clave: 'caja',
                rotulo: pruebalo.pestanas.caja,
                panel: conEsqueleto(<ArqueoDeEjemplo id="pruebalo-arqueo" />),
              },
            ]}
          />
        </div>
      </div>
    </Seccion>
  );
}
