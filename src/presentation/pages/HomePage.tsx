import { useMembership } from '../auth/AuthProvider';
import { ConnectionPanel } from '../components/ConnectionPanel';

/**
 * El inicio de quien ya entro: a que negocio pertenece y si el servidor responde. El resumen del dia llega con las
 * pantallas de ventas.
 */
export function HomePage() {
  const membership = useMembership();
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Inicio</h1>
        {membership !== null && (
          <p className="text-base text-fg-muted">
            Hola, {membership.fullName}. Estás en {membership.businessName}.
          </p>
        )}
      </div>
      <section aria-labelledby="conexion-titulo" className="flex flex-col gap-3">
        <h2 id="conexion-titulo" className="text-xl font-semibold text-fg">
          Estado del servicio
        </h2>
        <p className="text-sm text-fg-muted">
          Lo comprobamos con el servidor: que tu equipo diga que hay red no basta.
        </p>
        <ConnectionPanel />
      </section>
    </section>
  );
}
