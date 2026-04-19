import type { UserRole } from './claims';

export type PermissionKey =
  // ── Word Bank ────────────────────────────────────────────────────────────────
  | 'wordBank.view'
  | 'wordBank.create'
  | 'wordBank.edit'
  | 'wordBank.delete'
  | 'wordBank.approve'
  | 'wordBank.reject'

  // ── Users ────────────────────────────────────────────────────────────────────
  | 'users.view'
  | 'users.invite'
  | 'users.editRole'

  // ── Projects ─────────────────────────────────────────────────────────────────
  | 'projects.view'
  | 'projects.create'
  | 'projects.edit'
  | 'projects.delete'

  // ── Schools ──────────────────────────────────────────────────────────────────
  | 'schools.view'
  | 'schools.create'
  | 'schools.edit'
  | 'schools.delete'

  // ── Language Curricula ───────────────────────────────────────────────────────
  | 'curricula.view'
  | 'curricula.edit'
  | 'curricula.resetToSeed'

  // ── Curriculum Reviews (teacher submissions) ─────────────────────────────────
  | 'curriculumReviews.view'
  | 'curriculumReviews.approve'
  | 'curriculumReviews.reject'
  | 'curriculumReviews.edit'

  // ── Discounts ────────────────────────────────────────────────────────────────
  | 'discounts.view'
  | 'discounts.create'
  | 'discounts.toggle'

  // ── License Keys ─────────────────────────────────────────────────────────────
  | 'licenseKeys.view'
  | 'licenseKeys.generate'
  | 'licenseKeys.revoke'

  // ── Brand Profiles ───────────────────────────────────────────────────────────
  | 'brandProfiles.view'
  | 'brandProfiles.create'
  | 'brandProfiles.edit'
  | 'brandProfiles.delete'

  // ── Teacher: Classes ─────────────────────────────────────────────────────────
  | 'classes.view'
  | 'classes.create'
  | 'classes.manageStudents'

  // ── Teacher: Assignments ─────────────────────────────────────────────────────
  | 'assignments.view'
  | 'assignments.create'
  | 'assignments.publish'
  | 'assignments.close'
  | 'assignments.delete'

  // ── Teacher: Announcements ───────────────────────────────────────────────────
  | 'announcements.view'
  | 'announcements.create'
  | 'announcements.delete'

  // ── Teacher: Curriculum Editor ───────────────────────────────────────────────
  | 'curriculumEditor.view'
  | 'curriculumEditor.edit'

  // ── Word Review (contentReviewer) ────────────────────────────────────────────
  | 'wordReview.view'
  | 'wordReview.approve'
  | 'wordReview.reject'
  | 'wordReview.edit';

export type PermissionsMap = Record<PermissionKey, boolean>;
export type PermissionsOverride = Partial<PermissionsMap>;

/** All keys set to false — base for building role maps */
function allFalse(): PermissionsMap {
  const keys: PermissionKey[] = [
    'wordBank.view', 'wordBank.create', 'wordBank.edit', 'wordBank.delete', 'wordBank.approve', 'wordBank.reject',
    'users.view', 'users.invite', 'users.editRole',
    'projects.view', 'projects.create', 'projects.edit', 'projects.delete',
    'schools.view', 'schools.create', 'schools.edit', 'schools.delete',
    'curricula.view', 'curricula.edit', 'curricula.resetToSeed',
    'curriculumReviews.view', 'curriculumReviews.approve', 'curriculumReviews.reject', 'curriculumReviews.edit',
    'discounts.view', 'discounts.create', 'discounts.toggle',
    'licenseKeys.view', 'licenseKeys.generate', 'licenseKeys.revoke',
    'brandProfiles.view', 'brandProfiles.create', 'brandProfiles.edit', 'brandProfiles.delete',
    'classes.view', 'classes.create', 'classes.manageStudents',
    'assignments.view', 'assignments.create', 'assignments.publish', 'assignments.close', 'assignments.delete',
    'announcements.view', 'announcements.create', 'announcements.delete',
    'curriculumEditor.view', 'curriculumEditor.edit',
    'wordReview.view', 'wordReview.approve', 'wordReview.reject', 'wordReview.edit',
  ];
  return Object.fromEntries(keys.map(k => [k, false])) as PermissionsMap;
}

