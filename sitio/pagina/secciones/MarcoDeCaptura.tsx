import { CAPTURAS, type IdDeCaptura } from '../capturas';
import { contenido } from '../contenido';

interface Props {
  readonly id: IdDeCaptura;
  /** El aparato en que se ve: un telefono (el cajero en el mostrador) o un computador (el dueño en su escritorio). */
  readonly tipo: 'telefono' | 'computador';
  /** Es lo primero que se ve al abrir la pagina: carga ya y no cuando se acerque. */
  readonly prioritaria?: boolean;
}

/**
 * Una captura de la aplicacion dentro del marco de un telefono o de un computador. El marco lo dibuja el CSS (`[data-marco]` en
 * `estilos.css`), asi que no pesa nada en la red; el ancho lo pone quien la usa. Solo la imagen se lee: su descripcion sale de
 * `contenido.capturas` y sus medidas de `capturas.ts`, que son las del archivo para que la pagina no salte al llegar.
 */
export function MarcoDeCaptura({ id, tipo, prioritaria = false }: Props) {
  const captura = CAPTURAS[id];
  return (
    <div data-marco={tipo}>
      {tipo === 'computador' && <span aria-hidden="true" data-barra="" />}
      <img
        src={captura.src}
        alt={contenido.capturas[id]}
        width={captura.ancho}
        height={captura.alto}
        loading={prioritaria ? undefined : 'lazy'}
        decoding="async"
        fetchPriority={prioritaria ? 'high' : undefined}
      />
    </div>
  );
}
