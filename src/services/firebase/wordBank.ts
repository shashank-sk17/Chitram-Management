import {
  collection, doc, getDoc, getDocs, updateDoc, addDoc,
  query, where, orderBy, startAfter, limit,
  getCountFromServer, serverTimestamp,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../../config/firebase';
import type { WordBankDoc, LanguageCode } from '../../types/firestore';
import { sendAdminNotification } from './adminNotifications';

const COL = 'wordBank';

export interface WordBankFilters {
  status?: 'active' | 'pending' | 'rejected';
  /** Filter to words with this language in their approvedLanguages array */
  approvedLanguage?: LanguageCode;
  wordType?: 'NS360' | 'GQD';
  difficulty?: 'Low' | 'Medium' | 'High';
  search?: string;
  projectId?: string;
}

export async function getWordBankPage(
  filters: WordBankFilters = {},
  lastDoc?: QueryDocumentSnapshot,
  pageSize = 50,
): Promise<{ words: Array<{ id: string } & WordBankDoc>; lastDoc: QueryDocumentSnapshot | null }> {
  let q = query(collection(db, COL), orderBy('numericId', 'asc'));

  if (filters.status) q = query(q, where('status', '==', filters.status));
  if (filters.approvedLanguage) q = query(q, where('approvedLanguages', 'array-contains', filters.approvedLanguage));
  if (filters.wordType) q = query(q, where('wordType', '==', filters.wordType));
  if (filters.difficulty) q = query(q, where('difficulty', '==', filters.difficulty));
  if (filters.projectId) q = query(q, where('projectId', '==', filters.projectId));
  if (lastDoc) q = query(q, startAfter(lastDoc));
  q = query(q, limit(pageSize));

  const snap = await getDocs(q);
  let words = snap.docs.map(d => ({ id: d.id, ...(d.data() as WordBankDoc) }));

  // Client-side search filter (Firestore has no full-text)
  if (filters.search) {
    const term = filters.search.toLowerCase();
    words = words.filter(w =>
      Object.values(w.word ?? {}).some(v => v?.toLowerCase().includes(term)) ||
      Object.values(w.meaning ?? {}).some(v => v?.toLowerCase().includes(term))
    );
  }

  return {
    words,
    lastDoc: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot : null,
  };
}

export async function getWordBankByIds(ids: string[]): Promise<Record<string, WordBankDoc>> {
  if (ids.length === 0) return {};
  const result: Record<string, WordBankDoc> = {};
  // Batch in chunks of 30
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    await Promise.all(
      chunk.map(async id => {
        const snap = await getDoc(doc(db, COL, id));
        if (snap.exists()) result[id] = snap.data() as WordBankDoc;
      })
    );
  }
  return result;
}

export async function getWordById(wordId: string): Promise<({ id: string } & WordBankDoc) | null> {
  const snap = await getDoc(doc(db, COL, wordId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as WordBankDoc) };
}

export async function updateWord(wordId: string, data: Partial<WordBankDoc>): Promise<void> {
  const fn = httpsCallable(functions, 'adminUpdateWord');
  await fn({ wordId, data });
}

export async function bulkDeleteWords(wordIds: string[]): Promise<void> {
  const fn = httpsCallable(functions, 'adminBulkDeleteWords');
  await fn({ wordIds });
}

export async function bulkSetWordActive(wordIds: string[], active: boolean): Promise<void> {
  const fn = httpsCallable(functions, 'adminBulkSetWordActive');
  await fn({ wordIds, active });
}

export async function approveWord(wordId: string, _adminUid: string, _adminName?: string): Promise<void> {
  const fn = httpsCallable(functions, 'adminApproveWord');
  await fn({ wordId });
}

export async function rejectWord(wordId: string, _adminUid: string, note: string, _adminName?: string): Promise<void> {
  const fn = httpsCallable(functions, 'adminRejectWord');
  await fn({ wordId, note });
}

export async function notifyWordSubmitted(
  wordId: string,
  wordData: Partial<WordBankDoc>,
): Promise<void> {
  const wordText = wordData.word?.te || wordData.word?.en || wordId;
  await sendAdminNotification({
    type: 'word_submitted',
    wordId,
    wordText,
    grade: wordData.gradeContext,
    wordType: wordData.wordType,
    submittedBy: wordData.submittedBy,
    submittedByName: wordData.submittedByName,
    projectId: wordData.projectId,
  });
}

