// Duraciones (segundos) y curvas del movimiento. Framer Motion las necesita en
// JavaScript; el CSS las declara como --duration-* y --ease-* en
// styles/index.css. La prueba test/design/tokens.spec.ts comprueba que ambos
// lados digan lo mismo, para que haya una sola fuente de verdad.

export const durations = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  pulse: 1.6,
} as const;

export const eases = {
  standard: [0.2, 0, 0, 1],
  exit: [0.4, 0, 1, 1],
} as const;
