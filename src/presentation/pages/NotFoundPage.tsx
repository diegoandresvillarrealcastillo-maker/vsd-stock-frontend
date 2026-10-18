import { Link } from 'react-router';

/** Una direccion que no es de ninguna pantalla. */
export function NotFoundPage() {
  return (
    <section className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-semibold text-fg">No encontramos esta página</h1>
      <p className="text-base text-fg-muted">
        Puede que la dirección esté mal escrita o que ya no exista.
      </p>
      <Link
        to="/"
        className="inline-flex min-h-touch items-center rounded-md bg-primary px-5 text-base font-medium text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Ir al inicio
      </Link>
    </section>
  );
}
