import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { ClassDoc, AssignmentDoc } from '../../types/firestore';

// Generate a 6-character class code (excludes I, O, 0, 1 to avoid confusion)
export function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Check if a class code is unique
export async function isClassCodeUnique(code: string): Promise<boolean> {
  const q = query(collection(db, 'classes'), where('code', '==', code.toUpperCase()));
  const snapshot = await getDocs(q);
  return snapshot.empty;
}

// Generate a unique class code
export async function generateUniqueClassCode(): Promise<string> {
  let code = generateClassCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (!(await isClassCodeUnique(code)) && attempts < maxAttempts) {
    code = generateClassCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique class code. Please try again.');
  }

  return code;
}

// Create a new class
export async function createClass(data: {
  name: string;
  grade: string;
  teacherId: string;
  schoolId: string;
}): Promise<{ id: string; code: string }> {
  const code = await generateUniqueClassCode();
  const classRef = doc(collection(db, 'classes'));

  await setDoc(classRef, {
    name: data.name,
    grade: data.grade,
    teacherId: data.teacherId,
    schoolId: data.schoolId,
    code,
    studentIds: [],
    pendingStudentIds: [],
    createdAt: serverTimestamp(),
  });

  return { id: classRef.id, code };
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
  const assignmentRef = doc(collection(db, 'assignments'));

  await setDoc(assignmentRef, {
    ...data,
    createdAt: serverTimestamp(),
  });

  return assignmentRef.id;
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
