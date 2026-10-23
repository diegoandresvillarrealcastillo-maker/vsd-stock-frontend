import { lazy, type ComponentType } from 'react';

/**
 * Una pantalla que se descarga cuando alguien entra a ella (C4-R0), no con el arranque: el mostrador no paga el peso de la
 * administracion. `load` es el `import()` de su archivo y `name` la pantalla que exporta. Quien la pone en una ruta la envuelve en un
 * `Suspense`; en la aplicacion lo hace `ScreenLoader`, en el marco.
 */
export function lazyScreen<Name extends string>(
  load: () => Promise<Record<Name, ComponentType>>,
  name: Name,
) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}
