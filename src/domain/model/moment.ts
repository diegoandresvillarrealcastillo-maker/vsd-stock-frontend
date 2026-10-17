const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Solo el dia: «17 oct». En la hora del dispositivo. */
export function formatDay(date: Date): string {
  return `${String(date.getDate())} ${MONTHS[date.getMonth()] ?? ''}`;
}

/**
 * El dia y la hora como se dicen: «17 oct, 3:12 p. m.». Se escribe a mano y no con `Intl` para que salga igual en todos los
 * navegadores y versiones (la forma corta del mes y los espacios de la hora cambian de una a otra).
 */
export function formatMoment(date: Date): string {
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDay(date)}, ${String(hour12)}:${minutes} ${hours < 12 ? 'a. m.' : 'p. m.'}`;
}
