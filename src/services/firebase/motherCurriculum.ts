import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { MotherCurriculumDoc } from '../../types/firestore';

export async function getMotherCurriculum(grade: string): Promise<(MotherCurriculumDoc & { id: string }) | null> {
  const gradeId = `grade${grade}`;
  const docSnap = await getDoc(doc(db, 'motherCurriculum', gradeId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...(docSnap.data() as MotherCurriculumDoc) };
}
