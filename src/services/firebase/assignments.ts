import {
  collection, doc, getDocs,
  query, where, collectionGroup,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import type { McqAssignmentDoc, StudentSubmissionDoc } from '../../types/firestore';

const COL = 'mcqAssignments';

export async function createMcqAssignment(
  data: Omit<McqAssignmentDoc, 'createdAt'>,
): Promise<string> {
  const fn = httpsCallable<unknown, { id: string }>(functions, 'teacherCreateMcqAssignment');
  const result = await fn({ data });
  return result.data.id;
}

export async function getMcqAssignmentsForClass(
  classId: string,
): Promise<Array<{ id: string } & McqAssignmentDoc>> {
  const q = query(collection(db, COL), where('classId', '==', classId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as McqAssignmentDoc) }));
}

export async function getMcqAssignmentsForTeacher(
  teacherUid: string,
): Promise<Array<{ id: string } & McqAssignmentDoc>> {
  const q = query(collection(db, COL), where('teacherUid', '==', teacherUid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as McqAssignmentDoc) }));
}

export async function getSubmissionsForAssignment(
  assignmentId: string,
): Promise<Array<{ id: string; uid: string } & StudentSubmissionDoc>> {
  // Query collectionGroup: studentAssignments/{uid}/submissions/{assignmentId}
  const q = query(
    collectionGroup(db, 'submissions'),
    where('assignmentId', '==', assignmentId),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const studentUid = d.ref.parent.parent?.id ?? '';
    return { id: d.id, ...(d.data() as StudentSubmissionDoc), uid: studentUid };
  });
}

export async function closeAssignment(assignmentId: string): Promise<void> {
  const fn = httpsCallable(functions, 'teacherUpdateAssignmentStatus');
  await fn({ assignmentId, status: 'closed' });
}

export async function publishAssignment(assignmentId: string): Promise<void> {
  const fn = httpsCallable(functions, 'teacherUpdateAssignmentStatus');
  await fn({ assignmentId, status: 'active' });
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  const fn = httpsCallable(functions, 'teacherUpdateAssignmentStatus');
  await fn({ assignmentId, status: 'closed' });
}
