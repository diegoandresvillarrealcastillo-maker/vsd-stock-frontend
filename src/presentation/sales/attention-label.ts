import type { AttentionCount } from './SalesProvider';

/** El numero de ventas que piden atencion como se dice: «3», y «50+» si hay mas de las que se cuentan. */
export function attentionLabel({ count, more }: AttentionCount): string {
  return `${String(count)}${more ? '+' : ''}`;
}
