import { Route, Routes } from 'react-router';
import { NAVIGATION, type NavItem } from '../../domain/model/navigation';
import { ComingSoonPage } from '../pages/ComingSoonPage';
import { HomePage } from '../pages/HomePage';
import { InvitePage } from '../pages/InvitePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { PeoplePage } from '../pages/PeoplePage';
import { PersonPage } from '../pages/PersonPage';
import { RedeemPage } from '../pages/RedeemPage';
import { SignInPage } from '../pages/SignInPage';
import { SignUpPage } from '../pages/SignUpPage';
import { AppShell } from '../shell/AppShell';
import { RequireMembership, RequireNoMembership, SignedOutOnly } from './AccountGate';
import { RequireAction } from './RequireAction';

/** La pantalla de cada entrada del menu. Las que todavia no se construyen son un titulo con su guarda. */
function screenOf(item: NavItem) {
  if (item.id === 'home') return <HomePage />;
  if (item.id === 'people') return <PeoplePage />;
  return <ComingSoonPage title={item.label} />;
}

/**
 * Las rutas de la aplicacion. Quien no entro ve ingresar y crear cuenta; quien entro y no tiene negocio, crear el suyo o
 * canjear una invitacion; quien lo tiene, el marco con las pantallas que su rol puede usar. Las pantallas se construyen una
 * a una: hasta entonces cada una tiene su ruta y su guarda.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/ingresar"
        element={
          <SignedOutOnly>
            <SignInPage />
          </SignedOutOnly>
        }
      />
      <Route
        path="/registrarse"
        element={
          <SignedOutOnly>
            <SignUpPage />
          </SignedOutOnly>
        }
      />
      <Route
        path="/empezar"
        element={
          <RequireNoMembership>
            <OnboardingPage />
          </RequireNoMembership>
        }
      />
      <Route
        path="/invitacion"
        element={
          <RequireNoMembership>
            <RedeemPage />
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
          const page = <RequireAction action={item.action}>{screenOf(item)}</RequireAction>;
          if (item.path === '/') return <Route key={item.id} index element={page} />;
          if (item.id === 'people') {
            return (
              <Route key={item.id} path="personas">
                <Route index element={page} />
                <Route
                  path="nueva"
                  element={
                    <RequireAction action={item.action}>
                      <InvitePage />
                    </RequireAction>
                  }
                />
                <Route
                  path=":personId"
                  element={
                    <RequireAction action={item.action}>
                      <PersonPage />
                    </RequireAction>
                  }
                />
              </Route>
            );
          }
          return <Route key={item.id} path={`${item.path.slice(1)}/*`} element={page} />;
        })}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
