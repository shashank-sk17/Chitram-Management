import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePermissionsStore } from '../stores/permissionsStore';
import type { PermissionKey } from '../types/permissions';

export interface UsePermissionReturn {
  /** Returns true if the current user has the given permission */
  can: (key: PermissionKey) => boolean;
  /** True while the initial Firestore subscription is resolving */
  loading: boolean;
}

/**
 * Public API for feature-level permission checks.
 * Reads from permissionsStore (pure Zustand selector — no Firestore calls, no subscriptions).
 *
 * Usage:
 *   const { can } = usePermission();
 *   {can('wordBank.approve') && <ApproveButton />}
 */
export function usePermission(): UsePermissionReturn {
  const { permissions, loading } = usePermissionsStore(
    useShallow(s => ({ permissions: s.permissions, loading: s.loading })),
  );

  const can = useCallback(
    (key: PermissionKey): boolean => permissions[key] ?? false,
    [permissions],
  );

  return { can, loading };
}
