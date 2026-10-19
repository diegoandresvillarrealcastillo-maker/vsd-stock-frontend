import { useState, type FormEvent } from 'react';
import { parseCash } from '../../domain/model/shift';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useSubmit } from '../forms/use-submit';
import { useShift } from './ShiftProvider';

const FIELD = 'efectivo-inicial';

/** Abrir el turno: el efectivo que hay en la caja. Todo queda guardado en este equipo; no hace falta conexion. */
export function OpenShiftForm() {
  const { open } = useShift();
  const { pending, problem, submit, clear } = useSubmit();
  const [text, setText] = useState('');
  const [missing, setMissing] = useState<string | undefined>();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const cash = parseCash(text);
    if (!cash.ok) {
      setMissing(cash.message);
      focusField(FIELD);
      return;
    }
    void submit(() => open(cash.value));
  }

  return (
    <>
      {problem !== null && (
        <FormAlert title="No pudimos abrir el turno">{problem.message}</FormAlert>
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          id={FIELD}
          label="Efectivo inicial"
          value={text}
          onChange={(value) => {
            setText(value);
            setMissing(undefined);
            clear();
          }}
          inputMode="numeric"
          autoComplete="off"
          placeholder="50000"
          hint="Cuéntalo antes de empezar. Si la caja está vacía, escribe 0."
          required
          disabled={pending}
          {...(missing === undefined ? {} : { error: missing })}
        />
        <SubmitButton pending={pending} pendingLabel="Guardando…">
          Abrir turno
        </SubmitButton>
      </form>
    </>
  );
}
