/**
 * Una pantalla que todavia no se construye (el Ciclo 2 va pantalla por pantalla). Tiene su ruta, su guarda de permiso y su
 * titulo para que la navegacion ya funcione; el contenido llega con su propio paso.
 */
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold text-fg">{title}</h1>
      <p className="text-base text-fg-muted">Esta pantalla llega en el siguiente paso.</p>
    </section>
  );
}
