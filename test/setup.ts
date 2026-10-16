import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library solo limpia el DOM entre pruebas por su cuenta cuando
// existen los globales de las pruebas. Aqui no los usamos (se importa todo
// de vitest), asi que la limpieza se registra a mano.
afterEach(() => {
  cleanup();
});
