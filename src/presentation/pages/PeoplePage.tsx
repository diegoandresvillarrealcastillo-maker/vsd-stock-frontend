import { useState } from 'react';
import { Link } from 'react-router';
import { invitableRoles, roleLabel, type Person } from '../../domain/model/people';
import { useMembership } from '../auth/AuthProvider';
import { Badge } from '../components/Badge';
import { FormAlert } from '../components/FormAlert';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { SubmitButton } from '../components/SubmitButton';
import { useLoad } from '../forms/use-load';
import { useSubmit } from '../forms/use-submit';
import { usePeople } from '../people/PeopleProvider';

const LINK =
  'inline-flex min-h-touch w-full items-center justify-center rounded-md bg-primary px-5 text-base font-medium text-on-primary shadow-sm hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

function Row({ person }: { person: Person }) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to={`/personas/${encodeURIComponent(person.id)}`}
        className="flex items-center justify-between gap-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex min-w-0 flex-col">
          <span
            className={`truncate text-base font-medium ${person.status === 'inactive' ? 'text-fg-muted' : 'text-fg'}`}
          >
            {person.fullName}
          </span>
          <span className="truncate text-sm text-fg-muted">{person.email ?? 'Sin correo'}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={person.role === 'owner' ? 'strong' : 'neutral'}>
            {roleLabel(person.role)}
          </Badge>
          {person.status === 'pending' && <Badge tone="warning">Pendiente</Badge>}
          {person.status === 'inactive' && <Badge tone="muted">De baja</Badge>}
        </span>
      </Link>
    </li>
  );
}

/** Las personas del negocio (ADR 0023): quien trabaja aqui, con que rol y si ya entro, esta pendiente o fue dada de baja. */
export function PeoplePage() {
  const people = usePeople();
  const membership = useMembership();
  const { state, reload } = useLoad(() => people.listPeople(), []);
  const [more, setMore] = useState<{ items: Person[]; nextCursor: string | null } | null>(null);
  const loadingMore = useSubmit();

  function retry() {
    setMore(null);
    reload();
  }

  const canInvite = membership !== null && invitableRoles(membership.role).length > 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Personas</h1>
        <p className="text-base text-fg-muted">Quién trabaja en tu negocio y qué puede hacer.</p>
      </div>
      {canInvite && (
        <Link to="/personas/nueva" className={LINK}>
          Invitar a alguien
        </Link>
      )}
      {state.status === 'loading' && <RowsSkeleton label="Cargando personas…" />}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar las personas"
          message={state.problem.message}
          onRetry={retry}
        />
      )}
      {state.status === 'ready' && (
        <>
          <ul aria-label="Personas del negocio" className="flex flex-col">
            {[...state.data.items, ...(more?.items ?? [])].map((person) => (
              <Row key={person.id} person={person} />
            ))}
          </ul>
          {loadingMore.problem !== null && (
            <FormAlert title="No pudimos cargar más">{loadingMore.problem.message}</FormAlert>
          )}
          {(more === null ? state.data.nextCursor : more.nextCursor) !== null && (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                const cursor = more === null ? state.data.nextCursor : more.nextCursor;
                if (cursor === null) return;
                void loadingMore.submit(async () => {
                  const page = await people.listPeople(cursor);
                  setMore({
                    items: [...(more?.items ?? []), ...page.items],
                    nextCursor: page.nextCursor,
                  });
                });
              }}
            >
              <SubmitButton pending={loadingMore.pending} variant="accent">
                Cargar más
              </SubmitButton>
            </form>
          )}
          <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-3">
            <p className="text-base font-medium text-fg">El negocio siempre tiene un dueño</p>
            <p className="text-sm text-fg-muted">
              No se puede dar de baja ni cambiar de rol al único dueño activo.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
