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

/** La pantalla de canjear el codigo de una invitacion (ADR 0023): la persona se une al negocio que la invito. */
export function RedeemPage() {
  const { reload } = useAccount();
  const people = usePeople();
  const { pending, problem, submit, clear } = useSubmit();
  const [code, setCode] = useState('');
  const [missing, setMissing] = useState<string | undefined>(undefined);

  function onChange(value: string) {
    setCode(value);
    setMissing(undefined);
    clear();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (code.trim() === '') {
      setMissing('Escribe el código que te dieron.');
      return focusField('codigo');
    }
    void submit(async () => {
      await people.redeemInvitation(code);
      reload();
    });
  }

  // Un codigo que no sirve se corrige en el campo del codigo; cualquier otro problema va en el aviso.
  const codeProblem =
    problem?.code.startsWith('invitation-') === true ? problem.message : undefined;

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Unirme a un negocio</h1>
        <p className="text-base text-fg-muted">
          Escribe el código que te dio quien te invitó. Cada código sirve una sola vez.
        </p>
      </div>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {problem !== null && <FormAlert title="No pudimos unirte">{problem.message}</FormAlert>}
        <FormField
          id="codigo"
          label="Código de invitación"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          onChange={onChange}
          disabled={pending}
          required
          hint="Son 16 letras y números, en grupos de cuatro."
          {...(missing !== undefined
            ? { error: missing }
            : codeProblem !== undefined
              ? { error: codeProblem }
              : {})}
        />
        <SubmitButton pending={pending}>Unirme</SubmitButton>
      </form>
      <p className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
        ¿Quieres abrir tu propio negocio?
        <Link to="/empezar" className="font-medium text-primary underline">
          Crear uno
        </Link>
      </p>
    </AuthLayout>
  );
}
