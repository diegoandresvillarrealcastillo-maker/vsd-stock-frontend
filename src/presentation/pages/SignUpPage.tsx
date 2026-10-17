import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAccount } from '../auth/AuthProvider';
import { AuthLayout } from '../components/AuthLayout';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useSubmit } from '../forms/use-submit';

const PASSWORD_HINT = 'Al menos 6 caracteres. Mejor si es larga y solo tuya.';

/** La pantalla de crear una cuenta (ADR 0022). Con la cuenta se crea un negocio o se canjea una invitacion. */
export function SignUpPage() {
  const { signUp } = useAccount();
  const { pending, problem, submit, clear } = useSubmit();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [missing, setMissing] = useState<{ email?: string; password?: string }>({});
  const [confirmEmail, setConfirmEmail] = useState(false);

  function change(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setMissing({});
      clear();
    };
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const lacking: { email?: string; password?: string } = {};
    if (email.trim() === '') lacking.email = 'Escribe tu correo.';
    if (password === '') lacking.password = 'Escribe una contraseña.';
    setMissing(lacking);
    if (lacking.email !== undefined) return focusField('correo');
    if (lacking.password !== undefined) return focusField('contrasena');
    void submit(async () => {
      const created = await signUp(email.trim(), password);
      setConfirmEmail(created.confirmEmail);
    });
  }

  if (confirmEmail) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-fg">Revisa tu correo</h1>
          <p className="text-base text-fg-muted">
            Te enviamos un enlace para confirmar tu cuenta. Cuando lo abras, vuelve aquí y entra con
            tu contraseña.
          </p>
        </div>
        <Link
          to="/ingresar"
          className="inline-flex min-h-touch items-center justify-center rounded-md bg-primary px-5 text-base font-medium text-on-primary shadow-sm hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Volver a ingresar
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Crear cuenta</h1>
        <p className="text-base text-fg-muted">
          Con tu correo y una contraseña puedes crear tu negocio o unirte a uno.
        </p>
      </div>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {problem !== null && (
          <FormAlert title="No pudimos crear tu cuenta">{problem.message}</FormAlert>
        )}
        <FormField
          id="correo"
          label="Correo"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={change(setEmail)}
          disabled={pending}
          required
          {...(missing.email !== undefined
            ? { error: missing.email }
            : problem?.code === 'email-taken' || problem?.code === 'invalid-email'
              ? { error: 'Revisa este correo.' }
              : {})}
        />
        <FormField
          id="contrasena"
          label="Contraseña"
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={change(setPassword)}
          disabled={pending}
          required
          hint={PASSWORD_HINT}
          {...(missing.password !== undefined
            ? { error: missing.password }
            : problem?.code === 'weak-password'
              ? { error: 'Prueba con una más larga o más rara.' }
              : {})}
        />
        <SubmitButton pending={pending}>Crear cuenta</SubmitButton>
      </form>
      <p className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
        ¿Ya tienes cuenta?
        <Link to="/ingresar" className="font-medium text-primary underline">
          Ingresar
        </Link>
      </p>
    </AuthLayout>
  );
}
