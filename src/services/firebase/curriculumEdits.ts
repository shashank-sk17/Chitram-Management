import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, serverTimestamp, getCountFromServer, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import type { CurriculumEditDoc, CurriculumLevel, LanguageCode, ClassCustomCurriculum } from '../../types/firestore';

const COL = 'curriculumEdits';

export async function submitCurriculumEdit(
  data: Omit<CurriculumEditDoc, 'submittedAt' | 'status' | 'adoptedBy' | 'resolvedLevels'>,
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    status: 'pending',
    adoptedBy: [],
    submittedAt: serverTimestamp(),
  });
  return ref.id;
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

export async function approveCurriculumEdit(editId: string, adminUid: string): Promise<void> {
  // Try Cloud Function first; fall back to direct write if CF not deployed
  try {
    const fn = httpsCallable(functions, 'approveCurriculumEdit');
    await fn({ editId });
  } catch {
    // Fallback: directly update the edit status + apply to class
    const editSnap = await getDoc(doc(db, COL, editId));
    if (!editSnap.exists()) throw new Error('Edit not found');
    const edit = editSnap.data() as CurriculumEditDoc;
    const resolvedLevels = edit.resolvedLevels ?? edit.proposedLevels;

    await updateDoc(doc(db, COL, editId), {
      status: 'approved',
      reviewedBy: adminUid,
      reviewedAt: serverTimestamp(),
      resolvedLevels,
    });

    // Write customCurriculum to the class
    const customCurriculum: ClassCustomCurriculum = {
      levels: resolvedLevels,
      adoptedFrom: editId,
      appliedAt: Timestamp.now(),
    };
    await updateDoc(doc(db, 'classes', edit.classId), { customCurriculum });
  }
}

export async function rejectCurriculumEdit(
  editId: string,
  adminUid: string,
  note: string,
): Promise<void> {
  await updateDoc(doc(db, COL, editId), {
    status: 'rejected',
    rejectionNote: note,
    reviewedBy: adminUid,
    reviewedAt: serverTimestamp(),
  });
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
  resolvedLevels: CurriculumLevel[],
): Promise<void> {
  const customCurriculum: ClassCustomCurriculum = {
    levels: resolvedLevels,
    adoptedFrom: editId,
    appliedAt: Timestamp.now(),
  };
  await updateDoc(doc(db, 'classes', classId), { customCurriculum });
  // Track adoption
  const editSnap = await getDoc(doc(db, COL, editId));
  if (editSnap.exists()) {
    const current = (editSnap.data() as CurriculumEditDoc).adoptedBy ?? [];
    if (!current.includes(classId)) {
      await updateDoc(doc(db, COL, editId), { adoptedBy: [...current, classId] });
    }
  }
}
