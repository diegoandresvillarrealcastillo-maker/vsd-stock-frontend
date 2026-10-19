/** Lo mas que puede tardar la ida y vuelta para fiarse de la medicion: con mas, la hora del servidor ya no dice cuando fue. */
export const MAX_ROUND_TRIP_MS = 5_000;

/**
 * Cuanto adelanta el servidor al reloj del dispositivo, en milisegundos (ADR 0016): la hora que dio el servidor menos la mitad del
 * viaje (`sentAt` y `receivedAt` son del reloj del dispositivo). Es el `clockOffsetMs` que viaja en las operaciones. Devuelve
 * `null` si no es confiable: un viaje de mas de cinco segundos, un reloj que se movio mientras se esperaba (el viaje habria ido
 * hacia atras en el tiempo) o una fecha que no es una fecha.
 */
export function measureClockOffsetMs(
  serverTime: Date,
  sentAt: Date,
  receivedAt: Date,
): number | null {
  const server = serverTime.getTime();
  const sent = sentAt.getTime();
  const received = receivedAt.getTime();
  if (Number.isNaN(server) || Number.isNaN(sent) || Number.isNaN(received)) return null;
  const roundTrip = received - sent;
  if (roundTrip < 0 || roundTrip > MAX_ROUND_TRIP_MS) return null;
  return Math.round(server - (sent + received) / 2);
}
