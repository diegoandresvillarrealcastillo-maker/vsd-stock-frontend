/**
 * Clave con la que se guarda el tema. El script de index.html la lee ANTES de
 * que arranque React para pintar el tema correcto sin parpadeo; la prueba
 * test/design/theme-bootstrap.spec.ts comprueba que ambos usen la misma.
 * Vive en su propio archivo, sin tipos del navegador, para que esa prueba (que
 * corre en Node) pueda importarla.
 */
export const THEME_STORAGE_KEY = 'vsd-stock-theme';
