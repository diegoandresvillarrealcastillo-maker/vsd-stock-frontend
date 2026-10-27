import { contenedor, respiro, tarjetaClara } from '../clases';
import { EncabezadoSeccion, Seccion } from '../componentes/Seccion';
import { contenido } from '../contenido';

/**
 * Los tres pasos para empezar: pedir el acceso, hablar con un asesor y empezar a vender. Es una secuencia de verdad, asi que la lista es
 * numerada y el numero se ve, en una ficha de color solido (`primary` y `on-primary`, cuyo contraste vigila `test/design/tokens.spec.ts`
 * en los dos temas). La ficha es decoracion para un lector de pantalla: la lista ya dice el orden.
 */
export function ComoEmpezar() {
  const { comoEmpezar, anclas } = contenido;
  return (
    <Seccion ancla={anclas.comoEmpezar} className={`${respiro} bg-surface-raised`}>
      <div className={contenedor}>
        <EncabezadoSeccion ancla={anclas.comoEmpezar} titulo={comoEmpezar.titulo} />
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {comoEmpezar.pasos.map((paso, indice) => (
            <li key={paso.titulo} className={tarjetaClara}>
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-on-primary"
              >
                {String(indice + 1)}
              </span>
              <h3 className="mt-5 font-display text-xl font-bold text-balance">{paso.titulo}</h3>
              <p className="mt-3 text-fg-muted">{paso.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </Seccion>
  );
}
