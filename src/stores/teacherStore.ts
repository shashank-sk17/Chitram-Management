import { create } from 'zustand';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import type { ClassDoc, StudentDoc } from '../types/firestore';

interface TeacherState {
  // Classes managed by this teacher
  classes: Array<ClassDoc & { id: string }>;

  // All students in teacher's classes
  students: Array<StudentDoc & { id: string }>;

  // Selected class for scoped views
  selectedClassId: string | null;

  // Loading states
  loadingClasses: boolean;
  loadingStudents: boolean;

  // Actions
  setClasses: (classes: Array<ClassDoc & { id: string }>) => void;
  setStudents: (students: Array<StudentDoc & { id: string }>) => void;
  setSelectedClassId: (classId: string | null) => void;

  // Real-time listeners
  listenToTeacherClasses: (teacherId: string) => () => void;
  listenToClassStudents: (classId: string) => () => void;

  // Student approval actions
  approveStudent: (classId: string, studentId: string) => Promise<void>;
  rejectStudent: (classId: string, studentId: string) => Promise<void>;

  // Derived data
  getStudentsForClass: (classId: string) => Array<StudentDoc & { id: string }>;
  getPendingStudentsForClass: (classId: string) => Array<StudentDoc & { id: string }>;
}

export const useTeacherStore = create<TeacherState>((set, get) => ({
  classes: [],
  students: [],
  selectedClassId: null,
  loadingClasses: false,
  loadingStudents: false,

  setClasses: (classes) => set({ classes }),
  setStudents: (students) => set({ students }),
  setSelectedClassId: (classId) => set({ selectedClassId: classId }),

  // Listen to teacher's classes
  listenToTeacherClasses: (teacherId) => {
    set({ loadingClasses: true });

    const q = query(collection(db, 'classes'), where('teacherId', '==', teacherId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const classes: Array<ClassDoc & { id: string }> = [];
        snapshot.forEach((doc) => {
          classes.push({ id: doc.id, ...doc.data() } as ClassDoc & { id: string });
        });
        set({ classes, loadingClasses: false });
      },
      (error) => {
        console.error('Error listening to classes:', error);
        set({ loadingClasses: false });
      }
    );

    return unsubscribe;
  },

  // Listen to students in a specific class
  listenToClassStudents: (classId) => {
    set({ loadingStudents: true });

    const q = query(
      collection(db, 'students'),
      where('classIds', 'array-contains', classId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const incoming: Array<StudentDoc & { id: string }> = [];
        snapshot.forEach((doc) => {
          incoming.push({ id: doc.id, ...(doc.data() as StudentDoc) });
        });

        // Merge with existing students — don't overwrite other classes' students
        set((state) => {
          const merged = [...state.students.filter((s) => !incoming.some((i) => i.id === s.id)), ...incoming];
          return { students: merged, loadingStudents: false };
        });
      },
      (error) => {
        console.error('Error listening to students:', error);
        set({ loadingStudents: false });
      }
    );

    return unsubscribe;
  },

  // Approve a pending student — uses Admin SDK via CF to write to locked collections
  approveStudent: async (classId, studentId) => {
    const fn = httpsCallable(functions, 'teacherApproveStudent');
    await fn({ classId, studentId });
  },

  // Reject a pending student — uses Admin SDK via CF to write to locked collections
  rejectStudent: async (classId, studentId) => {
    const fn = httpsCallable(functions, 'teacherRejectStudent');
    await fn({ classId, studentId });
  },

  // Get students for a specific class (approved only)
  getStudentsForClass: (classId) => {
    const state = get();
    const classData = state.classes.find((c) => c.id === classId);

    if (!classData) return [];

    return state.students.filter((s) =>
      classData.studentIds.includes(s.id)
    );
  },

  // Get pending students for a specific class
  getPendingStudentsForClass: (classId) => {
    const state = get();
    const classData = state.classes.find((c) => c.id === classId);

    if (!classData) return [];

    return state.students.filter((s) =>
      classData.pendingStudentIds.includes(s.id)
    );
  },

}));
