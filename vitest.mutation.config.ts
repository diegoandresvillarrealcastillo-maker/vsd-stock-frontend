import { defineConfig } from 'vitest/config';
import base from './vite.config';

// La configuracion de las pruebas que Stryker repite una vez por cada rotura (npm run mutation, C3-17). Es la del proyecto con dos
// cambios:
//  - solo las pruebas de las capas que rompe (dominio y aplicacion) y la de los vectores de calculo del contrato, que ejecuta el
//    dominio: las ciento y pico de las pantallas tardan minutos en cada vuelta y no son las que vigilan esas capas. Las demas del
//    contrato comparan archivos generados y no corren bien en la copia donde Stryker rompe el codigo;
//  - un plazo por prueba que alcance para correr rota e instrumentada: con los 5 s de siempre, una prueba pesada del dominio (la del
//    IVA con cualquier tarifa) se agota en la ejecucion inicial y Stryker se niega a empezar.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      'src/domain/**/*.spec.ts',
      'src/application/**/*.spec.ts',
      'test/contract/calculation-vectors.spec.ts',
    ],
    testTimeout: 30_000,
    // La cobertura es la de `npm run test:coverage`; aqui solo se repiten pruebas.
    coverage: { enabled: false },
  },
});
