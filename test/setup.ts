import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { installMatchMedia, setPrefersReducedMotion } from './support/match-media';

// Testing Library solo limpia el DOM entre pruebas por su cuenta cuando
// existen los globales de las pruebas. Aqui no los usamos (se importa todo
// de vitest), asi que la limpieza se registra a mano.
afterEach(() => {
  cleanup();
  // Cada prueba arranca con el movimiento completo, salvo que pida lo contrario.
  if (typeof window !== 'undefined') setPrefersReducedMotion(false);
});

// Las pruebas de arquitectura corren en Node, sin `window`.
if (typeof window !== 'undefined') installMatchMedia();
