import { renderToString } from 'react-dom/server';
import { Sitio } from './Sitio';

/** El HTML de la pagina. Lo usa scripts/build-sitio.ts al compilar, para que el texto este en el documento sin ejecutar JavaScript. */
export function render(): string {
  return renderToString(<Sitio />);
}
