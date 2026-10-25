// A donde apunta la landing. Es una hoja sin imports a proposito: el script de compilacion (scripts/build-sitio.ts) la lee en
// Node para escribir la politica de contenido, y desde aqui la leen tambien el contenido, el chip de la demo y los enlaces,
// para que la politica y la pagina no puedan decir cosas distintas.

/** La API de PRE (Render, plan gratuito, se duerme a los 15 minutos): el chip de la demo le hace una sola consulta `GET /health`. */
export const API_DE_PRE = 'https://vsd-stock-api-pre.onrender.com';

/** La web de PRE, con datos ficticios: la demo que se enlaza publicamente (Diego, 22 de octubre). */
export const DEMO_DE_PRE = 'https://vsd-stock-pre.pages.dev';

/** Los dos repositorios son publicos (y no tienen licencia: por eso la pagina dice «codigo a la vista», no «open source»). */
export const REPOSITORIO_BACKEND =
  'https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend';
export const REPOSITORIO_FRONTEND =
  'https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-frontend';

/**
 * El unico contacto: un chat de WhatsApp con el mensaje ya escrito (Diego, 22 de octubre). La pagina no tiene formularios, ni
 * cookies, ni analitica (ADR 0033). El numero es publico: recibira mensajes no deseados.
 */
export const WHATSAPP_NUMERO = '573245889281';
export const WHATSAPP_MENSAJE = 'Hola, quiero ser tienda piloto de VSD Stock.';
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(WHATSAPP_MENSAJE)}`;
