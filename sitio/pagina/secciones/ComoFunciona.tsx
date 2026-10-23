import { contenedor, respiro, tarjetaClara } from '../clases';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';
import { ArqueoDeEjemplo } from './ArqueoDeEjemplo';

/** Los tres pasos de un turno: abrir, vender y cerrar. La lista numerada es una `ol`; el numero grande es solo decoracion. */
export function ComoFunciona() {
  const { comoFunciona, anclas } = contenido;
  return (
    <Seccion ancla={anclas.comoFunciona} className={`${respiro} bg-surface-raised`}>
      <div className={contenedor}>
        <EncabezadoSeccion
          ancla={anclas.comoFunciona}
          etiqueta={comoFunciona.etiqueta}
          titulo={comoFunciona.titulo}
        />
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {comoFunciona.pasos.map((paso, indice) => (
            <li key={paso.titulo} className={`${tarjetaClara} relative overflow-hidden`}>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-3 right-4 font-mono text-7xl font-medium text-rule select-none"
              >
                {String(indice + 1).padStart(2, '0')}
              </span>
              <h3 className="relative mt-10 font-display text-xl font-bold text-balance">
                {paso.titulo}
              </h3>
              <p className="relative mt-3 text-fg-muted">{paso.texto}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4">
          <ArqueoDeEjemplo id="arqueo" />
        </div>
      </div>
    </Seccion>
  );
}
