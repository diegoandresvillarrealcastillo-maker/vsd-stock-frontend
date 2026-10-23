// A donde apunta la landing. Es una hoja sin imports a proposito: el script de compilacion (scripts/build-sitio.ts) la lee en
// Node para escribir la politica de contenido, y desde aqui la leen tambien el chip de la demo y los enlaces, para que la
// politica y la pagina no puedan decir cosas distintas.

/** La API de PRE (Render, plan gratuito, se duerme a los 15 minutos): el chip de la demo le hace una sola consulta `GET /health`. */
export const API_DE_PRE = 'https://vsd-stock-api-pre.onrender.com';
