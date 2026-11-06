import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import type { AdminRole } from '@/lib/roles';

interface RoleGuardProps {
  roles: readonly AdminRole[];
  children: ReactNode;
}

export function RoleGuard({ roles, children }: RoleGuardProps) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.ten_vai_tro)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
