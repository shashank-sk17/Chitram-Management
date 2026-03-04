import { create } from 'zustand';
import { onSnapshot, doc, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { MotherCurriculumDoc, CurriculumWordDoc, TeacherCurriculumDoc } from '../types/firestore';

interface CurriculumState {
  // Mother curriculum (grade-based)
  motherCurriculum: Record<string, MotherCurriculumDoc & { id: string }>;

  // All curriculum words
  words: Record<string, CurriculumWordDoc & { id: string }>;

  // Teacher customizations
  teacherCurriculum: Record<string, TeacherCurriculumDoc & { id: string }>;

  // Loading states
  loadingMotherCurriculum: boolean;
  loadingWords: boolean;
  loadingTeacherCurriculum: boolean;

  // Actions
  setMotherCurriculum: (curriculum: Record<string, MotherCurriculumDoc & { id: string }>) => void;
  setWords: (words: Record<string, CurriculumWordDoc & { id: string }>) => void;
  setTeacherCurriculum: (curriculum: Record<string, TeacherCurriculumDoc & { id: string }>) => void;

  // Real-time listeners
  listenToMotherCurriculum: (grades: string[]) => () => void;
  listenToWords: (wordIds: string[]) => () => void;
  listenToTeacherCurriculum: (teacherId: string) => () => void;

  // Derived data
  getFinalWordList: (grade: string, teacherId?: string) => string[];
}

export const useCurriculumStore = create<CurriculumState>((set, get) => ({
  motherCurriculum: {},
  words: {},
  teacherCurriculum: {},
  loadingMotherCurriculum: false,
  loadingWords: false,
  loadingTeacherCurriculum: false,

  setMotherCurriculum: (curriculum) => set({ motherCurriculum: curriculum }),
  setWords: (words) => set({ words }),
  setTeacherCurriculum: (curriculum) => set({ teacherCurriculum: curriculum }),

  // Listen to mother curriculum for multiple grades
  listenToMotherCurriculum: (grades) => {
    set({ loadingMotherCurriculum: true });

    const unsubscribes = grades.map((grade) => {
      const gradeId = `grade${grade}`;
      return onSnapshot(
        doc(db, 'motherCurriculum', gradeId),
        (snapshot) => {
          if (snapshot.exists()) {
            set((state) => ({
              motherCurriculum: {
                ...state.motherCurriculum,
                [grade]: { id: snapshot.id, ...snapshot.data() } as MotherCurriculumDoc & { id: string },
              },
              loadingMotherCurriculum: false,
            }));
          } else {
            set((state) => ({
              motherCurriculum: {
                ...state.motherCurriculum,
                [grade]: {
                  id: gradeId,
                  grade,
                  wordIds: [],
                  levelCount: 0,
                  createdAt: new Date() as any,
                  updatedAt: new Date() as any,
                } as MotherCurriculumDoc & { id: string },
              },
              loadingMotherCurriculum: false,
            }));
          }
        },
        (error) => {
          console.error('Error listening to mother curriculum:', error);
          set({ loadingMotherCurriculum: false });
        }
      );
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  },

  // Listen to specific words
  listenToWords: (wordIds) => {
    if (wordIds.length === 0) return () => {};

    set({ loadingWords: true });

    const unsubscribes = wordIds.map((wordId) => {
      return onSnapshot(
        doc(db, 'curriculumWords', wordId),
        (snapshot) => {
          if (snapshot.exists()) {
            set((state) => ({
              words: {
                ...state.words,
                [wordId]: { id: snapshot.id, ...snapshot.data() } as CurriculumWordDoc & { id: string },
              },
              loadingWords: false,
            }));
          }
        },
        (error) => {
          console.error('Error listening to word:', error);
          set({ loadingWords: false });
        }
      );
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  },

  // Listen to teacher curriculum customizations
  listenToTeacherCurriculum: (teacherId) => {
    set({ loadingTeacherCurriculum: true });

    const unsubscribe = onSnapshot(
      collection(db, 'teacherCurriculum'),
      (snapshot) => {
        const curriculum: Record<string, TeacherCurriculumDoc & { id: string }> = {};

        snapshot.forEach((doc) => {
          const data = doc.data() as TeacherCurriculumDoc;
          if (data.teacherId === teacherId) {
            curriculum[doc.id] = { id: doc.id, ...data };
          }
        });

        set({ teacherCurriculum: curriculum, loadingTeacherCurriculum: false });
      },
      (error) => {
        console.error('Error listening to teacher curriculum:', error);
        set({ loadingTeacherCurriculum: false });
      }
    );

    return unsubscribe;
  },

  // Get final word list for a grade (mother + teacher customizations)
  getFinalWordList: (grade, teacherId) => {
    const state = get();
    const motherWords = state.motherCurriculum[grade]?.wordIds || [];

    if (!teacherId) {
      return motherWords;
    }

    // Find teacher customization for this grade
    const teacherCustomization = Object.values(state.teacherCurriculum).find(
      (tc) => tc.teacherId === teacherId && tc.grade === grade
    );

    if (!teacherCustomization) {
      return motherWords;
    }

    // Apply teacher customizations: remove excluded words, add custom words
    const finalWords = [
      ...motherWords.filter((id) => !teacherCustomization.removedWordIds.includes(id)),
      ...teacherCustomization.addedWordIds,
    ];

    return finalWords;
  },
}));
