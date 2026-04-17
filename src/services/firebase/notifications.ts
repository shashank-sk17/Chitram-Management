import {
  collection, doc, addDoc, getDocs, updateDoc, query,
  where, orderBy, serverTimestamp, getCountFromServer, Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

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
  await addDoc(col(teacherUid), {
    ...payload,
    read: false,
    createdAt: serverTimestamp(),
  });
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
  await updateDoc(doc(col(teacherUid), notifId), { read: true });
}

export async function markAllNotificationsRead(teacherUid: string): Promise<void> {
  const unread = await getDocs(query(col(teacherUid), where('read', '==', false)));
  await Promise.all(unread.docs.map(d => updateDoc(d.ref, { read: true })));
}
