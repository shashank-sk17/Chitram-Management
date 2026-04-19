import {
  doc, getDoc, onSnapshot, collection, getDocs,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import {
  DEFAULT_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  type PermissionsMap,
  type PermissionsOverride,
} from '../../types/permissions';
import type { UserRole } from '../../types/claims';

const COL = 'featurePermissions';

// ── Doc ID helpers (mirrors analyticsVisibility pattern) ──────────────────────
export function roleDocId(role: UserRole): string { return role; }
export function projectDocId(projectId: string): string { return `project:${projectId}`; }
export function userDocId(uid: string): string { return `user:${uid}`; }

// ── Merge helpers ─────────────────────────────────────────────────────────────
/**
 * Build the resolved permissions for a user.
 * Resolution order (most specific wins):
 *   code defaults → Firestore role override → project override → user override
 */
export function mergePermissions(
  role: UserRole,
  roleOverride: PermissionsOverride | null,
  projectOverride: PermissionsOverride | null,
  userOverride: PermissionsOverride | null,
): PermissionsMap {
  const defaults = DEFAULT_PERMISSIONS[role] ?? buildFalseMap();
  return {
    ...defaults,
    ...(roleOverride ?? {}),
    ...(projectOverride ?? {}),
    ...(userOverride ?? {}),
  } as PermissionsMap;
}

function buildFalseMap(): PermissionsMap {
  return Object.fromEntries(ALL_PERMISSION_KEYS.map(k => [k, false])) as PermissionsMap;
}

// ── Role-level ────────────────────────────────────────────────────────────────
export async function getRolePermissions(role: UserRole): Promise<PermissionsMap> {
  const snap = await getDoc(doc(db, COL, roleDocId(role)));
  const defaults = DEFAULT_PERMISSIONS[role] ?? buildFalseMap();
  if (!snap.exists()) return { ...defaults };
  return { ...defaults, ...(snap.data()?.permissions ?? {}) };
}

export async function setRolePermissions(
  role: UserRole,
  permissions: PermissionsMap,
  _updaterUid: string,
): Promise<void> {
  const fn = httpsCallable(functions, 'adminSetFeaturePermissions');
  await fn({ docId: roleDocId(role), type: 'role', targetId: role, permissions });
}

export function subscribeRolePermissions(
  role: UserRole,
  callback: (override: PermissionsOverride | null) => void,
): () => void {
  return onSnapshot(doc(db, COL, roleDocId(role)), snap => {
    callback(snap.exists() ? (snap.data()?.permissions ?? null) : null);
  });
}

// ── Project-level override ────────────────────────────────────────────────────
export async function getProjectPermissionsOverride(projectId: string): Promise<PermissionsOverride | null> {
  const snap = await getDoc(doc(db, COL, projectDocId(projectId)));
  return snap.exists() ? (snap.data()?.permissions ?? null) : null;
}

export async function setProjectPermissionsOverride(
  projectId: string,
  permissions: PermissionsOverride,
  _updaterUid: string,
): Promise<void> {
  const fn = httpsCallable(functions, 'adminSetFeaturePermissions');
  await fn({ docId: projectDocId(projectId), type: 'project', targetId: projectId, permissions });
}

export async function deleteProjectPermissionsOverride(projectId: string): Promise<void> {
  const fn = httpsCallable(functions, 'adminDeleteFeaturePermissionsOverride');
  await fn({ docId: projectDocId(projectId) });
}

export function subscribeProjectPermissionsOverride(
  projectId: string,
  callback: (override: PermissionsOverride | null) => void,
): () => void {
  return onSnapshot(doc(db, COL, projectDocId(projectId)), snap => {
    callback(snap.exists() ? (snap.data()?.permissions ?? null) : null);
  });
}

// ── User-level override ───────────────────────────────────────────────────────
export async function getUserPermissionsOverride(uid: string): Promise<PermissionsOverride | null> {
  const snap = await getDoc(doc(db, COL, userDocId(uid)));
  return snap.exists() ? (snap.data()?.permissions ?? null) : null;
}

export async function setUserPermissionsOverride(
  uid: string,
  permissions: PermissionsOverride,
  _updaterUid: string,
): Promise<void> {
  const fn = httpsCallable(functions, 'adminSetFeaturePermissions');
  await fn({ docId: userDocId(uid), type: 'user', targetId: uid, permissions });
}

export async function deleteUserPermissionsOverride(uid: string): Promise<void> {
  const fn = httpsCallable(functions, 'adminDeleteFeaturePermissionsOverride');
  await fn({ docId: userDocId(uid) });
}

export function subscribeUserPermissionsOverride(
  uid: string,
  callback: (override: PermissionsOverride | null) => void,
): () => void {
  return onSnapshot(doc(db, COL, userDocId(uid)), snap => {
    callback(snap.exists() ? (snap.data()?.permissions ?? null) : null);
  });
}

// ── List all overrides (for admin page) ──────────────────────────────────────
export interface PermissionsOverrideDoc {
  id: string;
  type: 'role' | 'project' | 'user';
  targetId: string;
  permissions: PermissionsOverride;
  updatedAt?: any;
  updatedBy?: string;
}

export async function getAllPermissionsOverrides(): Promise<PermissionsOverrideDoc[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<PermissionsOverrideDoc, 'id'>) }))
    .filter(d => d.type === 'project' || d.type === 'user');
}
