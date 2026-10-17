import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAccount } from '../auth/AuthProvider';
import { AuthLayout } from '../components/AuthLayout';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useSubmit } from '../forms/use-submit';

/** La pantalla de ingresar con correo y contrasena (ADR 0022). La contrasena viaja directo al servicio de identidad. */
export function SignInPage() {
  const { signIn } = useAccount();
  const { pending, problem, submit, clear } = useSubmit();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [missing, setMissing] = useState<{ email?: string; password?: string }>({});

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
    if (password === '') lacking.password = 'Escribe tu contraseña.';
    setMissing(lacking);
    if (lacking.email !== undefined) return focusField('correo');
    if (lacking.password !== undefined) return focusField('contrasena');
    void submit(() => signIn(email.trim(), password));
  }

  const wrongCredentials = problem?.code === 'invalid-credentials';

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Ingresar</h1>
        <p className="text-base text-fg-muted">Entra con tu correo y tu contraseña.</p>
      </div>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {problem !== null && <FormAlert title="No pudimos ingresarte">{problem.message}</FormAlert>}
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
          {...(missing.email === undefined ? {} : { error: missing.email })}
        />
        <FormField
          id="contrasena"
          label="Contraseña"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={change(setPassword)}
          disabled={pending}
          required
          {...(missing.password !== undefined
            ? { error: missing.password }
            : wrongCredentials
              ? { error: 'Revisa que la contraseña esté bien escrita.' }
              : {})}
        />
        <SubmitButton pending={pending}>Ingresar</SubmitButton>
      </form>
      <p className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
        ¿Todavía no tienes cuenta?
        <Link to="/registrarse" className="font-medium text-primary underline">
          Crear una
        </Link>
      </p>
    </AuthLayout>
  );
}
