/** Lo que ve quien escribe la direccion de una pantalla que su rol no puede usar. El servidor tambien lo niega. */
export function ForbiddenPage() {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold text-fg">No tienes acceso</h1>
      <p className="text-base text-fg-muted">
        Tu rol no permite ver esta pantalla. Si la necesitas, pídele acceso a quien administra el
        negocio.
      </p>
    </section>
  );
}
