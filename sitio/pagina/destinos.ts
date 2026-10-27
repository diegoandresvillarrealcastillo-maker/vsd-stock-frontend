// A donde apunta la landing. Es una hoja sin imports a proposito: los scripts (scripts/build-sitio.ts, scripts/verificar-sitio.ts)
// la leen en Node, y desde aqui la leen tambien el contenido y los enlaces, para que lo que se verifica y lo que se muestra no puedan
// decir cosas distintas.

/** La aplicacion de PRE: la unica que existe hoy. A ella llevan «Iniciar sesion» y «Solicitar mi acceso». */
export const APP_DE_PRE = 'https://vsd-stock-pre.pages.dev';

/**
 * A donde llevan «Iniciar sesion» y «Solicitar mi acceso» (Diego, 25 de octubre): a la aplicacion. Cuando exista PROD, la aplicacion
 * cambia de direccion aqui y en ningun otro lugar de la pagina.
 */
export const APP_INGRESAR = `${APP_DE_PRE}/ingresar`;
export const APP_REGISTRARSE = `${APP_DE_PRE}/registrarse`;

/**
 * El unico contacto: un chat de WhatsApp con el mensaje ya escrito (Diego, 22 de octubre; el mensaje cambio el 27 de octubre, cuando
 * la pagina dejo de buscar tiendas para probar y paso a ofrecer un asesor). La pagina no tiene formularios, ni cookies, ni analitica
 * (ADR 0033). El numero es publico: recibira mensajes no deseados.
 */
export const WHATSAPP_NUMERO = '573245889281';
export const WHATSAPP_MENSAJE =
  'Hola, quiero hablar con un asesor sobre VSD Stock para mi negocio.';
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(WHATSAPP_MENSAJE)}`;
