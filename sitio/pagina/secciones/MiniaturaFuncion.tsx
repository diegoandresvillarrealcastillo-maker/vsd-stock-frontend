import { Money } from '../../../src/domain/model/money';
import { formatPesos } from '../../../src/domain/model/quantity';
import { splitTaxIncluded } from '../../../src/domain/model/tax';
import { contenido, type Tarjeta } from '../contenido';

const { miniaturas } = contenido.funciones;
const { diagrama } = contenido;

const chip =
  'inline-flex items-center gap-2 rounded-full border border-rule bg-surface-raised px-3 py-1 text-sm font-medium';

/**
 * Lo que cada tarjeta de funciones muestra encima de su titulo. Los numeros no se escriben: salen del dominio (el mismo codigo
 * que usa la aplicacion), asi la pagina no puede decir un IVA, una diferencia o un movimiento distinto del que calcula el producto.
 */
export function MiniaturaFuncion({ tarjeta }: { readonly tarjeta: Tarjeta }) {
  switch (tarjeta.id) {
    case 'sin-conexion':
      return (
        <div className="flex flex-wrap items-center gap-3">
          <span className={chip}>
            <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
            {diagrama.estados.sinConexion}
          </span>
          <span className="font-mono text-xs text-fg-muted">
            {`${String(miniaturas.sinConexion.pendientes)} ${diagrama.porEnviar}`}
          </span>
        </div>
      );
    case 'iva': {
      if (tarjeta.ejemplo === undefined) return null;
      const { total, tarifaBp } = tarjeta.ejemplo;
      const { base, tax } = splitTaxIncluded(Money.of(total), tarifaBp);
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 font-mono text-sm">
          <dt className="text-fg-muted">{miniaturas.iva.precio}</dt>
          <dd className="text-right">{formatPesos(total)}</dd>
          <dt className="text-fg-muted">{miniaturas.iva.base}</dt>
          <dd className="text-right">{formatPesos(base.amount)}</dd>
          <dt className="text-fg-muted">{`${miniaturas.iva.iva} ${String(tarifaBp / 100)} %`}</dt>
          <dd className="text-right font-semibold">{formatPesos(tax.amount)}</dd>
        </dl>
      );
    }
    case 'roles':
      return (
        <ul className="flex flex-wrap gap-2">
          {(tarjeta.roles ?? []).map((rol) => (
            <li key={rol} className={chip}>
              {rol}
            </li>
          ))}
        </ul>
      );
  }
}
