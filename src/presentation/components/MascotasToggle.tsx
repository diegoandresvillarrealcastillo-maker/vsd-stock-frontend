import { m } from 'framer-motion';
import { useMascotas } from '../mascotas/MascotasProvider';
import { useTap } from '../motion/use-motion';
import { SmileIcon, SmileOffIcon } from './icons';

/**
 * Boton que apaga las mascotas o las vuelve a encender (C4-M3). Su nombre es siempre el mismo y `aria-pressed` dice si se ven:
 * una cara sonriente cuando se ven y la misma tachada cuando no, para que el estado no dependa del color. Mide al menos 44 px,
 * como el del tema, y vive junto a el en la cabecera de los dos marcos, el de la administracion y el del mostrador.
 */
export function MascotasToggle() {
  const { activas, alternar } = useMascotas();
  const tap = useTap();

  return (
    <m.button
      type="button"
      aria-label="Mostrar mascotas"
      aria-pressed={activas}
      onClick={alternar}
      {...(tap ? { whileTap: tap } : {})}
      className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border bg-surface-raised text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {activas ? <SmileIcon /> : <SmileOffIcon />}
    </m.button>
  );
}
