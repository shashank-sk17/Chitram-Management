import {
  collection, getDocs,
  query, where, getCountFromServer,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import type { CurriculumEditDoc, CurriculumLevel, LanguageCode } from '../../types/firestore';

const COL = 'curriculumEdits';

export async function submitCurriculumEdit(
  data: {
    classId: string;
    proposedLevels: Array<{ levelNum: number; wordIds: string[] }>;
    newWords?: Array<Record<string, unknown>>;
    shareWithProject?: boolean;
  },
): Promise<string> {
  const fn = httpsCallable<unknown, { editId: string }>(functions, 'submitCurriculumEdit');
  const result = await fn(data);
  return result.data.editId;
}

export async function getCurriculumEditsForClass(
  classId: string,
): Promise<Array<{ id: string } & CurriculumEditDoc>> {
  const q = query(collection(db, COL), where('classId', '==', classId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as CurriculumEditDoc) }));
}

export async function getPendingEdits(
  projectId?: string,
): Promise<Array<{ id: string } & CurriculumEditDoc>> {
  let q = query(collection(db, COL), where('status', '==', 'pending'));
  if (projectId) q = query(q, where('projectId', '==', projectId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as CurriculumEditDoc) }));
}

export async function getAllEdits(
  projectId?: string,
): Promise<Array<{ id: string } & CurriculumEditDoc>> {
  let q = query(collection(db, COL));
  if (projectId) q = query(q, where('projectId', '==', projectId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as CurriculumEditDoc) }));
}

export async function getPendingEditsCount(): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, COL), where('status', '==', 'pending'))
  );
  return snap.data().count;
}

export async function approveCurriculumEdit(editId: string, _adminUid: string): Promise<void> {
  const fn = httpsCallable(functions, 'approveCurriculumEdit');
  await fn({ editId });
}

export async function rejectCurriculumEdit(
  editId: string,
  _adminUid: string,
  note: string,
): Promise<void> {
  const fn = httpsCallable(functions, 'rejectCurriculumEdit');
  await fn({ editId, note });
}

export async function getSharedCurricula(
  projectId: string,
  grade: number,
  language: LanguageCode,
): Promise<Array<{ id: string } & CurriculumEditDoc>> {
  const q = query(
    collection(db, COL),
    where('projectId', '==', projectId),
    where('grade', '==', grade),
    where('language', '==', language),
    where('status', '==', 'approved'),
    where('shareWithProject', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as CurriculumEditDoc) }));
}

export async function adoptSharedCurriculum(
  classId: string,
  editId: string,
  _resolvedLevels: CurriculumLevel[],
): Promise<void> {
  const fn = httpsCallable(functions, 'adoptCurriculumEdit');
  await fn({ classId, editId });
}
