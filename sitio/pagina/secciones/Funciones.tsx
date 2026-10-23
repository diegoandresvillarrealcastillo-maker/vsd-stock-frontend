import { contenedor, respiro, tarjeta } from '../clases';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';
import { CalculadoraIva } from './CalculadoraIva';
import { MiniaturaFuncion } from './MiniaturaFuncion';

/** Las seis cosas que hace un mostrador con VSD Stock, cada una con lo que muestra en pantalla, y debajo la calculadora de IVA para probarla. */
export function Funciones() {
  const { funciones, anclas } = contenido;
  const ejemploDeIva = funciones.tarjetas.find((funcion) => funcion.id === 'iva')?.ejemplo;
  return (
    <Seccion ancla={anclas.funciones} className={respiro}>
      <div className={contenedor}>
        <EncabezadoSeccion
          ancla={anclas.funciones}
          etiqueta={funciones.etiqueta}
          titulo={funciones.titulo}
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {funciones.tarjetas.map((funcion) => (
            <article key={funcion.id} className={`${tarjeta} flex flex-col`}>
              <div className="rounded-xl border border-rule bg-surface p-4">
                <MiniaturaFuncion tarjeta={funcion} />
              </div>
              <h3 className="mt-6 font-display text-xl font-bold text-balance">{funcion.titulo}</h3>
              <p className="mt-3 text-fg-muted">{funcion.texto}</p>
              {funcion.nota !== undefined && (
                <p className="mt-4 rounded-lg border-l-4 border-accent bg-surface px-3 py-2 text-sm text-fg-muted">
                  {funcion.nota}
                </p>
              )}
            </article>
          ))}
        </div>
        {ejemploDeIva !== undefined && (
          <div className="mt-4">
            <CalculadoraIva id="calculadora" ejemplo={ejemploDeIva} />
          </div>
        )}
      </div>
    </Seccion>
  );
}