export async function getTeacherPendingWords(
  teacherUid: string,
): Promise<Array<{ id: string } & WordBankDoc>> {
  const q = query(
    collection(db, COL),
    where('status', '==', 'pending'),
    where('submittedBy', '==', teacherUid),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as WordBankDoc) }));
}

export async function getPendingWordsCount(): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, COL), where('status', '==', 'pending'))
  );
  return snap.data().count;
}

/** Upload a single image file to storage and return its download URL (no Firestore write). */
export async function uploadWordImageFile(wordId: string, file: File, index: number): Promise<string> {
  const path = `wordbank-images/${wordId}/image_${index}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

/** Upload a single image and immediately update the word's imageUrls array in Firestore. */
export async function uploadWordImage(wordId: string, file: File, index: number = 0): Promise<string> {
  const url = await uploadWordImageFile(wordId, file, index);
  const path = `wordbank-images/${wordId}/image_${index}.jpg`;

  const snap = await getDoc(doc(db, COL, wordId));
  const existing = snap.exists() ? (snap.data() as any) : {};
  const imageUrls: (string | null)[] = [...(existing.imageUrls ?? [])];
  const imagePaths: (string | null)[] = [...(existing.imageStoragePaths ?? [])];
  while (imageUrls.length <= index) imageUrls.push(null);
  while (imagePaths.length <= index) imagePaths.push(null);
  imageUrls[index] = url;
  imagePaths[index] = path;

  const trimmed = imageUrls.filter(Boolean) as string[];
  await updateDoc(doc(db, COL, wordId), {
    imageUrl: trimmed[0] ?? null,
    imageStoragePath: imagePaths[0] ?? null,
    imageUrls: trimmed,
    imageStoragePaths: imagePaths.filter(Boolean),
    updatedAt: serverTimestamp(),
  });
  return url;
}

/** Overwrite the word's entire imageUrls array in Firestore (used after bulk slot edits). */
export async function setWordImageUrls(wordId: string, imageUrls: string[]): Promise<void> {
  await updateDoc(doc(db, COL, wordId), {
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    updatedAt: serverTimestamp(),
  });
}

export interface TeacherMeta {
  teacherUid: string;
  teacherName?: string;
  schoolId?: string;
  schoolName?: string;
  projectId?: string;
  gradeContext?: number;
}

export async function createPendingWord(
  data: Omit<Partial<WordBankDoc>, 'status' | 'createdAt' | 'updatedAt'>,
  meta: TeacherMeta | string,
): Promise<string> {
  // Accept either legacy string (teacherUid) or full TeacherMeta object
  const teacherMeta: TeacherMeta = typeof meta === 'string' ? { teacherUid: meta } : meta;
  const { teacherUid, teacherName, schoolId, schoolName, projectId, gradeContext } = teacherMeta;

  const empty: Record<LanguageCode, string> = { te: '', en: '', hi: '', es: '', fr: '' };
  const emptyNull: Record<LanguageCode, null> = { te: null, en: null, hi: null, es: null, fr: null };

  const ref2 = await addDoc(collection(db, COL), {
    numericId: 0,
    status: 'pending',
    active: false,
    approvedLanguages: [],
    wordType: 'NS360',
    difficulty: 'Medium',
    word: { ...empty },

    meaning: { ...empty },
    sentence: { ...empty },
    imageUrl: null,
    audioUrl: { word: { ...emptyNull }, meaning: { ...emptyNull }, sentence: { ...emptyNull } },
    ...data,
    submittedBy: teacherUid,
    ...(teacherName ? { submittedByName: teacherName } : {}),
    ...(schoolId ? { submittedBySchoolId: schoolId } : {}),
    ...(schoolName ? { submittedBySchoolName: schoolName } : {}),
    ...(projectId ? { submittedByProjectId: projectId, projectId } : {}),
    ...(gradeContext ? { gradeContext } : {}),
    submittedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref2.id;
}
