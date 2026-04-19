import {
  collection, onSnapshot,
  query, orderBy, where, getCountFromServer, Timestamp,
  limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';

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
  // Use submitWord CF for word submissions; for other notification types use CF directly
  const fn = httpsCallable(functions, 'markAdminNotificationRead');
  void fn; // kept for backward-compat callers; actual sends happen server-side in CFs
  // Legacy direct writes are no longer needed — admin notifications are created
  // by Cloud Functions (submitWord, adminApproveWord, adminRejectWord) as a side-effect.
  console.warn('sendAdminNotification: use submitWord CF instead of calling this directly.');
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
  const fn = httpsCallable(functions, 'markAdminNotificationRead');
  await fn({ notifId });
}

export async function markAllAdminNotificationsRead(): Promise<void> {
  const fn = httpsCallable(functions, 'markAllAdminNotificationsRead');
  await fn({});
}

export async function getUnreadAdminNotificationCount(): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, COL), where('read', '==', false)),
  );
  return snap.data().count;
}
