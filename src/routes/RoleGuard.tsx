import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { UserRole } from '../types/claims';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { claims } = useAuthStore();

  if (!claims || !allowedRoles.includes(claims.role)) {
    return <Navigate to="/denied" replace />;
  }

  return <>{children}</>;
}
