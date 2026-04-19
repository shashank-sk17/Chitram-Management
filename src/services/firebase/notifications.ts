import {
  collection, getDocs, query,
  where, orderBy, getCountFromServer, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';

export interface TeacherNotification {
  id: string;
  type: 'curriculum_approved' | 'curriculum_rejected' | 'word_edited';
  classId: string;
  editId: string;
  wordId?: string;
  message: string;
  adminNote?: string;
  read: boolean;
  createdAt: Timestamp;
}

const col = (teacherUid: string) =>
  collection(db, 'teacherNotifications', teacherUid, 'items');

export async function sendTeacherNotification(
  teacherUid: string,
  payload: Omit<TeacherNotification, 'id' | 'read' | 'createdAt'>,
): Promise<void> {
  const fn = httpsCallable(functions, 'sendTeacherNotification');
  await fn({ teacherUid, payload });
}

export async function getTeacherNotifications(
  teacherUid: string,
): Promise<TeacherNotification[]> {
  const q = query(col(teacherUid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<TeacherNotification, 'id'>) }));
}

export async function getUnreadNotificationCount(teacherUid: string): Promise<number> {
  const snap = await getCountFromServer(
    query(col(teacherUid), where('read', '==', false))
  );
  return snap.data().count;
}

export async function markNotificationRead(teacherUid: string, notifId: string): Promise<void> {
  const fn = httpsCallable(functions, 'teacherMarkNotificationRead');
  await fn({ teacherUid, notifId });
}

export async function markAllNotificationsRead(teacherUid: string): Promise<void> {
  const fn = httpsCallable(functions, 'teacherMarkAllNotificationsRead');
  await fn({ teacherUid });
}
