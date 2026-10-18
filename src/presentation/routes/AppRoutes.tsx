import { Route, Routes } from 'react-router';
import { NAVIGATION } from '../../domain/model/navigation';
import { ComingSoonPage } from '../pages/ComingSoonPage';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { AppShell } from '../shell/AppShell';
import { RequireMembership, RequireNoMembership, SignedOutOnly } from './AccountGate';
import { RequireAction } from './RequireAction';

/**
 * Las rutas de la aplicacion. Quien no entro ve la pagina publica; quien entro y no tiene negocio, la de crearlo; quien lo
 * tiene, el marco con las pantallas que su rol puede usar. Las pantallas se construyen una a una: hasta entonces cada una
 * tiene su ruta y su guarda.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/ingresar"
        element={
          <SignedOutOnly>
            <HomePage />
          </SignedOutOnly>
        }
      />
      <Route
        path="/empezar"
        element={
          <RequireNoMembership>
            <main className="mx-auto max-w-md px-gutter py-10">
              <ComingSoonPage title="Crea tu negocio" />
            </main>
          </RequireNoMembership>
        }
      />
      <Route
        element={
          <RequireMembership>
            <AppShell />
          </RequireMembership>
        }
      >
        {NAVIGATION.map((item) => {
          const page = (
            <RequireAction action={item.action}>
              <ComingSoonPage title={item.label} />
            </RequireAction>
          );
          return item.path === '/' ? (
            <Route key={item.id} index element={page} />
          ) : (
            <Route key={item.id} path={`${item.path.slice(1)}/*`} element={page} />
          );
        })}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
