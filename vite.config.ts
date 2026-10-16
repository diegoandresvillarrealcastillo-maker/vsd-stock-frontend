import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}', 'test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
        // Arranque de la aplicacion: monta React en el documento real. Su
        // cableado se ejercita a traves de lo que monta (App y las paginas).
        'src/infrastructure/main.tsx',
      ],
    },
  },
});
