import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { activeOwners, roleLabel, type Invitation, type Person } from '../../domain/model/people';
import { can, ROLES, type Role } from '../../domain/model/permissions';
import { useMembership } from '../auth/AuthProvider';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { InvitationCodePanel } from '../components/InvitationCodePanel';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useLoad } from '../forms/use-load';
import { useSubmit } from '../forms/use-submit';
import { usePeople } from '../people/PeopleProvider';

function Back() {
  return (
    <Link to="/personas" className="text-sm font-medium text-primary underline">
      Volver a personas
    </Link>
  );
}

function Note({ title, children }: { title: string; children: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-3">
      <p className="text-base font-medium text-fg">{title}</p>
      <p className="text-sm text-fg-muted">{children}</p>
    </div>
  );
}

/** Una persona del negocio (ADR 0023): cambiar su nombre y su rol, darla de baja o de alta, y renovar su codigo si lo perdio. */
export function PersonPage() {
  const { personId = '' } = useParams();
  const people = usePeople();
  const membership = useMembership();
  const { state, reload } = useLoad(() => people.listEveryone(), []);
  const { pending, problem, submit, clear } = useSubmit();
  const [updated, setUpdated] = useState<Person | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [missing, setMissing] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState<'no' | 'saved' | 'unchanged'>('no');
  const [renewed, setRenewed] = useState<Invitation | null>(null);

  if (state.status === 'loading') {
    return (
      <section className="flex flex-col gap-4">
        <Back />
        <RowsSkeleton label="Cargando a la persona…" rows={2} />
      </section>
    );
  }
  if (state.status === 'failed') {
    return (
      <section className="flex flex-col gap-4">
        <Back />
        <LoadFailed
          title="No pudimos cargar a la persona"
          message={state.problem.message}
          onRetry={reload}
        />
      </section>
    );
  }

  const found = state.data.find((candidate) => candidate.id === personId);
  if (found === undefined) {
    return (
      <section className="flex flex-col gap-4">
        <Back />
        <h1 className="text-3xl font-semibold text-fg">No encontramos a esa persona</h1>
        <p className="text-base text-fg-muted">
          Puede que ya no esté en el negocio. Vuelve a la lista para ver quién está.
        </p>
      </section>
    );
  }
  if (renewed !== null) {
    return <InvitationCodePanel title="Código nuevo" invitation={renewed} />;
  }

  const person = updated ?? found;
  const everyone = state.data.map((candidate) => (candidate.id === person.id ? person : candidate));
  const actorRole = membership?.role ?? 'cashier';
  const manageable =
    can(actorRole, 'user:manage-admins') ||
    (can(actorRole, 'user:manage-cashiers') && person.role === 'cashier');
  const owners = activeOwners(everyone);
  const onlyOwner = person.role === 'owner' && person.status === 'active' && owners.length === 1;
  const isMe = membership !== null && membership.userId === person.id;
  const roleOptions = (can(actorRole, 'user:manage-admins') ? ROLES : (['cashier'] as const)).map(
    (candidate) => ({ value: candidate, label: roleLabel(candidate) }),
  );

  const nameValue = fullName ?? person.fullName;
  const roleValue = role ?? person.role;

  function change(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setMissing(undefined);
      setSaved('no');
      clear();
    };
  }

  function apply(next: Person) {
    setUpdated(next);
    setFullName(null);
    setRole(null);
    setConfirming(false);
  }

  function onSave(event: FormEvent) {
    event.preventDefault();
    if (nameValue.trim() === '') {
      setMissing('Escribe el nombre de la persona.');
      return focusField('nombre');
    }
    const changes: { fullName?: string; role?: Role } = {};
    if (nameValue.trim() !== person.fullName) changes.fullName = nameValue;
    if (roleValue !== person.role) changes.role = roleValue;
    if (changes.fullName === undefined && changes.role === undefined) {
      setSaved('unchanged');
      return;
    }
    void submit(async () => {
      apply(await people.updatePerson(person.id, changes));
      setSaved('saved');
    });
  }

  function setActive(active: boolean) {
    setSaved('no');
    void submit(async () => {
      apply(await people.updatePerson(person.id, { active }));
    });
  }

  function renew() {
    void submit(async () => {
      setRenewed(await people.renewInvitation(person.id));
    });
  }

  const fieldProblems = problem?.fields ?? {};
  const nameError = missing ?? fieldProblems['/fullName'];

  return (
    <section className="flex flex-col gap-4">
      <Back />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">{person.fullName}</h1>
        <p className="text-base text-fg-muted">{person.email ?? 'Sin correo'}</p>
        <div className="flex flex-wrap gap-2">
          <Badge tone={person.role === 'owner' ? 'strong' : 'neutral'}>
            {roleLabel(person.role)}
          </Badge>
          {person.status === 'pending' && <Badge tone="warning">Pendiente</Badge>}
          {person.status === 'inactive' && <Badge tone="muted">De baja</Badge>}
        </div>
      </div>

      {onlyOwner && (
        <div className="flex flex-col gap-1 rounded-md border border-accent-text bg-surface-raised p-3">
          <p className="text-base font-medium text-accent-text">
            {isMe ? 'Eres el único dueño' : 'Es el único dueño'}
          </p>
          <p className="text-sm text-fg-muted">
            El negocio no puede quedarse sin un dueño activo, por eso no se puede cambiar su rol ni
            darlo de baja. Nombra primero a otra persona como dueño.
          </p>
        </div>
      )}

      {problem !== null && <FormAlert title="No pudimos hacerlo">{problem.message}</FormAlert>}
      {saved !== 'no' && (
        <p role="status" className="text-sm text-fg-muted">
          {saved === 'saved' ? 'Cambios guardados.' : 'No hiciste ningún cambio.'}
        </p>
      )}

      {!manageable && (
        <Note title="Solo lectura">
          Solo el dueño puede cambiar a administradores y dueños. Tú puedes cuidar a los cajeros.
        </Note>
      )}

      {manageable && (
        <form noValidate onSubmit={onSave} className="flex flex-col gap-4">
          <FormField
            id="nombre"
            label="Nombre"
            autoComplete="off"
            value={nameValue}
            onChange={change(setFullName)}
            disabled={pending}
            required
            {...(nameError === undefined ? {} : { error: nameError })}
          />
          <FormField
            id="rol"
            label="Rol"
            value={roleValue}
            onChange={change((value) =>
              setRole(ROLES.find((candidate) => candidate === value) ?? roleValue),
            )}
            disabled={pending || onlyOwner}
            options={roleOptions}
            hint="Cajero puede vender; administrador, además, ve reportes y cuida a los cajeros."
            {...(fieldProblems['/role'] === undefined ? {} : { error: fieldProblems['/role'] })}
          />
          <SubmitButton pending={pending}>Guardar cambios</SubmitButton>
        </form>
      )}

      {person.status === 'pending' && manageable && (
        <div className="flex flex-col gap-2">
          <Note title="Todavía no canjeó su código">
            Si lo perdió, crea uno nuevo: el anterior deja de servir.
          </Note>
          <Button onClick={renew}>Crear un código nuevo</Button>
        </div>
      )}

      {manageable && person.status === 'inactive' && (
        <Button onClick={() => setActive(true)}>Dar de alta</Button>
      )}

      {manageable && person.status !== 'inactive' && !onlyOwner && !confirming && (
        <Button onClick={() => setConfirming(true)}>Dar de baja</Button>
      )}

      {confirming && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
          <p className="text-xl font-semibold text-fg">¿Dar de baja a {person.fullName}?</p>
          <p className="text-base text-fg-muted">
            Ya no podrá entrar al negocio. Lo que hizo queda registrado y puedes volver a darla de
            alta cuando quieras.
          </p>
          <Button onClick={() => setActive(false)}>Sí, dar de baja</Button>
          <Button onClick={() => setConfirming(false)}>Cancelar</Button>
        </div>
      )}
    </section>
  );
}
