import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAccount } from '../auth/AuthProvider';
import { AuthLayout } from '../components/AuthLayout';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useSubmit } from '../forms/use-submit';
import { usePeople } from '../people/PeopleProvider';

/** La pantalla de quien ya tiene cuenta y todavia no tiene negocio: crea el suyo y queda como dueño (ADR 0023). */
export function OnboardingPage() {
  const { reload, signOut } = useAccount();
  const people = usePeople();
  const { pending, problem, submit, clear } = useSubmit();
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [missing, setMissing] = useState<{ businessName?: string; ownerName?: string }>({});

  function change(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setMissing({});
      clear();
    };
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const lacking: { businessName?: string; ownerName?: string } = {};
    if (businessName.trim() === '') lacking.businessName = 'Escribe el nombre de tu negocio.';
    if (ownerName.trim() === '') lacking.ownerName = 'Escribe tu nombre.';
    setMissing(lacking);
    if (lacking.businessName !== undefined) return focusField('negocio');
    if (lacking.ownerName !== undefined) return focusField('nombre');
    void submit(async () => {
      await people.createBusiness({ businessName, ownerName });
      // La cuenta ya tiene negocio: se vuelve a preguntar quien es y la puerta de la aplicacion se abre sola.
      reload();
    });
  }

  const serverFields = problem?.fields ?? {};
  const businessError = missing.businessName ?? serverFields['/businessName'];
  const ownerError = missing.ownerName ?? serverFields['/ownerName'];

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Crea tu negocio</h1>
        <p className="text-base text-fg-muted">
          Aquí vivirán tu catálogo y tu inventario. Quedas como dueño.
        </p>
      </div>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {problem !== null && (
          <FormAlert title="No pudimos crear tu negocio">{problem.message}</FormAlert>
        )}
        <FormField
          id="negocio"
          label="Nombre del negocio"
          name="organization"
          autoComplete="organization"
          value={businessName}
          onChange={change(setBusinessName)}
          disabled={pending}
          required
          {...(businessError === undefined ? {} : { error: businessError })}
        />
        <FormField
          id="nombre"
          label="Tu nombre"
          name="name"
          autoComplete="name"
          value={ownerName}
          onChange={change(setOwnerName)}
          disabled={pending}
          required
          hint="Así te verán las personas de tu equipo."
          {...(ownerError === undefined ? {} : { error: ownerError })}
        />
        <SubmitButton pending={pending}>Crear negocio</SubmitButton>
      </form>
      <div className="flex flex-col items-start gap-2 text-sm text-fg-muted">
        <p className="flex flex-wrap items-center gap-1">
          ¿Te invitaron a un negocio?
          <Link to="/invitacion" className="font-medium text-primary underline">
            Usar mi código
          </Link>
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex min-h-touch items-center font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Cerrar sesión
        </button>
      </div>
    </AuthLayout>
  );
}
