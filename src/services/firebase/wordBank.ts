import {
  collection, doc, getDoc, getDocs, updateDoc, addDoc,
  query, where, orderBy, startAfter, limit,
  getCountFromServer, serverTimestamp,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import type { WordBankDoc, LanguageCode } from '../../types/firestore';

const COL = 'wordBank';

export interface WordBankFilters {
  status?: 'active' | 'pending' | 'rejected';
  language?: LanguageCode;
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
  await updateDoc(doc(db, COL, wordId), { ...data, updatedAt: serverTimestamp() });
}

export async function approveWord(wordId: string, adminUid: string): Promise<void> {
  // Get current max numericId to assign next one if needed
  const snap = await getDoc(doc(db, COL, wordId));
  if (!snap.exists()) throw new Error('Word not found');
  const word = snap.data() as WordBankDoc;

  const updates: Partial<WordBankDoc> = {
    status: 'active',
    active: true,
    reviewedBy: adminUid,
    reviewedAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };

  // Assign numericId if missing
  if (!word.numericId) {
    const countSnap = await getCountFromServer(
      query(collection(db, COL), where('status', '==', 'active'))
    );
    updates.numericId = countSnap.data().count + 1;
  }

  await updateDoc(doc(db, COL, wordId), updates);
}

export async function rejectWord(wordId: string, adminUid: string, note: string): Promise<void> {
  await updateDoc(doc(db, COL, wordId), {
    status: 'rejected',
    active: false,
    rejectionNote: note,
    reviewedBy: adminUid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getPendingWordsCount(): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, COL), where('status', '==', 'pending'))
  );
  return snap.data().count;
}

export async function uploadWordImage(wordId: string, file: File): Promise<string> {
  const storageRef = ref(storage, `wordbank-images/${wordId}/image.jpg`);
  await uploadBytes(storageRef, file, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(db, COL, wordId), {
    imageUrl: url,
    imageStoragePath: `wordbank-images/${wordId}/image.jpg`,
    updatedAt: serverTimestamp(),
  });
  return url;
}

export async function createPendingWord(
  data: Omit<Partial<WordBankDoc>, 'status' | 'createdAt' | 'updatedAt'>,
  teacherUid: string,
  projectId?: string,
): Promise<string> {
  const empty: Record<LanguageCode, string> = { te: '', en: '', hi: '', mr: '', es: '', fr: '' };
  const emptyNull: Record<LanguageCode, null> = { te: null, en: null, hi: null, mr: null, es: null, fr: null };

  const ref2 = await addDoc(collection(db, COL), {
    numericId: 0,
    status: 'pending',
    active: false,
    wordType: 'NS360',
    difficulty: 'Medium',
    word: { ...empty },
    pronunciation: { ...empty },
    meaning: { ...empty },
    sentence: { ...empty },
    imageUrl: null,
    audioUrl: { word: { ...emptyNull }, meaning: { ...emptyNull }, sentence: { ...emptyNull } },
    ...data,
    submittedBy: teacherUid,
    ...(projectId ? { projectId } : {}),
    submittedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref2.id;
}
