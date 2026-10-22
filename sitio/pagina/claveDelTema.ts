/**
 * La clave con la que se recuerda el tema. Es la misma de la aplicacion: la landing no puede importar su adaptador
 * (ADR 0033), asi que se repite aqui y `test/sitio/activos.spec.ts` comprueba que siga igual. Vive sola, sin tocar el DOM,
 * para que esa prueba (que corre en Node) pueda leerla sin arrastrar el resto de `tema.ts`.
 */
export const CLAVE_DEL_TEMA = 'vsd-stock-theme';
