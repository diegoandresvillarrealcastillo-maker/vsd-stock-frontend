import { createContext, useContext, type ReactNode } from 'react';
import type { BusinessPeople } from '../../domain/ports/in/business-people';

const PeopleContext = createContext<BusinessPeople | null>(null);

/** Entrega el caso de uso de negocio y personas (ya cableado desde `infrastructure/`) a las pantallas que lo usan. */
export function PeopleProvider({
  people,
  children,
}: {
  people: BusinessPeople;
  children: ReactNode;
}) {
  return <PeopleContext value={people}>{children}</PeopleContext>;
}

/** Negocio y personas. Solo funciona dentro de `PeopleProvider`. */
export function usePeople(): BusinessPeople {
  const people = useContext(PeopleContext);
  if (people === null) {
    throw new Error('usePeople debe usarse dentro de <PeopleProvider>');
  }
  return people;
}
