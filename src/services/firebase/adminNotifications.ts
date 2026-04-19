import {
  collection, addDoc, getDocs, updateDoc, doc, onSnapshot,
  query, orderBy, where, serverTimestamp, getCountFromServer, Timestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export type AdminNotificationType =
  | 'word_submitted'   // content writer submitted a new word for review
  | 'word_approved'    // reviewer approved a word → now live in curriculum
  | 'word_rejected';   // reviewer rejected a word

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  wordId: string;
  wordText: string;           // primary display text (te or en)
  grade?: number;
  wordType?: string;
  submittedBy?: string;
  submittedByName?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  rejectionNote?: string;
  projectId?: string;
  curricula?: string;         // e.g. "te_g2" — where it was added
  read: boolean;
  createdAt: Timestamp;
}

const COL = 'adminNotifications';

export async function sendAdminNotification(
  payload: Omit<AdminNotification, 'id' | 'read' | 'createdAt'>,
): Promise<void> {
  await addDoc(collection(db, COL), {
    ...payload,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export function subscribeAdminNotifications(
  cb: (notifications: AdminNotification[]) => void,
  maxCount = 60,
): () => void {
  const q = query(
    collection(db, COL),
    orderBy('createdAt', 'desc'),
    limit(maxCount),
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AdminNotification, 'id'>) })));
  });
}

export async function markAdminNotificationRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, COL, notifId), { read: true });
}

export async function markAllAdminNotificationsRead(): Promise<void> {
  const unread = await getDocs(query(collection(db, COL), where('read', '==', false)));
  await Promise.all(unread.docs.map(d => updateDoc(d.ref, { read: true })));
}

export async function getUnreadAdminNotificationCount(): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, COL), where('read', '==', false)),
  );
  return snap.data().count;
}
