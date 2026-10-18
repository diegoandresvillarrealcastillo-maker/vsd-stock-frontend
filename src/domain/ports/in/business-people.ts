import type { Invitation, Person, PersonPage } from '../../model/people';
import type { Role } from '../../model/permissions';

/**
 * Puerto de entrada: abrir un negocio, unirse a uno con una invitacion y administrar a sus personas (ADR 0023). Todo fallo
 * es un `ApiError` con su clase (ADR 0009); la interfaz decide el mensaje por la clase y por el `code`.
 */
export interface BusinessPeople {
  /** Abre un negocio y deja a la persona como su dueño. Despues hay que volver a preguntar quien es. */
  createBusiness(input: { businessName: string; ownerName: string }): Promise<void>;
  /** Canjea el codigo de una invitacion. Despues hay que volver a preguntar quien es. */
  redeemInvitation(code: string): Promise<void>;
  /** Una pagina de las personas del negocio, por nombre. */
  listPeople(cursor?: string): Promise<PersonPage>;
  /** Todas las personas del negocio (son pocas: un negocio de barrio), con un tope de paginas. */
  listEveryone(): Promise<Person[]>;
  /** Invita a alguien. El codigo que devuelve se muestra UNA vez: el servidor solo guarda su huella. */
  invite(input: {
    fullName: string;
    role: Exclude<Role, 'owner'>;
    email?: string;
  }): Promise<Invitation>;
  /** Cambia el nombre, el rol o el alta de una persona. Solo se manda lo que cambia. */
  updatePerson(
    personId: string,
    change: { fullName?: string; role?: Role; active?: boolean },
  ): Promise<Person>;
  /** Un codigo nuevo para quien tiene una invitacion sin canjear (el anterior deja de servir). */
  renewInvitation(personId: string): Promise<Invitation>;
}
