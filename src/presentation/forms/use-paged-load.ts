import { useState } from 'react';
import type { FormProblem } from '../../domain/model/messages';
import type { Page } from '../../domain/model/page';
import { useLoad } from './use-load';
import { useSubmit } from './use-submit';

export type PagedLoad<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly problem: FormProblem }
  | {
      readonly status: 'ready';
      /** Todo lo cargado hasta ahora, en el orden en que llego. */
      readonly items: readonly T[];
      readonly hasMore: boolean;
      /** `true` mientras llega la pagina siguiente. */
      readonly loadingMore: boolean;
      /** Por que no llego la pagina siguiente; `null` si todo bien. */
      readonly moreProblem: FormProblem | null;
      /** Pide la pagina siguiente y la suma a lo que ya se muestra. */
      readonly loadMore: () => void;
    };

/**
 * Una lista que se pide por paginas con cursor (ADR 0019): la primera al abrir la pantalla y cada vez que cambia lo que se
 * pide (`deps`), y las siguientes a pedido, sumadas a lo que ya esta. Lo que se sumo se olvida cuando llega una primera pagina
 * nueva (otra busqueda, «Reintentar»): no se mezclan resultados de dos preguntas distintas.
 */
export function usePagedLoad<T>(
  loadPage: (cursor?: string) => Promise<Page<T>>,
  deps: readonly (string | number | boolean | null | undefined)[],
): { state: PagedLoad<T>; reload: () => void } {
  const { state, reload } = useLoad(() => loadPage(), deps);
  const [more, setMore] = useState<{
    base: Page<T>;
    items: readonly T[];
    nextCursor: string | null;
  } | null>(null);
  const loadingMore = useSubmit();

  if (state.status !== 'ready') return { state, reload };

  const base = state.data;
  // Lo que se sumo solo vale para la primera pagina con la que se pidio: es la misma pregunta.
  const extra = more !== null && more.base === base ? more : null;
  const nextCursor = extra === null ? base.nextCursor : extra.nextCursor;

  function loadMore() {
    if (nextCursor === null) return;
    const cursor = nextCursor;
    void loadingMore.submit(async () => {
      const page = await loadPage(cursor);
      setMore({
        base,
        items: [...(extra?.items ?? []), ...page.items],
        nextCursor: page.nextCursor,
      });
    });
  }

  return {
    state: {
      status: 'ready',
      items: [...base.items, ...(extra?.items ?? [])],
      hasMore: nextCursor !== null,
      loadingMore: loadingMore.pending,
      moreProblem: loadingMore.problem,
      loadMore,
    },
    reload,
  };
}
