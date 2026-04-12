import {
  collection, doc, getDoc, getDocs, setDoc, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { LanguageCurriculumDoc, LanguageCode, CurriculumLevel } from '../../types/firestore';

const COL = 'languageCurricula';

export const SUPPORTED_LANGUAGES: LanguageCode[] = ['te', 'en', 'hi', 'mr', 'es', 'fr'];
export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  te: 'Telugu', en: 'English', hi: 'Hindi', mr: 'Marathi', es: 'Spanish', fr: 'French',
};

function curriculumId(lang: LanguageCode, grade: number): string {
  return `${lang}_g${grade}`;
}

export async function getLanguageCurriculum(
  lang: LanguageCode,
  grade: number,
): Promise<({ id: string } & LanguageCurriculumDoc) | null> {
  const id = curriculumId(lang, grade);
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as LanguageCurriculumDoc) };
}

export async function updateLanguageCurriculum(
  lang: LanguageCode,
  grade: number,
  levels: CurriculumLevel[],
  uid: string,
): Promise<void> {
  const id = curriculumId(lang, grade);
  const existing = await getDoc(doc(db, COL, id));
  const currentVersion = existing.exists() ? ((existing.data() as LanguageCurriculumDoc).version ?? 0) : 0;

  await setDoc(doc(db, COL, id), {
    language: lang,
    grade,
    active: true,
    version: currentVersion + 1,
    levels,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function getAllCurriculaForLang(
  lang: LanguageCode,
): Promise<Array<{ id: string } & LanguageCurriculumDoc>> {
  const q = query(collection(db, COL), where('language', '==', lang));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as LanguageCurriculumDoc) }));
}

export async function getAllCurricula(): Promise<Array<{ id: string } & LanguageCurriculumDoc>> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as LanguageCurriculumDoc) }));
}
