import { Button } from './Button';

/** Lo que se ve cuando una pantalla no pudo cargar lo que muestra: que paso, dicho en una frase, y como volver a intentar. */
export function LoadFailed({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface-raised p-4">
      <p className="text-lg font-semibold text-fg">{title}</p>
      <p className="text-base text-fg-muted">{message}</p>
      <Button onClick={onRetry}>Reintentar</Button>
    </div>
  );
}
