import type { HTMLInputTypeAttribute, KeyboardEvent } from 'react';

export interface FieldOption {
  readonly value: string;
  readonly label: string;
}

interface FormFieldProps {
  /** El `id` del campo: une la etiqueta y las ayudas con el campo para los lectores de pantalla. */
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: HTMLInputTypeAttribute;
  name?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'numeric' | 'decimal' | 'tel' | 'search';
  /** `characters` para un codigo que se dicta en mayusculas. */
  autoCapitalize?: 'off' | 'none' | 'sentences' | 'words' | 'characters';
  spellCheck?: boolean;
  /** Un ejemplo de lo que se escribe. No reemplaza a la etiqueta. */
  placeholder?: string;
  /** Una ayuda corta bajo el campo. Si hay un error, se muestra el error en su lugar. */
  hint?: string;
  /** Lo que esta mal en este campo, dicho en una frase. */
  error?: string;
  disabled?: boolean;
  /** Se lo dice a los lectores de pantalla. El navegador no valida: los mensajes son los nuestros (y los del servidor). */
  required?: boolean;
  /** Si se da, el campo es una lista corta de opciones en vez de un texto. */
  options?: readonly FieldOption[];
  /** Cada tecla que se pulsa en el campo de texto: por ejemplo el Enter con que un lector de codigos termina de leer. */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

const CONTROL =
  'min-h-touch w-full rounded-md border bg-surface-raised px-3 text-base text-fg shadow-sm placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60';

/**
 * Un campo de formulario accesible: la etiqueta esta unida al campo, la ayuda y el error se leen con el campo
 * (`aria-describedby`), un campo con error se marca como invalido y el color nunca es lo unico que lo dice: el error es
 * una frase. Mide al menos 44 px de alto (objetivo tactil, ADR 0008).
 */
export function FormField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  name,
  autoComplete,
  inputMode,
  autoCapitalize,
  spellCheck,
  placeholder,
  hint,
  error,
  disabled = false,
  required = false,
  options,
  onKeyDown,
}: FormFieldProps) {
  const messageId = `${id}-mensaje`;
  const message = error ?? hint;
  const common = {
    id,
    ...(name === undefined ? {} : { name }),
    disabled,
    'aria-required': required ? (true as const) : undefined,
    'aria-invalid': error === undefined ? undefined : (true as const),
    'aria-describedby': message === undefined ? undefined : messageId,
    className: `${CONTROL} ${error === undefined ? 'border-border' : 'border-accent-text border-2'}`,
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-base font-medium text-fg">
        {label}
      </label>
      {options === undefined ? (
        <input
          {...common}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...(onKeyDown === undefined ? {} : { onKeyDown })}
          {...(autoComplete === undefined ? {} : { autoComplete })}
          {...(inputMode === undefined ? {} : { inputMode })}
          {...(autoCapitalize === undefined ? {} : { autoCapitalize })}
          {...(spellCheck === undefined ? {} : { spellCheck })}
          {...(placeholder === undefined ? {} : { placeholder })}
        />
      ) : (
        <select {...common} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {message !== undefined && (
        <p
          id={messageId}
          className={`text-sm ${error === undefined ? 'text-fg-muted' : 'text-accent-text'}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
