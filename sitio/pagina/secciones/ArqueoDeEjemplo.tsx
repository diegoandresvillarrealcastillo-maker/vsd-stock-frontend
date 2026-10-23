import { useState } from 'react';
import { formatPesos } from '../../../src/domain/model/quantity';
import { campoTexto, tarjetaClara } from '../clases';
import { IconoAlerta, IconoCheck } from '../componentes/Iconos';
import { contenido } from '../contenido';
import { contarLaCaja } from '../demos/arqueo';

const { arqueo } = contenido.comoFunciona;

/**
 * El arqueo de ejemplo de la landing (C4-L5): la persona escribe el efectivo que conto y ve lo que le diria el producto al cerrar el
 * turno. Las palabras las escribe el dominio (`describeCount`, `demos/arqueo.ts`) y el campo solo acepta numeros, como el de la
 * aplicacion. Como en ella, la diferencia no es una region viva: cambia mientras se escribe y no debe leerse en cada tecla; se lee con
 * el campo (`aria-describedby`). El tono (cuadra o no) tiene su icono y su titular: el color nunca es lo unico que lo dice.
 */
export function ArqueoDeEjemplo({
  id,
}: {
  /** Con lo que empiezan los `id` de sus partes. Lo da quien la pone en la pagina: `useId` daria uno distinto en el servidor y en el navegador. */
  readonly id: string;
}) {
  const [texto, setTexto] = useState(String(arqueo.contado));
  const resultado = contarLaCaja(arqueo.esperado, texto);
  const cuadra = resultado.ok && resultado.nota.kind === 'balanced';

  return (
    <div className={`${tarjetaClara} grid gap-8 md:grid-cols-2 md:items-start`}>
      <div>
        <h3 className="font-display text-xl font-bold text-balance">{arqueo.titulo}</h3>
        <p className="mt-3 text-fg-muted">{arqueo.texto}</p>
        <dl className="mt-6 flex items-baseline justify-between gap-6 border-t border-rule pt-4 font-mono text-sm">
          <dt className="text-fg-muted">{arqueo.esperadoEtiqueta}</dt>
          <dd className="font-semibold">{formatPesos(arqueo.esperado)}</dd>
        </dl>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-contado`} className="text-sm font-medium">
            {arqueo.campo}
          </label>
          <input
            id={`${id}-contado`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
            }}
            aria-invalid={!resultado.ok}
            aria-describedby={resultado.ok ? `${id}-ayuda ${id}-nota` : `${id}-ayuda`}
            className={campoTexto}
          />
          <p
            id={`${id}-ayuda`}
            className={`mt-1 text-sm ${resultado.ok ? 'text-fg-muted' : 'font-medium text-accent-text'}`}
          >
            {resultado.ok ? arqueo.ayuda : resultado.mensaje}
          </p>
        </div>

        {resultado.ok && (
          <div
            id={`${id}-nota`}
            data-tone={cuadra ? 'ok' : 'warn'}
            className={`flex items-start gap-3 rounded-lg border-2 bg-surface-raised p-4 ${cuadra ? 'border-success' : 'border-accent-text'}`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-current bg-surface">
              {cuadra ? (
                <IconoCheck className="size-4 text-success" />
              ) : (
                <IconoAlerta className="size-4 text-accent-text" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">{resultado.nota.title}</p>
              <p className="mt-1 text-sm text-fg-muted">{resultado.nota.detail}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
