import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router';
import type { Action } from '../../domain/model/permissions';
import { CloseShiftPage } from '../pages/CloseShiftPage';
import { CounterPage } from '../pages/CounterPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { PayPage } from '../pages/PayPage';
import { ReceiptPage } from '../pages/ReceiptPage';
import { RedeemPage } from '../pages/RedeemPage';
import { SaleDetailPage } from '../pages/SaleDetailPage';
import { SalesPage } from '../pages/SalesPage';
import { SellPage } from '../pages/SellPage';
import { ShiftPage } from '../pages/ShiftPage';
import { SignInPage } from '../pages/SignInPage';
import { SignUpPage } from '../pages/SignUpPage';
import { VoidSalePage } from '../pages/VoidSalePage';
import { AppShell } from '../shell/AppShell';
import { CounterShell } from '../shell/CounterShell';
import {
  RequireMembership,
  RequireNoMembership,
  RequireWorkspace,
  SignedOutOnly,
} from './AccountGate';
import { lazyScreen } from './lazy-screen';
import { RequireAction } from './RequireAction';

// C4-R0: las pantallas del marco de administracion bajan cuando alguien entra a ellas, no con el arranque. Entrar, empezar y el
// mostrador (lo que se usa todo el dia) siguen viajando con el arranque. `ScreenLoader`, en el marco, es donde esperan. Las 15 salen
// de un mismo archivo (`pages/administration.ts`): un solo `import()` es un solo trozo, que baja una vez.
const administration = () => import('../pages/administration');
const AdjustStockPage = lazyScreen(administration, 'AdjustStockPage');
const CatalogPage = lazyScreen(administration, 'CatalogPage');
const CategoriesPage = lazyScreen(administration, 'CategoriesPage');
const EditProductPage = lazyScreen(administration, 'EditProductPage');
const HomePage = lazyScreen(administration, 'HomePage');
const InvitePage = lazyScreen(administration, 'InvitePage');
const MonthlyReportPage = lazyScreen(administration, 'MonthlyReportPage');
const NewProductPage = lazyScreen(administration, 'NewProductPage');
const NewPurchasePage = lazyScreen(administration, 'NewPurchasePage');
const PeoplePage = lazyScreen(administration, 'PeoplePage');
const PersonPage = lazyScreen(administration, 'PersonPage');
const PurchasesPage = lazyScreen(administration, 'PurchasesPage');
const StockHistoryPage = lazyScreen(administration, 'StockHistoryPage');
const StockPage = lazyScreen(administration, 'StockPage');
const SuppliersPage = lazyScreen(administration, 'SuppliersPage');

/** Una pantalla con su guarda: la misma tabla de permisos que aplica el servidor (ADR 0017), como cortesia. */
function guarded(action: Action, screen: ReactNode) {
  return <RequireAction action={action}>{screen}</RequireAction>;
}

/**
 * Las rutas de la aplicacion. Quien no entro ve ingresar y crear cuenta; quien entro y no tiene negocio, crear el suyo o
 * canjear una invitacion; quien lo tiene, el marco con las pantallas que su rol puede usar. La accion de la pantalla principal
 * de cada seccion es la misma de `domain/model/navigation.ts`: lo que el menu ofrece es lo que la ruta deja abrir.
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
        path="/mostrador"
        element={
          <RequireWorkspace>
            <CounterShell />
          </RequireWorkspace>
        }
      >
        <Route index element={<SellPage />} />
        <Route path="cobrar" element={<PayPage />} />
        <Route path="comprobante" element={<ReceiptPage />} />
        <Route path="equipo" element={<CounterPage />} />
        <Route path="turno">
          <Route index element={<ShiftPage />} />
          <Route path="cerrar" element={<CloseShiftPage />} />
        </Route>
        {/* Las ventas se ven sin cuenta cargada (las de este equipo salen de la cola); solo anular pide el permiso. */}
        <Route path="ventas">
          <Route index element={<SalesPage />} />
          <Route path=":saleId" element={<SaleDetailPage />} />
          <Route path=":saleId/anular" element={guarded('sale:void', <VoidSalePage />)} />
        </Route>
      </Route>
      <Route
        element={
          <RequireMembership>
            <AppShell />
          </RequireMembership>
        }
      >
        <Route index element={guarded('product:view', <HomePage />)} />
        <Route path="catalogo">
          <Route index element={guarded('product:view', <CatalogPage />)} />
          <Route path="nuevo" element={guarded('product:manage', <NewProductPage />)} />
          <Route path="categorias" element={guarded('product:manage', <CategoriesPage />)} />
          <Route path=":productId" element={guarded('product:manage', <EditProductPage />)} />
        </Route>
        <Route path="inventario">
          <Route index element={guarded('stock:view', <StockPage />)} />
          <Route path=":productId" element={guarded('stock:view', <StockHistoryPage />)} />
          <Route path=":productId/ajustar" element={guarded('stock:adjust', <AdjustStockPage />)} />
        </Route>
        <Route path="compras">
          <Route index element={guarded('purchase:create', <PurchasesPage />)} />
          <Route path="nueva" element={guarded('purchase:create', <NewPurchasePage />)} />
          <Route path="proveedores" element={guarded('purchase:create', <SuppliersPage />)} />
        </Route>
        <Route path="reportes" element={guarded('report:sales', <MonthlyReportPage />)} />
        <Route path="personas">
          <Route index element={guarded('user:manage-cashiers', <PeoplePage />)} />
          <Route path="nueva" element={guarded('user:manage-cashiers', <InvitePage />)} />
          <Route path=":personId" element={guarded('user:manage-cashiers', <PersonPage />)} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
