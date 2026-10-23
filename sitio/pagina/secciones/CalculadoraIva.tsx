import { useState } from 'react';
import { taxLabel } from '../../../src/domain/model/catalog';
import { formatPesos } from '../../../src/domain/model/quantity';
import { TAX_RATES_BP } from '../../../src/domain/model/tax';
import { campoTexto, tarjeta } from '../clases';
import { contenido } from '../contenido';
import { calcularIva } from '../demos/iva';

const { calculadora, ejemplosIva, funciones } = contenido;
const { iva: rotulos } = funciones.miniaturas;

const opcion =
  'inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-lg border border-rule bg-surface-raised px-3 text-sm font-medium has-checked:border-accent-text has-checked:bg-surface';

const ejemploBoton =
  'inline-flex min-h-touch items-center rounded-full border border-rule bg-surface-raised px-3 font-mono text-sm aria-pressed:border-accent-text aria-pressed:bg-surface aria-pressed:font-semibold';

/**
 * La calculadora de IVA de la landing (C4-L5): la persona escribe un precio con el IVA incluido, elige la tarifa y ve la base y el
 * IVA. No hace ninguna cuenta ni escribe ninguna frase: la cuenta es `splitTaxIncluded` del dominio (`demos/iva.ts`), el campo solo
 * acepta numeros como el del precio de la aplicacion, y las cifras salen de golpe: ninguna cuenta hacia arriba ni hacia abajo.
 * `ejemplo` es con lo que abre; los mismos cinco ejemplos que una revision contable recalculo estan debajo, para probarlos de un toque.
 */
export function CalculadoraIva({
  id,
  ejemplo,
}: {
  /** Con lo que empiezan los `id` de sus partes. Lo da quien la pone en la pagina: `useId` daria uno distinto en el servidor y en el navegador. */
  readonly id: string;
  readonly ejemplo: { readonly total: number; readonly tarifaBp: number };
}) {
  const [texto, setTexto] = useState(String(ejemplo.total));
  const [tarifaBp, setTarifaBp] = useState(ejemplo.tarifaBp);
  const resultado = calcularIva(texto, tarifaBp);

  return (
    <div className={`${tarjeta} grid gap-8 md:grid-cols-2 md:items-start`}>
      <div>
        <h3 className="font-display text-xl font-bold text-balance">{calculadora.titulo}</h3>
        <p className="mt-3 text-fg-muted">{calculadora.texto}</p>

        <div role="group" aria-labelledby={`${id}-ejemplos`} className="mt-6">
          <p id={`${id}-ejemplos`} className="text-sm font-medium">
            {calculadora.ejemplos}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {ejemplosIva.map((e) => (
              <button
                key={`${String(e.total)}@${String(e.tarifaBp)}`}
                type="button"
                aria-pressed={texto.trim() === String(e.total) && tarifaBp === e.tarifaBp}
                onClick={() => {
                  setTexto(String(e.total));
                  setTarifaBp(e.tarifaBp);
                }}
                className={ejemploBoton}
              >
                {`${formatPesos(e.total)} · ${taxLabel(e.tarifaBp)}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label htmlFor={`${id}-precio`} className="text-sm font-medium">
            {calculadora.campo}
          </label>
          <input
            id={`${id}-precio`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
            }}
            aria-invalid={!resultado.ok}
            aria-describedby={`${id}-ayuda`}
            className={campoTexto}
          />
          <p
            id={`${id}-ayuda`}
            className={`mt-1 text-sm ${resultado.ok ? 'text-fg-muted' : 'font-medium text-accent-text'}`}
          >
            {resultado.ok ? calculadora.ayuda : resultado.mensaje}
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">{calculadora.tarifa}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {TAX_RATES_BP.map((bp) => (
              <label key={bp} className={opcion}>
                <input
                  type="radio"
                  name={`${id}-tarifa`}
                  checked={tarifaBp === bp}
                  onChange={() => {
                    setTarifaBp(bp);
                  }}
                  className="size-4 accent-accent"
                />
                {taxLabel(bp)}
              </label>
            ))}
          </div>
        </fieldset>

        <div aria-live="polite" aria-atomic="true">
          {resultado.ok && (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 font-mono text-sm">
                <dt className="text-fg-muted">{rotulos.precio}</dt>
                <dd className="text-right">{formatPesos(resultado.total)}</dd>
                <dt className="text-fg-muted">{rotulos.base}</dt>
                <dd className="text-right">{formatPesos(resultado.base)}</dd>
                <dt className="text-fg-muted">{`${rotulos.iva} ${String(resultado.tarifaBp / 100)} %`}</dt>
                <dd className="text-right font-semibold">{formatPesos(resultado.iva)}</dd>
              </dl>
              <div className="mt-3 border-t border-rule pt-3 text-sm">
                <p className="text-fg-muted">{calculadora.suma}</p>
                <p className="font-mono font-semibold">
                  {`${formatPesos(resultado.base)} + ${formatPesos(resultado.iva)} = ${formatPesos(resultado.suma)}`}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
