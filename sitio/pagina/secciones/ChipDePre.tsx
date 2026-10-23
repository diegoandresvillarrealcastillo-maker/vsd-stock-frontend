import { useSyncExternalStore } from 'react';
import { contenido } from '../contenido';
import { sondaDeLaPagina, type EstadoDePre, type SondaDePre } from '../demos/estadoDePre';

const { estadoDemo } = contenido;

const colorDelPunto: Record<EstadoDePre, string> = {
  verificando: 'bg-on-band/60',
  despierta: 'bg-success',
  dormida: 'bg-accent',
};

/** Lo que el servidor y la primera pintura del navegador muestran, antes de saber nada: la consulta empieza al montarse. */
const alEmpezar = (): EstadoDePre => 'verificando';

/**
 * El chip del estado de la demo de PRE (C4-L6): dice si la demo esta disponible o en reposo, y siempre que sus datos son ficticios.
 * La API de PRE duerme a los 15 minutos, asi que un servidor que no contesta a tiempo es «en reposo», nunca «caido». El estado lo da
 * la sonda (`demos/estadoDePre.ts`), que consulta una sola vez por carga; el servidor siempre pinta «verificando» para que el HTML
 * prerenderizado y el montado sean el mismo. Es una region de estado: el cambio se anuncia sin quitarle el foco a nadie.
 */
export function ChipDePre({ sonda = sondaDeLaPagina() }: { readonly sonda?: SondaDePre }) {
  const estado = useSyncExternalStore(sonda.suscribir, sonda.leer, alEmpezar);
  return (
    <p
      role="status"
      data-estado-de-pre={estado}
      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium text-on-band"
    >
      <span
        data-punto=""
        aria-hidden="true"
        className={`size-2.5 shrink-0 rounded-full ${colorDelPunto[estado]}`}
      />
      {estadoDemo[estado]}
    </p>
  );
}
