import { create } from 'zustand';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { McqAssignmentDoc, StudentSubmissionDoc } from '../types/firestore';
import { getSubmissionsForAssignment } from '../services/firebase/assignments';

interface AssignmentState {
  assignments: Record<string, McqAssignmentDoc>;
  submissions: Record<string, Array<{ id: string; uid: string } & StudentSubmissionDoc>>;
  loadingAssignments: boolean;
  loadingSubmissions: boolean;

  listenToTeacherAssignments: (teacherUid: string) => () => void;
  fetchSubmissionsForAssignment: (assignmentId: string) => Promise<void>;
  getAssignmentsForClass: (classId: string) => Array<{ id: string } & McqAssignmentDoc>;
  reset: () => void;
}

const initialState = {
  assignments: {},
  submissions: {},
  loadingAssignments: false,
  loadingSubmissions: false,
};

export const useAssignmentStore = create<AssignmentState>((set, get) => ({
  ...initialState,

  listenToTeacherAssignments: (teacherUid: string) => {
    set({ loadingAssignments: true });
    const q = query(
      collection(db, 'mcqAssignments'),
      where('teacherUid', '==', teacherUid),
    );
    const unsub = onSnapshot(q, snap => {
      const assignments: Record<string, McqAssignmentDoc> = {};
      snap.docs.forEach(d => { assignments[d.id] = d.data() as McqAssignmentDoc; });
      set({ assignments, loadingAssignments: false });
    }, () => set({ loadingAssignments: false }));
    return unsub;
  },

  fetchSubmissionsForAssignment: async (assignmentId: string) => {
    set({ loadingSubmissions: true });
    try {
      const subs = await getSubmissionsForAssignment(assignmentId);
      set(state => ({
        submissions: { ...state.submissions, [assignmentId]: subs },
        loadingSubmissions: false,
      }));
    } catch {
      set({ loadingSubmissions: false });
    }
  },

  getAssignmentsForClass: (classId: string) => {
    return Object.entries(get().assignments)
      .filter(([, a]) => a.classId === classId)
      .map(([id, a]) => ({ id, ...a }))
      .sort((a, b) => {
        const da = a.dueDate instanceof Object ? (a.dueDate as any).seconds : 0;
        const db2 = b.dueDate instanceof Object ? (b.dueDate as any).seconds : 0;
        return db2 - da;
      });
  },

  reset: () => set(initialState),
}));
