import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// La accesibilidad de cada pantalla, comprobada por axe en el navegador real (ADR 0030, punto 20): contraste de color, nombres de los
// controles, etiquetas de los campos, regiones y orden de los encabezados. Es lo que jsdom no ve.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

/** Falla si axe encuentra algo en la pantalla que se ve ahora, y dice cual pantalla y que encontro. */
export async function expectAccessible(page: Page, screen: string): Promise<void> {
  // Una animacion a medias cambia los colores que axe lee: se espera a que la pantalla este quieta.
  await page.waitForTimeout(400);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? '?'}): ${violation.help} — ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join(' | ')}`,
  );
  expect(summary, `Accesibilidad de «${screen}»`).toEqual([]);
}

/** Que la pantalla este de verdad en el tema que la prueba dice: si no, la prueba «oscura» estaria mirando la clara. */
export async function expectTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}
