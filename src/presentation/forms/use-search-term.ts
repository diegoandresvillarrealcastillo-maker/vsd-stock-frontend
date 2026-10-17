import { useEffect, useState } from 'react';

/** Cuanto espera despues de la ultima tecla para pedir la busqueda. */
const DEFAULT_DELAY_MS = 300;

/**
 * El texto de una busqueda y lo que se busca de verdad: lo segundo sigue a lo primero cuando la persona deja de escribir (o de
 * inmediato con `submit`, que es lo que hace Enter), recortado. Pedir al servidor con cada tecla seria lento y descuidado.
 */
export function useSearchTerm(delayMs: number = DEFAULT_DELAY_MS) {
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), delayMs);
    return () => clearTimeout(timer);
  }, [term, delayMs]);

  return { term, setTerm, search, submit: () => setSearch(term.trim()) };
}
