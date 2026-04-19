import { create } from 'zustand';
import { ALL_PERMISSION_KEYS, type PermissionsMap, type PermissionKey } from '../types/permissions';

const EMPTY_PERMISSIONS: PermissionsMap =
  Object.fromEntries(ALL_PERMISSION_KEYS.map(k => [k, false])) as PermissionsMap;

interface PermissionsState {
  /** Fully resolved permission map for the current user (defaults merged with Firestore overrides) */
  permissions: PermissionsMap;
  /** True while the initial Firestore subscription hasn't resolved yet */
  loading: boolean;
  setPermissions: (p: PermissionsMap) => void;
  setLoading: (v: boolean) => void;
  reset: () => void;
}

export const usePermissionsStore = create<PermissionsState>((set) => ({
  permissions: { ...EMPTY_PERMISSIONS },
  loading: true,

  // Atomic replacement — enables shallow equality in selectors to prevent unnecessary re-renders
  setPermissions: (permissions) => set({ permissions, loading: false }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ permissions: { ...EMPTY_PERMISSIONS }, loading: true }),
}));

/** Standalone selector — use inside usePermission hook */
export function selectCan(state: PermissionsState) {
  return (key: PermissionKey): boolean => state.permissions[key] ?? false;
}
