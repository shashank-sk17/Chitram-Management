import {
  collection, doc, getDoc, getDocs, query, where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import type { LanguageCurriculumDoc, LanguageCode, CurriculumLevel } from '../../types/firestore';

const COL = 'languageCurricula';

export const SUPPORTED_LANGUAGES: LanguageCode[] = ['te', 'en', 'hi', 'es', 'fr'];
export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  te: 'Telugu', en: 'English', hi: 'Hindi', es: 'Spanish', fr: 'French',
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
  _uid: string,
): Promise<void> {
  const fn = httpsCallable(functions, 'adminUpdateLanguageCurriculum');
  await fn({ docId: curriculumId(lang, grade), levels });
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
