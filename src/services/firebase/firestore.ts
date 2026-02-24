import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
  Timestamp,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { ProjectDoc, SchoolDoc, TeacherDoc, StudentDoc, LearningAttemptDoc } from '../../types/firestore';

// ===== Projects =====

export async function createProject(data: {
  name: string;
  description?: string;
  createdBy: string;
}) {
  const projectRef = await addDoc(collection(db, 'projects'), {
    ...data,
    schoolIds: [],
    createdAt: serverTimestamp(),
  });

  return projectRef.id;
}

export async function getProject(projectId: string): Promise<ProjectDoc | null> {
  const docRef = doc(db, 'projects', projectId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return docSnap.data() as ProjectDoc;
}

export async function getAllProjects(): Promise<Array<ProjectDoc & { id: string }>> {
  const querySnapshot = await getDocs(collection(db, 'projects'));
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as ProjectDoc),
  }));
}

export async function updateProject(
  projectId: string,
  updates: Partial<ProjectDoc>
) {
  await updateDoc(doc(db, 'projects', projectId), updates);
}

export async function deleteProject(projectId: string) {
  await deleteDoc(doc(db, 'projects', projectId));
}

export async function assignSchoolToProject(
  projectId: string,
  schoolId: string
) {
  // Add schoolId to project
  await updateDoc(doc(db, 'projects', projectId), {
    schoolIds: arrayUnion(schoolId),
  });

  // Add projectId to school
  await updateDoc(doc(db, 'schools', schoolId), {
    projectId,
  });
}

export async function removeSchoolFromProject(
  projectId: string,
  schoolId: string
) {
  // Remove schoolId from project
  await updateDoc(doc(db, 'projects', projectId), {
    schoolIds: arrayRemove(schoolId),
  });

  // Remove projectId from school
  await updateDoc(doc(db, 'schools', schoolId), {
    projectId: null,
  });
}

// ===== Schools =====

export async function createSchool(data: {
  name: string;
  code: string;
  createdBy: string;
  projectId?: string;
}) {
  const schoolRef = await addDoc(collection(db, 'schools'), {
    ...data,
    teacherIds: [],
    createdAt: serverTimestamp(),
  });

  // If projectId provided, add school to project
  if (data.projectId) {
    await assignSchoolToProject(data.projectId, schoolRef.id);
  }

  return schoolRef.id;
}

export async function getSchool(schoolId: string): Promise<SchoolDoc | null> {
  const docRef = doc(db, 'schools', schoolId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return docSnap.data() as SchoolDoc;
}

export async function getSchoolByCode(code: string): Promise<(SchoolDoc & { id: string }) | null> {
  const q = query(collection(db, 'schools'), where('code', '==', code));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return null;

  const doc = querySnapshot.docs[0];
  return {
    id: doc.id,
    ...(doc.data() as SchoolDoc),
  };
}

export async function getAllSchools(): Promise<Array<SchoolDoc & { id: string }>> {
  const querySnapshot = await getDocs(collection(db, 'schools'));
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as SchoolDoc),
  }));
}

export async function getSchoolsInProject(
  projectId: string
): Promise<Array<SchoolDoc & { id: string }>> {
  const q = query(
    collection(db, 'schools'),
    where('projectId', '==', projectId)
  );
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as SchoolDoc),
  }));
}

export async function updateSchool(
  schoolId: string,
  updates: Partial<SchoolDoc>
) {
  await updateDoc(doc(db, 'schools', schoolId), updates);
}

export async function deleteSchool(schoolId: string) {
  await deleteDoc(doc(db, 'schools', schoolId));
}

// ===== Teachers =====

export async function getAllTeachers(): Promise<Array<TeacherDoc & { id: string }>> {
  const snapshot = await getDocs(collection(db, 'teachers'));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as TeacherDoc),
  }));
}

export async function getTeachersBySchool(schoolId: string): Promise<Array<TeacherDoc & { id: string }>> {
  const school = await getSchool(schoolId);
  if (!school || !school.teacherIds) return [];

  const teachers: Array<TeacherDoc & { id: string }> = [];
  for (const teacherId of school.teacherIds) {
    const teacherDoc = await getDoc(doc(db, 'teachers', teacherId));
    if (teacherDoc.exists()) {
      teachers.push({
        id: teacherDoc.id,
        ...(teacherDoc.data() as TeacherDoc),
      });
    }
  }
  return teachers;
}

