const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Solo el dia: «17 oct». En la hora del dispositivo. */
export function formatDay(date: Date): string {
  return `${String(date.getDate())} ${MONTHS[date.getMonth()] ?? ''}`;
}

/** Solo la hora: «3:12 p. m.». En la hora del dispositivo. Ya termina en punto: quien la usa en una frase no le agrega otro. */
export function formatTime(date: Date): string {
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${String(hour12)}:${minutes} ${hours < 12 ? 'a. m.' : 'p. m.'}`;
}

/**
 * El dia y la hora como se dicen: «17 oct, 3:12 p. m.». Se escribe a mano y no con `Intl` para que salga igual en todos los
 * navegadores y versiones (la forma corta del mes y los espacios de la hora cambian de una a otra).
 */
export function formatMoment(date: Date): string {
  return `${formatDay(date)}, ${formatTime(date)}`;
}
