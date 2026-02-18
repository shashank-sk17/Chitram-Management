import { create } from 'zustand';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ClassDoc, StudentDoc, AssignmentDoc } from '../types/firestore';

interface TeacherState {
  // Classes managed by this teacher
  classes: Array<ClassDoc & { id: string }>;

  // All students in teacher's classes
  students: Array<StudentDoc & { id: string }>;

  // All assignments created by this teacher
  assignments: Array<AssignmentDoc & { id: string }>;

  // Selected class for scoped views
  selectedClassId: string | null;

  // Loading states
  loadingClasses: boolean;
  loadingStudents: boolean;
  loadingAssignments: boolean;

  // Actions
  setClasses: (classes: Array<ClassDoc & { id: string }>) => void;
  setStudents: (students: Array<StudentDoc & { id: string }>) => void;
  setAssignments: (assignments: Array<AssignmentDoc & { id: string }>) => void;
  setSelectedClassId: (classId: string | null) => void;

  // Real-time listeners
  listenToTeacherClasses: (teacherId: string) => () => void;
  listenToClassStudents: (classId: string) => () => void;
  listenToTeacherAssignments: (teacherId: string) => () => void;

  // Student approval actions
  approveStudent: (classId: string, studentId: string) => Promise<void>;
  rejectStudent: (classId: string, studentId: string) => Promise<void>;

  // Derived data
  getStudentsForClass: (classId: string) => Array<StudentDoc & { id: string }>;
  getPendingStudentsForClass: (classId: string) => Array<StudentDoc & { id: string }>;
  getAssignmentsForClass: (classId: string) => Array<AssignmentDoc & { id: string }>;
}

export const useTeacherStore = create<TeacherState>((set, get) => ({
  classes: [],
  students: [],
  assignments: [],
  selectedClassId: null,
  loadingClasses: false,
  loadingStudents: false,
  loadingAssignments: false,

  setClasses: (classes) => set({ classes }),
  setStudents: (students) => set({ students }),
  setAssignments: (assignments) => set({ assignments }),
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
        const students: Array<StudentDoc & { id: string }> = [];

        snapshot.forEach((doc) => {
          students.push({ id: doc.id, ...(doc.data() as StudentDoc) });
        });

        set({ students, loadingStudents: false });
      },
      (error) => {
        console.error('Error listening to students:', error);
        set({ loadingStudents: false });
      }
    );

    return unsubscribe;
  },

  // Listen to teacher's assignments
  listenToTeacherAssignments: (teacherId) => {
    set({ loadingAssignments: true });

    const q = query(collection(db, 'assignments'), where('teacherId', '==', teacherId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const assignments: Array<AssignmentDoc & { id: string }> = [];
        snapshot.forEach((doc) => {
          assignments.push({ id: doc.id, ...doc.data() } as AssignmentDoc & { id: string });
        });
        set({ assignments, loadingAssignments: false });
      },
      (error) => {
        console.error('Error listening to assignments:', error);
        set({ loadingAssignments: false });
      }
    );

    return unsubscribe;
  },

  // Approve a pending student
  approveStudent: async (classId, studentId) => {
    const classRef = doc(db, 'classes', classId);

    await updateDoc(classRef, {
      studentIds: arrayUnion(studentId),
      pendingStudentIds: arrayRemove(studentId),
    });

    // Update student document
    await updateDoc(doc(db, 'students', studentId), {
      classId,
      classIds: arrayUnion(classId),
      kidType: 'classroom',
    });
  },

  // Reject a pending student
  rejectStudent: async (classId, studentId) => {
    const classRef = doc(db, 'classes', classId);

    await updateDoc(classRef, {
      pendingStudentIds: arrayRemove(studentId),
    });

    // Update student document to remove pending status
    await updateDoc(doc(db, 'students', studentId), {
      classId: null,
      classIds: arrayRemove(classId),
      kidType: 'individual',
    });
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

  // Get assignments for a specific class
  getAssignmentsForClass: (classId) => {
    const state = get();
    return state.assignments.filter((a) => a.classId === classId);
  },
}));
