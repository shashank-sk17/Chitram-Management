import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import type { ClassDoc, AssignmentDoc, LanguageCode } from '../../types/firestore';

// Create a new class — server generates unique code
export async function createClass(data: {
  name: string;
  grade: string;
  teacherId: string;
  schoolId: string;
  homeLanguage: LanguageCode;
  learningLanguage: LanguageCode;
}): Promise<{ id: string; code: string }> {
  const fn = httpsCallable<unknown, { id: string; code: string }>(functions, 'teacherCreateClass');
  const result = await fn({
    name: data.name,
    grade: data.grade,
    schoolId: data.schoolId,
    homeLanguage: data.homeLanguage,
    learningLanguage: data.learningLanguage,
  });
  return result.data;
}

// Update a class's curriculum customisation
export async function updateClassCurriculum(
  classId: string,
  addedWordIds: string[],
  removedWordIds: string[]
): Promise<void> {
  const fn = httpsCallable(functions, 'teacherUpdateClass');
  await fn({ classId, data: { addedWordIds, removedWordIds } });
}

// Update the home/learning language of a class
export async function updateClassLanguages(
  classId: string,
  homeLanguage: LanguageCode,
  learningLanguage: LanguageCode,
): Promise<void> {
  const fn = httpsCallable(functions, 'teacherUpdateClass');
  await fn({ classId, data: { homeLanguage, learningLanguage } });
}

// Create an assignment
export async function createAssignment(data: {
  wordSetId: number | string;
  curriculumSnapshot?: {
    grade: string;
    wordIds: string[];
    sourceType: 'mother' | 'teacher-customized';
  };
  classId: string;
  className: string;
  assignedTo: 'all' | string[];
  teacherId: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'upcoming' | 'completed';
}): Promise<string> {
  const fn = httpsCallable<unknown, { id: string }>(functions, 'teacherCreateAssignment');
  const result = await fn({ data });
  return result.data.id;
}

// Delete a class (teacher must own it)
export async function deleteClass(classId: string): Promise<void> {
  const fn = httpsCallable(functions, 'teacherDeleteClass');
  await fn({ classId });
}

// Get all classes for a teacher
export async function getTeacherClasses(teacherId: string): Promise<Array<ClassDoc & { id: string }>> {
  const q = query(collection(db, 'classes'), where('teacherId', '==', teacherId));
  const snapshot = await getDocs(q);

  const classes: Array<ClassDoc & { id: string }> = [];
  snapshot.forEach((doc) => {
    classes.push({ id: doc.id, ...doc.data() } as ClassDoc & { id: string });
  });

  return classes;
}

// Get all assignments for a teacher
export async function getTeacherAssignments(teacherId: string): Promise<Array<AssignmentDoc & { id: string }>> {
  const q = query(collection(db, 'assignments'), where('teacherId', '==', teacherId));
  const snapshot = await getDocs(q);

  const assignments: Array<AssignmentDoc & { id: string }> = [];
  snapshot.forEach((doc) => {
    assignments.push({ id: doc.id, ...doc.data() } as AssignmentDoc & { id: string });
  });

  return assignments;
}
