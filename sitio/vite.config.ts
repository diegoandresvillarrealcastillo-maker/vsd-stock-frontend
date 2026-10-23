import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// La landing (ADR 0033 del backend) se compila aparte de la aplicacion: su propia entrada, su propia salida (`sitio/dist/`, fuera
// de `dist/`) y sus propios comandos (`npm run dev:sitio`, `build:sitio`, `preview:sitio`). No comparte con la aplicacion el
// paquete que se descarga, el presupuesto de peso ni el service worker.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: {
    // Lo que la landing toma de la aplicacion (el dominio, las mascotas, los tokens) y las dependencias viven en la carpeta de arriba.
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2023',
    // Vite escribe las fuentes de menos de 4 KB dentro del CSS como `data:`, y la politica de contenido (font-src 'self') las
    // bloquea: la pagina cargaria sin ellas. Cada fuente se pide como archivo.
    assetsInlineLimit: 0,
  },
});
