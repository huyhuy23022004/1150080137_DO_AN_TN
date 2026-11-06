import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { FullPageLoading } from '@/components/feedback/FullPageLoading';
import { useAuthStore } from '@/features/auth/auth.store';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'bootstrapping') {
    return <FullPageLoading />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
