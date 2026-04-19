import {
  collection, doc, getDoc, getDocs, updateDoc, addDoc, setDoc,
  query, where, orderBy, startAfter, limit,
  getCountFromServer, serverTimestamp,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import type { WordBankDoc, LanguageCode } from '../../types/firestore';
import { sendAdminNotification } from './adminNotifications';

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

export async function approveWord(wordId: string, adminUid: string, adminName?: string): Promise<void> {
  // 1. Fetch the word doc
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

  // 2. Assign numericId if missing
  if (!word.numericId) {
    const countSnap = await getCountFromServer(
      query(collection(db, COL), where('status', '==', 'active'))
    );
    updates.numericId = countSnap.data().count + 1;
  }

  await updateDoc(doc(db, COL, wordId), updates);

  // 3. Add word to languageCurricula so it shows up in the app
  // Determine primary language (te preferred; fall back to first language with content)
  const LANGS: LanguageCode[] = ['te', 'en', 'hi', 'mr', 'es', 'fr'];
  const primaryLang: LanguageCode = LANGS.find(l => !!word.word?.[l]) ?? 'te';
  const grade: number = word.gradeContext ?? 1;
  const curriculumDocId = `${primaryLang}_g${grade}`;

  try {
    const curriculumRef = doc(db, 'languageCurricula', curriculumDocId);
    const curriculumSnap = await getDoc(curriculumRef);

    if (curriculumSnap.exists()) {
      const data = curriculumSnap.data() as { levels: Array<{ levelNum: number; wordIds: string[] }>; version?: number };
      const levels = data.levels ?? [];

      // Don't add duplicates
      const alreadyExists = levels.some(lvl => lvl.wordIds.includes(wordId));
      if (!alreadyExists) {
        // Append to last level, or create level 1 if empty
        if (levels.length === 0) {
          levels.push({ levelNum: 1, wordIds: [wordId] });
        } else {
          levels[levels.length - 1].wordIds.push(wordId);
        }
        await setDoc(curriculumRef, {
          ...data,
          levels,
          version: (data.version ?? 0) + 1,
          updatedAt: serverTimestamp(),
          updatedBy: adminUid,
        });
      }
    } else {
      // Curriculum doc doesn't exist yet — create it with level 1
      await setDoc(curriculumRef, {
        language: primaryLang,
        grade,
        active: true,
        version: 1,
        levels: [{ levelNum: 1, wordIds: [wordId] }],
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      });
    }
  } catch (err) {
    // Don't fail the approval if curriculum update fails — log and continue
    console.error('Failed to add word to languageCurricula:', err);
  }

  // 4. Notify admins
  const wordText = word.word?.te || word.word?.en || wordId;
  await sendAdminNotification({
    type: 'word_approved',
    wordId,
    wordText,
    grade,
    wordType: word.wordType,
    submittedBy: word.submittedBy,
    submittedByName: word.submittedByName,
    reviewedBy: adminUid,
    reviewedByName: adminName,
    projectId: word.projectId,
    curricula: curriculumDocId,
  });
}

export async function rejectWord(wordId: string, adminUid: string, note: string, adminName?: string): Promise<void> {
  const snap = await getDoc(doc(db, COL, wordId));
  const word = snap.exists() ? (snap.data() as WordBankDoc) : null;

  await updateDoc(doc(db, COL, wordId), {
    status: 'rejected',
    active: false,
    rejectionNote: note,
    reviewedBy: adminUid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Notify admins
  const wordText = word?.word?.te || word?.word?.en || wordId;
  await sendAdminNotification({
    type: 'word_rejected',
    wordId,
    wordText,
    grade: word?.gradeContext,
    wordType: word?.wordType,
    submittedBy: word?.submittedBy,
    submittedByName: word?.submittedByName,
    reviewedBy: adminUid,
    reviewedByName: adminName,
    rejectionNote: note,
    projectId: word?.projectId,
  });
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

export async function uploadWordImage(wordId: string, file: File, index: 0 | 1 | 2 = 0): Promise<string> {
  const path = `wordbank-images/${wordId}/image_${index}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(storageRef);

  // Read current arrays, splice in new values at position index
  const snap = await getDoc(doc(db, COL, wordId));
  const existing = snap.exists() ? (snap.data() as any) : {};
  const imageUrls: string[] = [...(existing.imageUrls ?? [null, null, null])];
  const imagePaths: string[] = [...(existing.imageStoragePaths ?? [null, null, null])];
  imageUrls[index] = url;
  imagePaths[index] = path;

  const trimmed = imageUrls.filter(Boolean);
  await updateDoc(doc(db, COL, wordId), {
    imageUrl: trimmed[0] ?? null,
    imageStoragePath: imagePaths[0] ?? null,
    imageUrls: trimmed,
    imageStoragePaths: imagePaths.filter(Boolean),
    updatedAt: serverTimestamp(),
  });
  return url;
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
