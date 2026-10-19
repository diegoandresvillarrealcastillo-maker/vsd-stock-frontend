import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatPesos } from '../../domain/model/quantity';
import { describeDifference, parseCash } from '../../domain/model/shift';
import type { ShiftState } from '../../domain/ports/in/shifts';
import { Callout } from '../components/Callout';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { Skeleton } from '../components/Skeleton';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useSubmit } from '../forms/use-submit';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { useShift } from '../shift/ShiftProvider';

const FIELD = 'efectivo-contado';
const SHIFT_PATH = '/mostrador/turno';

type OpenState = Extract<ShiftState, { status: 'open' }>;

function Heading({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold text-fg">Cerrar turno</h1>
      <p className="text-base text-fg-muted">{children}</p>
    </div>
  );
}

function BackToShift() {
  return (
    <Link to={SHIFT_PATH} className="text-sm font-medium text-primary underline">
      Volver al turno
    </Link>
  );
}

function CloseForm({
  expected,
  onSaving,
}: {
  expected: number;
  /** Avisa que se esta guardando el cierre, para que la pantalla no se vacie cuando el turno pase a «cerrado» a la mitad. */
  onSaving: (saving: boolean) => void;
}) {
  const { close } = useShift();
  const navigate = useNavigate();
  const { pending, problem, submit, clear } = useSubmit();
  const [text, setText] = useState('');
  const [missing, setMissing] = useState<string | undefined>();
  const counted = parseCash(text);

  async function onClose(amount: number) {
    onSaving(true);
    if (await submit(() => close(amount))) void navigate(SHIFT_PATH);
    else onSaving(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!counted.ok) {
      setMissing(counted.message);
      focusField(FIELD);
      return;
    }
    void onClose(counted.value);
  }

  const outcome = counted.ok
    ? { counted: counted.value, note: describeDifference(counted.value - expected) }
    : null;

  return (
    <>
      {problem !== null && (
        <FormAlert title="No pudimos cerrar el turno">{problem.message}</FormAlert>
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          id={FIELD}
          label="Efectivo contado"
          value={text}
          onChange={(value) => {
            setText(value);
            setMissing(undefined);
            clear();
          }}
          inputMode="numeric"
          autoComplete="off"
          hint="Billetes y monedas, sin contar lo que cobraste con otro medio."
          required
          disabled={pending}
          {...(missing === undefined ? {} : { error: missing })}
        />
        {outcome !== null && (
          <Callout
            tone={outcome.note.kind === 'balanced' ? 'ok' : 'warn'}
            title={outcome.note.title}
          >
            {`Esperabas ${formatPesos(expected)} y contaste ${formatPesos(outcome.counted)}.${outcome.note.kind === 'balanced' ? '' : ' Si cierras así, queda anotado.'}`}
          </Callout>
        )}
        <SubmitButton pending={pending} pendingLabel="Guardando…">
          Cerrar turno
        </SubmitButton>
      </form>
    </>
  );
}

/**
 * Cerrar el turno (C3-11, ADR 0026): la persona cuenta el efectivo de la caja y, mientras lo escribe, se le dice si cuadra, cuanto
 * falta o cuanto sobra. Cerrar con diferencia se permite: queda anotado, y la gerencia lo revisa.
 */
export function CloseShiftPage() {
  const { active } = useLocal();
  const { state } = useShift();
  const [saving, setSaving] = useState(false);
  // Al cerrar, el turno pasa a «cerrado» antes de que la accion termine: mientras tanto se sigue mostrando el formulario.
  const [lastOpen, setLastOpen] = useState<OpenState | null>(null);
  if (state.status === 'open' && lastOpen !== state) setLastOpen(state);
  if (active === null) return null;

  if (state.status === 'loading') {
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="text-base text-fg-muted">Cargando el turno…</p>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const open = state.status === 'open' ? state : saving ? lastOpen : null;
  if (open === null) {
    return (
      <>
        <Heading>No tienes un turno abierto que cerrar.</Heading>
        <BackToShift />
      </>
    );
  }
  return (
    <>
      <Heading>Cuenta el efectivo que hay en la caja y escríbelo. Te decimos si cuadra.</Heading>
      <CloseForm expected={open.summary.expectedAmount} onSaving={setSaving} />
      <BackToShift />
    </>
  );
}
