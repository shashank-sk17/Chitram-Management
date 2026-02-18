import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import type { CurriculumWordDoc, MotherCurriculumDoc, TeacherCurriculumDoc, LanguageCode } from '../../types/firestore';

// ===== Mother Curriculum Operations =====

export async function createMotherCurriculum(grade: string): Promise<void> {
  const gradeId = `grade${grade}`;
  await setDoc(doc(db, 'motherCurriculum', gradeId), {
    grade,
    wordIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function addWordToMotherCurriculum(grade: string, wordId: string): Promise<void> {
  const gradeId = `grade${grade}`;
  await updateDoc(doc(db, 'motherCurriculum', gradeId), {
    wordIds: arrayUnion(wordId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeWordFromMotherCurriculum(grade: string, wordId: string): Promise<void> {
  const gradeId = `grade${grade}`;
  await updateDoc(doc(db, 'motherCurriculum', gradeId), {
    wordIds: arrayRemove(wordId),
    updatedAt: serverTimestamp(),
  });
}

export async function getMotherCurriculum(grade: string): Promise<(MotherCurriculumDoc & { id: string }) | null> {
  const gradeId = `grade${grade}`;
  const docSnap = await getDoc(doc(db, 'motherCurriculum', gradeId));

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as MotherCurriculumDoc & { id: string };
  }

  return null;
}

// ===== Curriculum Word Operations =====

export async function createCurriculumWord(data: {
  source: 'mother' | 'teacher';
  createdBy: string;
  word: Record<LanguageCode, string>;
  translations: Record<LanguageCode, string>;
  meaning: Record<LanguageCode, string>;
  sentence: Record<LanguageCode, string>;
  imageUrl?: string;
  imageStoragePath?: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}): Promise<string> {
  const wordRef = doc(collection(db, 'curriculumWords'));

  await setDoc(wordRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return wordRef.id;
}

export async function updateCurriculumWord(
  wordId: string,
  data: Partial<Omit<CurriculumWordDoc, 'createdAt' | 'createdBy' | 'source'>>
): Promise<void> {
  await updateDoc(doc(db, 'curriculumWords', wordId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCurriculumWord(wordId: string): Promise<void> {
  await deleteDoc(doc(db, 'curriculumWords', wordId));
}

export async function getCurriculumWord(wordId: string): Promise<(CurriculumWordDoc & { id: string }) | null> {
  const docSnap = await getDoc(doc(db, 'curriculumWords', wordId));

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as CurriculumWordDoc & { id: string };
  }

  return null;
}

export async function getCurriculumWords(wordIds: string[]): Promise<Array<CurriculumWordDoc & { id: string }>> {
  if (wordIds.length === 0) return [];

  const words: Array<CurriculumWordDoc & { id: string }> = [];

  // Firestore 'in' queries are limited to 10 items, so we need to batch
  const batchSize = 10;
  for (let i = 0; i < wordIds.length; i += batchSize) {
    const batch = wordIds.slice(i, i + batchSize);
    const q = query(collection(db, 'curriculumWords'), where('__name__', 'in', batch));
    const snapshot = await getDocs(q);

    snapshot.forEach((doc) => {
      words.push({ id: doc.id, ...doc.data() } as CurriculumWordDoc & { id: string });
    });
  }

  return words;
}

// ===== Teacher Curriculum Operations =====

export async function createTeacherCurriculum(data: {
  teacherId: string;
  grade: string;
}): Promise<string> {
  const curriculumRef = doc(collection(db, 'teacherCurriculum'));

  await setDoc(curriculumRef, {
    ...data,
    addedWordIds: [],
    removedWordIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return curriculumRef.id;
}

export async function addWordToTeacherCurriculum(curriculumId: string, wordId: string): Promise<void> {
  await updateDoc(doc(db, 'teacherCurriculum', curriculumId), {
    addedWordIds: arrayUnion(wordId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeWordFromTeacherCurriculum(curriculumId: string, wordId: string): Promise<void> {
  await updateDoc(doc(db, 'teacherCurriculum', curriculumId), {
    removedWordIds: arrayUnion(wordId),
    updatedAt: serverTimestamp(),
  });
}

export async function restoreWordToTeacherCurriculum(curriculumId: string, wordId: string): Promise<void> {
  await updateDoc(doc(db, 'teacherCurriculum', curriculumId), {
    removedWordIds: arrayRemove(wordId),
    updatedAt: serverTimestamp(),
  });
}

export async function getTeacherCurriculum(
  teacherId: string,
  grade: string
): Promise<(TeacherCurriculumDoc & { id: string }) | null> {
  const q = query(
    collection(db, 'teacherCurriculum'),
    where('teacherId', '==', teacherId),
    where('grade', '==', grade)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as TeacherCurriculumDoc & { id: string };
  }

  return null;
}

// ===== Image Upload =====

export async function uploadCurriculumImage(file: File, fileName: string): Promise<string> {
  // Validate image dimensions (256x256)
  await validateImageDimensions(file, 256, 256);

  // Upload to Firebase Storage
  const storageRef = ref(storage, `curriculum-images/${Date.now()}-${fileName}`);
  await uploadBytes(storageRef, file);

  // Get download URL
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

function validateImageDimensions(file: File, width: number, height: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      if (img.width !== width || img.height !== height) {
        reject(new Error(`Image must be exactly ${width}×${height} pixels (current: ${img.width}×${img.height})`));
      } else {
        resolve();
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
