import type { ReactNode } from 'react';
import { usePermission } from '../../hooks/usePermission';
import type { PermissionKey } from '../../types/permissions';

interface PermissionGateProps {
  /** The permission key to check */
  permKey: PermissionKey;
  /** Content to render when the user has the permission */
  children: ReactNode;
  /** Content to render when the user lacks the permission (default: nothing) */
  fallback?: ReactNode;
}

/**
 * Declarative permission gate. Renders children only when the current user
 * has the specified permission. Returns null (not the fallback) while loading
 * to prevent a flash of visible-then-hidden action buttons.
 *
 * Usage:
 *   <PermissionGate permKey="wordBank.approve">
 *     <button onClick={approve}>Approve</button>
 *   </PermissionGate>
 */
export function PermissionGate({ permKey, children, fallback = null }: PermissionGateProps) {
  const { can, loading } = usePermission();
  if (loading) return null;
  return can(permKey) ? <>{children}</> : <>{fallback}</>;
}
