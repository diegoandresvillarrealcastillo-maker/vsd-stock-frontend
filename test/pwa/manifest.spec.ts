import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Lo que el navegador exige para ofrecer instalar la aplicacion, y lo que el sistema muestra cuando ya esta instalada.

interface Icon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

interface Manifest {
  id: string;
  name: string;
  short_name: string;
  description: string;
  lang: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: Icon[];
}

const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as Manifest;
const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/presentation/styles/index.css', 'utf8');

/** El ancho y el alto de un PNG, leidos de su cabecera (los ocho bytes de la firma y el bloque IHDR). */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('the web app manifest', () => {
  it('names the application and opens it as an application, not as a tab', () => {
    expect(manifest.name).toBe('VSD Stock');
    expect(manifest.short_name).toBe('VSD Stock');
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('es-CO');
    expect(manifest.description.length).toBeGreaterThan(20);
  });

  it('starts inside its own scope, so an installed application never leaves it', () => {
    expect(manifest.scope).toBe('/');
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
    expect(manifest.id).toBe('/');
  });

  it('has the icons the browsers ask for: 192, 512 and a maskable one', () => {
    const find = (size: string, purpose: string) =>
      manifest.icons.find((icon) => icon.sizes === size && icon.purpose === purpose);

    expect(find('192x192', 'any')).toBeDefined();
    expect(find('512x512', 'any')).toBeDefined();
    expect(find('512x512', 'maskable')).toBeDefined();
  });

  it('points every icon to a real PNG of the size it says', () => {
    for (const icon of manifest.icons) {
      const path = `public${icon.src}`;
      expect(existsSync(path), icon.src).toBe(true);
      const [width, height] = icon.sizes.split('x').map(Number);
      expect(icon.type).toBe('image/png');
      expect(pngSize(path), icon.src).toEqual({ width, height });
    }
  });

  it('uses the colour of the header band, so the installed window and the splash screen match the application', () => {
    const light = /--color-band:\s*(#[0-9a-f]{6})/i.exec(css)?.[1]?.toLowerCase();

    expect(manifest.theme_color.toLowerCase()).toBe(light);
    expect(manifest.background_color.toLowerCase()).toBe(light);
  });
});

describe('index.html', () => {
  it('links the manifest and the icon the iPhone uses', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(pngSize('public/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
  });

  it('colours the browser bar like the header band, in the light and the dark theme', () => {
    const bands = [...css.matchAll(/--color-band:\s*(#[0-9a-f]{6})/gi)].map((m) =>
      m[1]!.toLowerCase(),
    );
    const bars = [...html.matchAll(/<meta name="theme-color"[^>]*content="(#[0-9a-f]{6})"/gi)].map(
      (m) => m[1]!.toLowerCase(),
    );

    expect(bars).toHaveLength(2);
    expect(new Set(bars)).toEqual(new Set(bands));
  });
});