// ===== Classes =====

export async function getAllClasses() {
  const querySnapshot = await getDocs(collection(db, 'classes'));
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getClassesByTeacher(teacherId: string) {
  const q = query(collection(db, 'classes'), where('teacherId', '==', teacherId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getClassesBySchool(schoolId: string) {
  const q = query(collection(db, 'classes'), where('schoolId', '==', schoolId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// ===== Students =====

export async function getAllStudents(): Promise<Array<StudentDoc & { id: string }>> {
  const querySnapshot = await getDocs(collection(db, 'students'));
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as StudentDoc),
  }));
}

export async function getStudentsByClass(classId: string): Promise<Array<StudentDoc & { id: string }>> {
  const classDoc = await getDoc(doc(db, 'classes', classId));
  if (!classDoc.exists()) return [];

  const classData = classDoc.data();
  const studentIds = classData.studentIds || [];

  const students: Array<StudentDoc & { id: string }> = [];
  for (const studentId of studentIds) {
    const studentDoc = await getDoc(doc(db, 'students', studentId));
    if (studentDoc.exists()) {
      students.push({
        id: studentDoc.id,
        ...(studentDoc.data() as StudentDoc),
      });
    }
  }
  return students;
}

export async function getPendingStudentsByClass(classId: string): Promise<Array<StudentDoc & { id: string }>> {
  const classDoc = await getDoc(doc(db, 'classes', classId));
  if (!classDoc.exists()) return [];

  const classData = classDoc.data();
  const pendingIds: string[] = classData.pendingStudentIds || [];

  const students: Array<StudentDoc & { id: string }> = [];
  for (const studentId of pendingIds) {
    const studentDoc = await getDoc(doc(db, 'students', studentId));
    if (studentDoc.exists()) {
      students.push({
        id: studentDoc.id,
        ...(studentDoc.data() as StudentDoc),
      });
    }
  }
  return students;
}

export async function getStudentsByTeacher(teacherId: string) {
  const classes = await getClassesByTeacher(teacherId);
  const allStudents = [];

  for (const cls of classes) {
    const students = await getStudentsByClass(cls.id);
    allStudents.push(...students);
  }

  // Remove duplicates
  const uniqueStudents = Array.from(
    new Map(allStudents.map((student) => [student.id, student])).values()
  );

  return uniqueStudents;
}

// ===== Assignments =====

export async function getAssignmentsByTeacher(teacherId: string) {
  const classes = await getClassesByTeacher(teacherId);
  const allAssignments = [];

  for (const cls of classes) {
    const q = query(collection(db, 'assignments'), where('classId', '==', cls.id));
    const querySnapshot = await getDocs(q);
    const assignments = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    allAssignments.push(...assignments);
  }

  return allAssignments;
}

export async function getSubmissionsByAssignment(assignmentId: string) {
  const q = query(collection(db, 'submissions'), where('assignmentId', '==', assignmentId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getSubmissionsByStudent(studentId: string) {
  const q = query(collection(db, 'submissions'), where('studentId', '==', studentId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getRecentActivity(teacherId: string, maxResults: number = 10) {
  const classes = await getClassesByTeacher(teacherId);
  const classIds = classes.map(cls => cls.id);

  if (classIds.length === 0) return [];

  // Get recent submissions from all teacher's classes
  const q = query(
    collection(db, 'submissions'),
    where('classId', 'in', classIds.slice(0, 10)), // Firestore 'in' limit is 10
    // orderBy('createdAt', 'desc'), // Uncomment when createdAt field exists
    limit(maxResults)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// ===== Student Attempts =====

export async function getAttemptsForDay(
  studentId: string,
  date: Date
): Promise<Array<LearningAttemptDoc & { id: string }>> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, 'students', studentId, 'attempts'),
    where('timestamp', '>=', Timestamp.fromDate(start)),
    where('timestamp', '<=', Timestamp.fromDate(end)),
    orderBy('timestamp', 'asc')
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as LearningAttemptDoc) }));
}

// ===== Utilities =====

export function generateJoinCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
