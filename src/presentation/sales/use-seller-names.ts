import { useLoad } from '../forms/use-load';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { usePeople } from '../people/PeopleProvider';

/** Cómo se llama a quien no se conoce: lo que el servidor dice de una venta es solo quién la hizo, por su identificador. */
export const UNKNOWN_PERSON = 'Otra persona';

/**
 * Los nombres de quienes hicieron las ventas. La gerencia pide la lista de las personas del negocio; un cajero no puede verla, y
 * solo ve las ventas de sus turnos, así que el único nombre que necesita es el suyo, que ya está guardado en este equipo. Si la lista
 * no llega, la pantalla se muestra igual con lo que sabe: el nombre es un adorno de cada fila.
 */
export function useSellerNames(manager: boolean): (userId: string) => string {
  const { active } = useLocal();
  const people = usePeople();
  const loaded = useLoad(() => (manager ? people.listEveryone() : Promise.resolve([])), [manager]);
  const names = new Map<string, string>();
  if (active !== null) names.set(active.profile.userId, active.profile.fullName);
  if (loaded.state.status === 'ready') {
    for (const person of loaded.state.data) names.set(person.id, person.fullName);
  }
  return (userId) => names.get(userId) ?? UNKNOWN_PERSON;
}
