import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { usePermissionsStore } from '../stores/permissionsStore';
import {
  subscribeRolePermissions,
  subscribeProjectPermissionsOverride,
  subscribeUserPermissionsOverride,
  mergePermissions,
} from '../services/firebase/featurePermissions';
import type { UserRole } from '../types/claims';
import type { PermissionsOverride } from '../types/permissions';

/**
 * Sets up Firestore subscriptions for the current user's feature permissions.
 * Must be called once at the app root (alongside useAuth in App.tsx).
 * Writes the merged result into permissionsStore — all `usePermission()` calls
 * read from there without any extra subscriptions.
 */
export function usePermissionSubscription(): void {
  const user = useAuthStore(s => s.user);
  const claims = useAuthStore(s => s.claims);
  const { setPermissions, setLoading, reset } = usePermissionsStore.getState();

  // Mutable refs to hold current override values across subscription callbacks
  const roleOverrideRef = useRef<PermissionsOverride | null>(null);
  const projectOverrideRef = useRef<PermissionsOverride | null>(null);
  const userOverrideRef = useRef<PermissionsOverride | null>(null);

  useEffect(() => {
    // Not authenticated — reset to empty/loading
    if (!user || !claims) {
      reset();
      return;
    }

    const role = claims.role as UserRole;
    const projectId = claims.projectId;
    const uid = user.uid;

    setLoading(true);
    roleOverrideRef.current = null;
    projectOverrideRef.current = null;
    userOverrideRef.current = null;

    let roleResolved = false;

    function recompute() {
      const resolved = mergePermissions(
        role,
        roleOverrideRef.current,
        projectOverrideRef.current,
        userOverrideRef.current,
      );
      setPermissions(resolved);
    }

    // 1. Role-level subscription
    const unsubRole = subscribeRolePermissions(role, override => {
      roleOverrideRef.current = override;
      roleResolved = true;
      recompute();
    });

    // 2. Project-level subscription (only if user has a projectId claim)
    let unsubProject: (() => void) | null = null;
    if (projectId) {
      unsubProject = subscribeProjectPermissionsOverride(projectId, override => {
        projectOverrideRef.current = override;
        if (roleResolved) recompute();
      });
    }

    // 3. User-level subscription
    const unsubUser = subscribeUserPermissionsOverride(uid, override => {
      userOverrideRef.current = override;
      if (roleResolved) recompute();
    });

    return () => {
      unsubRole();
      unsubProject?.();
      unsubUser();
    };
  }, [user?.uid, claims?.role, claims?.projectId]);
}
