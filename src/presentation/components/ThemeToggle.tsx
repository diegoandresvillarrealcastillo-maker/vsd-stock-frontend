import { AnimatePresence, m } from 'framer-motion';
import { useIconSwap, useTap } from '../motion/use-motion';
import { useTheme } from '../theme/ThemeProvider';
import { MoonIcon, SunIcon } from './icons';

/**
 * Boton que alterna entre el tema claro y el oscuro. Muestra el icono de lo que
 * va a hacer (una luna en el tema claro, un sol en el oscuro) y su nombre dice
 * la accion completa. Mide al menos 44 px y el icono cambia girando, salvo que
 * la persona haya pedido menos movimiento.
 */
export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const swap = useIconSwap();
  const tap = useTap();
  const label = mode === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';

  return (
    <m.button
      type="button"
      aria-label={label}
      onClick={toggle}
      {...(tap ? { whileTap: tap } : {})}
      className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border bg-surface-raised text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={mode}
          variants={swap}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="flex"
        >
          {mode === 'light' ? <MoonIcon /> : <SunIcon />}
        </m.span>
      </AnimatePresence>
    </m.button>
  );
}
