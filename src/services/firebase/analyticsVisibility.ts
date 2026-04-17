import {
  doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp, collection, getDocs,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export type VisibilityRole = 'pm' | 'principal' | 'projectAdmin' | 'teacher';

export interface AnalyticsSections {
  overviewStats: boolean;
  engagementMetrics: boolean;
  studentTable: boolean;
  teacherTable: boolean;
  gradeDistribution: boolean;
  gamification: boolean;
  atRiskStudents: boolean;
  hardestWords: boolean;
  assignmentMetrics: boolean;
}

// Partial override — only specified keys override the inherited value
export type SectionsOverride = Partial<AnalyticsSections>;

export const DEFAULT_SECTIONS: AnalyticsSections = {
  overviewStats: true,
  engagementMetrics: true,
  studentTable: true,
  teacherTable: true,
  gradeDistribution: true,
  gamification: true,
  atRiskStudents: true,
  hardestWords: true,
  assignmentMetrics: true,
};

export const SECTION_LABELS: Record<keyof AnalyticsSections, string> = {
  overviewStats: 'Overview Stats',
  engagementMetrics: 'Engagement Metrics',
  studentTable: 'Student Table',
  teacherTable: 'Teacher Table',
  gradeDistribution: 'Grade Distribution',
  gamification: 'Gamification',
  atRiskStudents: 'At-Risk Students',
  hardestWords: 'Hardest Words',
  assignmentMetrics: 'Assignment Metrics',
};

const COL = 'analyticsVisibility';

// ── Doc ID helpers ────────────────────────────────────────────────────────────
export function roleDocId(role: VisibilityRole) { return role; }
export function projectDocId(projectId: string) { return `project:${projectId}`; }
export function userDocId(uid: string) { return `user:${uid}`; }

// ── Merge helpers ─────────────────────────────────────────────────────────────
/** Merge role defaults → project override → user override (most specific wins) */
export function mergeSections(
  roleSections: AnalyticsSections,
  projectOverride: SectionsOverride | null,
  userOverride: SectionsOverride | null,
): AnalyticsSections {
  return {
    ...roleSections,
    ...(projectOverride ?? {}),
    ...(userOverride ?? {}),
  } as AnalyticsSections;
}

// ── Role-level (existing) ─────────────────────────────────────────────────────
export async function getAnalyticsVisibility(role: VisibilityRole): Promise<AnalyticsSections> {
  const snap = await getDoc(doc(db, COL, roleDocId(role)));
  if (!snap.exists()) return { ...DEFAULT_SECTIONS };
  return { ...DEFAULT_SECTIONS, ...(snap.data()?.sections ?? {}) };
}

export async function setAnalyticsVisibility(
  role: VisibilityRole,
  sections: AnalyticsSections,
  updaterUid: string,
): Promise<void> {
  await setDoc(doc(db, COL, roleDocId(role)), {
    type: 'role', targetId: role, sections,
    updatedAt: serverTimestamp(), updatedBy: updaterUid,
  });
}

export function subscribeAnalyticsVisibility(
  role: VisibilityRole,
  callback: (sections: AnalyticsSections) => void,
): () => void {
  return onSnapshot(doc(db, COL, roleDocId(role)), snap => {
    callback(snap.exists()
      ? { ...DEFAULT_SECTIONS, ...(snap.data()?.sections ?? {}) }
      : { ...DEFAULT_SECTIONS });
  });
}

// ── Project-level override ────────────────────────────────────────────────────
export async function getProjectOverride(projectId: string): Promise<SectionsOverride | null> {
  const snap = await getDoc(doc(db, COL, projectDocId(projectId)));
  return snap.exists() ? (snap.data()?.sections ?? null) : null;
}

export async function setProjectOverride(
  projectId: string,
  sections: SectionsOverride,
  updaterUid: string,
): Promise<void> {
  await setDoc(doc(db, COL, projectDocId(projectId)), {
    type: 'project', targetId: projectId, sections,
    updatedAt: serverTimestamp(), updatedBy: updaterUid,
  });
}

export async function deleteProjectOverride(projectId: string): Promise<void> {
  await deleteDoc(doc(db, COL, projectDocId(projectId)));
}

export function subscribeProjectOverride(
  projectId: string,
  callback: (override: SectionsOverride | null) => void,
): () => void {
  return onSnapshot(doc(db, COL, projectDocId(projectId)), snap => {
    callback(snap.exists() ? (snap.data()?.sections ?? null) : null);
  });
}

// ── User-level override ───────────────────────────────────────────────────────
export async function getUserOverride(uid: string): Promise<SectionsOverride | null> {
  const snap = await getDoc(doc(db, COL, userDocId(uid)));
  return snap.exists() ? (snap.data()?.sections ?? null) : null;
}

export async function setUserOverride(
  uid: string,
  sections: SectionsOverride,
  updaterUid: string,
): Promise<void> {
  await setDoc(doc(db, COL, userDocId(uid)), {
    type: 'user', targetId: uid, sections,
    updatedAt: serverTimestamp(), updatedBy: updaterUid,
  });
}

export async function deleteUserOverride(uid: string): Promise<void> {
  await deleteDoc(doc(db, COL, userDocId(uid)));
}

export function subscribeUserOverride(
  uid: string,
  callback: (override: SectionsOverride | null) => void,
): () => void {
  return onSnapshot(doc(db, COL, userDocId(uid)), snap => {
    callback(snap.exists() ? (snap.data()?.sections ?? null) : null);
  });
}

// ── List all overrides (for admin page) ──────────────────────────────────────
export interface VisibilityOverrideDoc {
  id: string;
  type: 'role' | 'project' | 'user';
  targetId: string;
  sections: SectionsOverride;
  updatedAt?: any;
  updatedBy?: string;
}

export async function getAllOverrides(): Promise<VisibilityOverrideDoc[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<VisibilityOverrideDoc, 'id'>) }))
    .filter(d => d.type === 'project' || d.type === 'user');
}
