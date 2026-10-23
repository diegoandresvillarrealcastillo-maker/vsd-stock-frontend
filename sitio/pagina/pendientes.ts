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
  {
    que: 'Leer el texto en voz alta con una persona que atienda una tienda: nadie del equipo lo ha hecho todavía',
    quien: 'Diego',
  },
  {
    que: 'Preguntar a quien lleve lo legal si hace falta un aviso en la primera respuesta de WhatsApp (Ley 1581 de 2012; la cito de memoria, no la verifiqué)',
    quien: 'Diego',
  },
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
