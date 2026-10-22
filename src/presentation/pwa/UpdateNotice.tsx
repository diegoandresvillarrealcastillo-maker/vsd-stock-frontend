import { useState } from 'react';
import { useAppUpdate } from './PwaProvider';

const BUTTON =
  'inline-flex min-h-touch min-w-touch items-center justify-center rounded-md px-5 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * El aviso de que hay una version nueva de la aplicacion (C3-07, ADR 0030). Es una region `status`: un lector de pantalla lo
 * anuncia sin quitarle el foco a nadie. La version nueva NUNCA se activa sola: la persona decide cuando, y mientras una
 * venta este en curso el aviso solo dice que espere, porque actualizar recarga la pagina.
 */
export function UpdateNotice() {
  const { state, apply } = useAppUpdate();
  const [later, setLater] = useState(false);

  if ((state.status !== 'ready' && state.status !== 'applying') || later) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-band px-gutter py-3 text-on-band shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        {state.status === 'applying' ? (
          <p className="text-base">Actualizando…</p>
        ) : (
          <>
            <p className="min-w-0 flex-1 text-base">
              Hay una versión nueva de VSD Stock.
              {state.held && ' Termina la venta en curso para actualizar.'}
            </p>
            <div className="flex gap-2">
              {!state.held && (
                <button
                  type="button"
                  onClick={apply}
                  className={`${BUTTON} bg-accent text-on-accent`}
                >
                  Actualizar ahora
                </button>
              )}
              <button
                type="button"
                onClick={() => setLater(true)}
                className={`${BUTTON} border border-on-band text-on-band`}
              >
                Más tarde
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
