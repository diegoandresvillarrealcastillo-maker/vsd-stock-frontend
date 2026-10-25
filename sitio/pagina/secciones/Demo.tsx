import { lazy, Suspense, type ReactNode } from 'react';
import { botonPrimario, contenedor, respiro } from '../clases';
import { EnlaceExterno } from '../componentes/EnlaceExterno';
import { IconoFlecha } from '../componentes/Iconos';
import { Pestanas } from '../componentes/Pestanas';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';
import { ChipDePre } from './ChipDePre';
import { DiagramaVenta } from './DiagramaVenta';

const { demo, anclas, calculadora } = contenido;

// La calculadora de IVA y el arqueo bajan solo cuando alguien abre su pestana: la entrada de la pagina no los necesita. El diagrama
// de la pestana Vender no se baja aparte porque ya esta arriba, en la entrada.
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
        {demo.cargando}
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
 * La banda azul de la demo (C4-L6): tres pestanas con lo que se puede probar sin cuenta (vender sin red, separar el IVA y cuadrar
 * la caja), tres cifras que se pueden comprobar, y el enlace publico a la demo de pruebas con el chip que dice si esta despierta.
 * Las demos son las mismas de la pagina (`DiagramaVenta`, `CalculadoraIva`, `ArqueoDeEjemplo`): aqui solo se juntan.
 */
export function Demo() {
  return (
    <Seccion ancla={anclas.demo} className={`banda bg-band text-on-band ${respiro}`}>
      <div className={contenedor}>
        <EncabezadoSeccion
          ancla={anclas.demo}
          etiqueta={demo.etiqueta}
          titulo={demo.titulo}
          sobreBanda
        />
        <div className="mt-10">
          <Pestanas
            id="demo"
            etiqueta={demo.pestanas.etiqueta}
            pestanas={[
              {
                clave: 'vender',
                rotulo: demo.pestanas.vender,
                panel: (
                  <div className="grid gap-8 md:grid-cols-2 md:items-center">
                    <div>
                      <h3 className="font-display text-xl font-bold text-balance">
                        {demo.vender.titulo}
                      </h3>
                      <p className="mt-3 text-on-band/80">{demo.vender.texto}</p>
                    </div>
                    <DiagramaVenta id="demo-diagrama" />
                  </div>
                ),
              },
              {
                clave: 'iva',
                rotulo: demo.pestanas.iva,
                panel: conEsqueleto(
                  <CalculadoraIva id="demo-calculadora" ejemplo={calculadora.ejemplo} />,
                ),
              },
              {
                clave: 'caja',
                rotulo: demo.pestanas.caja,
                panel: conEsqueleto(<ArqueoDeEjemplo id="demo-arqueo" />),
              },
            ]}
          />
        </div>
        <dl className="mt-12 grid gap-4 md:grid-cols-3">
          {demo.cifras.map((cifra) => (
            <div key={cifra.valor} className="rounded-2xl border border-white/15 bg-white/5 p-6">
              <dt className="font-display text-4xl font-extrabold tracking-tight text-accent">
                {cifra.valor}
              </dt>
              <dd className="mt-2 text-on-band/80">{cifra.texto}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
          <EnlaceExterno href={demo.boton.href} className={botonPrimario}>
            {demo.boton.texto}
            <IconoFlecha className="size-4" />
          </EnlaceExterno>
          <ChipDePre />
        </div>
        <p className="mt-4 max-w-md text-sm text-on-band/80">{demo.nota}</p>
      </div>
    </Seccion>
  );
}
