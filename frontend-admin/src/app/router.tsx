import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ForbiddenPage } from '@/components/feedback/ForbiddenPage';
import { FullPageLoading } from '@/components/feedback/FullPageLoading';
import { NotFoundPage } from '@/components/feedback/NotFoundPage';
import { AuthGuard } from '@/components/guards/AuthGuard';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/features/auth/auth.store';
import { getLandingPath } from '@/lib/roles';
import { APP_ROUTES, PROFILE_ROLES } from './route-meta';

const LoginPage = lazy(async () => {
  const module = await import('@/features/auth/pages/LoginPage');
  return { default: module.LoginPage };
});

const ProfilePage = lazy(async () => {
  const module = await import('@/features/auth/pages/ProfilePage');
  return { default: module.ProfilePage };
});

const DashboardPage = lazy(async () => {
  const module = await import('@/features/dashboard/pages/DashboardPage');
  return { default: module.DashboardPage };
});

const BranchesPage = lazy(async () => {
  const module = await import('@/features/branches/pages/BranchesPage');
  return { default: module.BranchesPage };
});

const UsersPage = lazy(async () => {
  const module = await import('@/features/users/pages/UsersPage');
  return { default: module.UsersPage };
});

const VehicleTypesPage = lazy(async () => {
  const module = await import('@/features/vehicle-types/pages/VehicleTypesPage');
  return { default: module.VehicleTypesPage };
});

const VehiclesPage = lazy(async () => {
  const module = await import('@/features/vehicles/pages/VehiclesPage');
  return { default: module.VehiclesPage };
});

const RoutesPage = lazy(async () => {
  const module = await import('@/features/routes/pages/RoutesPage');
  return { default: module.RoutesPage };
});

const TripsPage = lazy(async () => {
  const module = await import('@/features/trips/pages/TripsPage');
  return { default: module.TripsPage };
});

const CounterPage = lazy(async () => {
  const module = await import('@/features/counter/pages/CounterPage');
  return { default: module.CounterPage };
});

const OrdersPage = lazy(async () => {
  const module = await import('@/features/orders/pages/OrdersPage');
  return { default: module.OrdersPage };
});

function withSuspense(element: ReactNode): ReactNode {
  return <Suspense fallback={<FullPageLoading message="Đang tải trang..." />}>{element}</Suspense>;
}

function withRoles(path: string, element: ReactNode): ReactNode {
  const roles = APP_ROUTES.find((route) => route.path === path)?.roles ?? PROFILE_ROLES;
  return <RoleGuard roles={roles}>{withSuspense(element)}</RoleGuard>;
}

function LandingRedirect() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getLandingPath(user.ten_vai_tro)} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={withSuspense(<LoginPage />)} />

      <Route
        path="/"
        element={
          <AuthGuard>
            <AdminLayout />
          </AuthGuard>
        }
      >
        <Route index element={<LandingRedirect />} />
        <Route path="dashboard" element={withRoles('/dashboard', <DashboardPage />)} />
        <Route path="branches" element={withRoles('/branches', <BranchesPage />)} />
        <Route path="users" element={withRoles('/users', <UsersPage />)} />
        <Route path="vehicle-types" element={withRoles('/vehicle-types', <VehicleTypesPage />)} />
        <Route path="vehicles" element={withRoles('/vehicles', <VehiclesPage />)} />
        <Route path="routes" element={withRoles('/routes', <RoutesPage />)} />
        <Route path="trips" element={withRoles('/trips', <TripsPage />)} />
        <Route path="counter" element={withRoles('/counter', <CounterPage />)} />
        <Route path="orders" element={withRoles('/orders', <OrdersPage />)} />
        <Route
          path="profile"
          element={<RoleGuard roles={PROFILE_ROLES}>{withSuspense(<ProfilePage />)}</RoleGuard>}
        />
        <Route path="403" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
