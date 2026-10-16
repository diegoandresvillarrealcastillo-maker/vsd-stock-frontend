import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MotionProvider } from '../../src/presentation/motion/MotionProvider';

/** Monta un componente dentro del mismo proveedor de movimiento que usa la aplicacion. */
export function renderWithMotion(ui: ReactElement) {
  return render(ui, { wrapper: MotionProvider });
}
