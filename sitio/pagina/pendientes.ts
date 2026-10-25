// Lo que alguien tiene que resolver antes de publicar la pagina en su direccion publica (C4-L8). Es una hoja sin imports a proposito:
// el script de publicacion (scripts/publicar-sitio.ts) la lee en Node, que ejecuta TypeScript quitando los tipos y no resuelve
// imports sin extension. `contenido.ts` la reexporta, asi que las pruebas y la pagina siguen leyendola de alli.

export interface Pendiente {
  readonly que: string;
  readonly quien: string;
}

/**
 * Lo que alguien tiene que resolver antes de publicar la pagina en produccion. El script de publicacion (C4-L8) se detiene
 * mientras haya algo aqui: una vista previa puede mostrarse con pendientes, la direccion publica no.
 */
export const PENDIENTES_DE_PUBLICAR: readonly Pendiente[] = [
  // El 25 de octubre de 2026 Diego sacó de aqui dos cosas: leer el texto en voz alta con una persona que atienda una tienda y preguntar
  // a quien lleve lo legal por el aviso de la primera respuesta de WhatsApp. No se hicieron; ya no frenan la publicacion (epica #99).
  {
    que: 'Actualizar la respuesta sobre teléfonos con el resultado de la prueba en el Android real (C3-16)',
    quien: 'Samuel',
  },
];

/** Si la pagina puede publicarse en su direccion publica: solo cuando no queda nada pendiente. */
export function puedePublicar(pendientes: readonly Pendiente[]): {
  readonly puede: boolean;
  readonly pendientes: readonly string[];
} {
  return {
    puede: pendientes.length === 0,
    pendientes: pendientes.map((p) => `${p.que} (${p.quien})`),
  };
}