function allTrue(): PermissionsMap {
  const base = allFalse();
  for (const k of Object.keys(base) as PermissionKey[]) base[k] = true;
  return base;
}

/**
 * Hardcoded default permissions per role.
 * These are the fallback when no Firestore override doc exists.
 * Firestore overrides (role → project → user) are merged on top at runtime.
 */
export const DEFAULT_PERMISSIONS: Record<UserRole, PermissionsMap> = {
  admin: allTrue(),

  projectAdmin: {
    ...allFalse(),
    // Word Bank — can view and edit, but NOT create/delete/approve/reject globally
    'wordBank.view': true,
    'wordBank.edit': true,
    // Users — can view and invite, but NOT change roles
    'users.view': true,
    'users.invite': true,
    // Projects — can view and edit their own, NOT create/delete
    'projects.view': true,
    'projects.edit': true,
    // Schools — full CRUD except delete
    'schools.view': true,
    'schools.create': true,
    'schools.edit': true,
    // Curricula — can view, NOT edit or reset
    'curricula.view': true,
    // Curriculum Reviews — can review teacher submissions
    'curriculumReviews.view': true,
    'curriculumReviews.approve': true,
    'curriculumReviews.reject': true,
  },

  pm: {
    ...allFalse(),
    // Analytics-only role — section visibility handled by analyticsVisibility
  },

  principal: {
    ...allFalse(),
    // Analytics-only role — section visibility handled by analyticsVisibility
  },

  teacher: {
    ...allFalse(),
    // Classes
    'classes.view': true,
    'classes.create': true,
    'classes.manageStudents': true,
    // Assignments
    'assignments.view': true,
    'assignments.create': true,
    'assignments.publish': true,
    'assignments.close': true,
    'assignments.delete': true,
    // Announcements
    'announcements.view': true,
    'announcements.create': true,
    'announcements.delete': true,
    // Curriculum Editor
    'curriculumEditor.view': true,
    'curriculumEditor.edit': true,
  },

  contentWriter: {
    ...allFalse(),
    // Writer's workflow is fully under /writer/* (route-guarded separately)
    // No feature permissions needed here
  },

  contentReviewer: {
    ...allFalse(),
    // Word Review queue
    'wordReview.view': true,
    'wordReview.approve': true,
    'wordReview.reject': true,
    'wordReview.edit': true,
  },
};

/** Human-readable labels for each permission key, grouped by area */
export const PERMISSION_AREA_LABELS: Record<string, string> = {
  wordBank: 'Word Bank',
  users: 'Users',
  projects: 'Projects',
  schools: 'Schools',
  curricula: 'Language Curricula',
  curriculumReviews: 'Curriculum Reviews',
  discounts: 'Discounts',
  licenseKeys: 'License Keys',
  brandProfiles: 'Brand Profiles',
  classes: 'Classes',
  assignments: 'Assignments',
  announcements: 'Announcements',
  curriculumEditor: 'Curriculum Editor',
  wordReview: 'Word Review',
};

export const PERMISSION_ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  reject: 'Reject',
  invite: 'Invite',
  editRole: 'Edit Role',
  resetToSeed: 'Reset to Seed',
  toggle: 'Toggle Active/Inactive',
  generate: 'Generate',
  revoke: 'Revoke',
  publish: 'Publish',
  close: 'Close',
  manageStudents: 'Manage Students',
};

/** Parse 'area.action' → { area, action } */
export function parsePermissionKey(key: PermissionKey): { area: string; action: string } {
  const dot = key.indexOf('.');
  return { area: key.slice(0, dot), action: key.slice(dot + 1) };
}

/** Group permission keys by area */
export function groupPermissionKeys(keys: PermissionKey[]): Record<string, PermissionKey[]> {
  const groups: Record<string, PermissionKey[]> = {};
  for (const key of keys) {
    const { area } = parsePermissionKey(key);
    if (!groups[area]) groups[area] = [];
    groups[area].push(key);
  }
  return groups;
}

export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.keys(allFalse()) as PermissionKey[];
