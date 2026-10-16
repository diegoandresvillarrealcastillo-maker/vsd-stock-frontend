// Contraste entre dos colores segun WCAG 2.2 (1.4.3 y 1.4.11). Es una
// herramienta de las pruebas: la aplicacion no calcula contrastes, los fija en
// los tokens y las pruebas comprueban que los pares cumplen AA.

/** Luminancia relativa de un color `#rgb` o `#rrggbb`, entre 0 (negro) y 1 (blanco). */
function luminance(color: string): number {
  const digits = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1];
  if (digits === undefined) {
    throw new Error(`"${color}" no es un color hexadecimal (#rgb o #rrggbb)`);
  }
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits;
  const [red, green, blue] = [0, 2, 4].map((start) => {
    const channel = parseInt(full.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

/** Razon de contraste entre dos colores, de 1 (iguales) a 21 (negro sobre blanco). */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}
