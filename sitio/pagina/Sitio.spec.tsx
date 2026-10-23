import { render as mount, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { render } from './entry-server';
import { Sitio } from './Sitio';

// El andamio de la landing (C4-L1). Las secciones llegan en los tickets siguientes; lo que se vigila desde ya es lo que no
// puede romperse nunca: que la pagina se pueda leer sin ejecutar JavaScript (el HTML prerenderizado) y que el navegador
// monte lo mismo encima, sin que React tenga que rehacer lo que ya esta.
describe('the site', () => {
  it('has one main landmark and one heading that says what the page is', () => {
    mount(<Sitio />);

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('VSD Stock');
  });
});

describe('the prerendered page', () => {
  it('already has the text in the HTML, so a reader that does not run JavaScript still finds the page', () => {
    const html = render();

    expect(html).toContain('<h1');
    expect(html).toContain('VSD Stock');
  });

  it('is the same markup that the browser mounts, or hydration would redo it', () => {
    const { container } = mount(<Sitio />);

    expect(render()).toBe(container.innerHTML);
  });
});
