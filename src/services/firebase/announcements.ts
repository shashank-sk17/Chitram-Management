import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { AnnouncementDoc } from '../../types/firestore';

const COL = 'announcements';

export async function createAnnouncement(
  data: Omit<AnnouncementDoc, 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getAnnouncementsForClass(
  classId: string,
): Promise<Array<{ id: string } & AnnouncementDoc>> {
  const q = query(
    collection(db, COL),
    where('classId', '==', classId),
    orderBy('pinned', 'desc'),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as AnnouncementDoc) }));
}

export async function getAnnouncementsForTeacher(
  teacherUid: string,
): Promise<Array<{ id: string } & AnnouncementDoc>> {
  const q = query(
    collection(db, COL),
    where('teacherUid', '==', teacherUid),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as AnnouncementDoc) }));
}

export async function pinAnnouncement(announcementId: string, pinned: boolean): Promise<void> {
  await updateDoc(doc(db, COL, announcementId), { pinned });
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  await deleteDoc(doc(db, COL, announcementId));
}
