import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { invitableRoles, roleLabel, type Invitation } from '../../domain/model/people';
import type { Role } from '../../domain/model/permissions';
import { useMembership } from '../auth/AuthProvider';
import { FormAlert } from '../components/FormAlert';
import { InvitationCodePanel } from '../components/InvitationCodePanel';
import { FormField } from '../components/FormField';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useSubmit } from '../forms/use-submit';
import { usePeople } from '../people/PeopleProvider';

/** Invitar a una persona al negocio (ADR 0023): se crea un codigo, no se envia ningun correo. */
export function InvitePage() {
  const people = usePeople();
  const membership = useMembership();
  const { pending, problem, submit, clear } = useSubmit();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<Role, 'owner'>>('cashier');
  const [missing, setMissing] = useState<string | undefined>(undefined);
  const [created, setCreated] = useState<Invitation | null>(null);

  if (created !== null)
    return <InvitationCodePanel title="Invitación creada" invitation={created} />;

  const allowed = membership === null ? [] : invitableRoles(membership.role);
  // El cajero es el caso de siempre: va primero.
  const options = (['cashier', 'admin'] as const)
    .filter((candidate) => allowed.includes(candidate))
    .map((candidate) => ({ value: candidate, label: roleLabel(candidate) }));

  function change(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setMissing(undefined);
      clear();
    };
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (fullName.trim() === '') {
      setMissing('Escribe el nombre de la persona.');
      return focusField('nombre');
    }
    void submit(async () => {
      setCreated(
        await people.invite({ fullName, role, ...(email.trim() === '' ? {} : { email }) }),
      );
    });
  }

  const fields = problem?.fields ?? {};
  const nameError = missing ?? fields['/fullName'];
  const emailError = fields['/email'];

  return (
    <section className="flex flex-col gap-4">
      <Link to="/personas" className="text-sm font-medium text-primary underline">
        Volver a personas
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Invitar a alguien</h1>
        <p className="text-base text-fg-muted">
          Se crea un código para que esa persona se una a tu negocio.
        </p>
      </div>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {problem !== null && (
          <FormAlert title="No pudimos crear la invitación">{problem.message}</FormAlert>
        )}
        <FormField
          id="nombre"
          label="Nombre de la persona"
          autoComplete="off"
          value={fullName}
          onChange={change(setFullName)}
          disabled={pending}
          required
          {...(nameError === undefined ? {} : { error: nameError })}
        />
        <FormField
          id="correo"
          label="Correo (opcional)"
          type="email"
          autoComplete="off"
          inputMode="email"
          value={email}
          onChange={change(setEmail)}
          disabled={pending}
          hint="Solo para reconocerla en la lista: no le enviamos nada."
          {...(emailError === undefined ? {} : { error: emailError })}
        />
        <FormField
          id="rol"
          label="Rol"
          value={role}
          onChange={(value) => setRole(value === 'admin' ? 'admin' : 'cashier')}
          disabled={pending}
          options={options}
          {...(fields['/role'] === undefined ? {} : { error: fields['/role'] })}
        />
        <SubmitButton pending={pending}>Crear invitación</SubmitButton>
      </form>
    </section>
  );
}
