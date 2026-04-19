import {
  collection, getDocs,
  query, where, orderBy,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import type { AnnouncementDoc } from '../../types/firestore';

const COL = 'announcements';

export async function createAnnouncement(
  data: Omit<AnnouncementDoc, 'createdAt'>,
): Promise<string> {
  const fn = httpsCallable<unknown, { id: string }>(functions, 'teacherCreateAnnouncement');
  const result = await fn({ data });
  return result.data.id;
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
  const fn = httpsCallable(functions, 'teacherPinAnnouncement');
  await fn({ announcementId, pinned });
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const fn = httpsCallable(functions, 'teacherDeleteAnnouncement');
  await fn({ announcementId });
}
