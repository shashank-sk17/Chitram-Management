import { create } from 'zustand';
import type { WordBankDoc, LanguageCurriculumDoc, CurriculumEditDoc, LanguageCode, CurriculumLevel } from '../types/firestore';
import { getWordBankPage, getWordBankByIds, getPendingWordsCount, type WordBankFilters } from '../services/firebase/wordBank';
import { getLanguageCurriculum } from '../services/firebase/languageCurricula';
import { getCurriculumEditsForClass, getPendingEdits, getPendingEditsCount } from '../services/firebase/curriculumEdits';

interface CurriculumState {
  words: Record<string, WordBankDoc>;
  loadingWords: boolean;
  wordsError: string | null;

  curricula: Record<string, LanguageCurriculumDoc>; // keyed `${lang}_g${grade}`
  loadingCurricula: boolean;

  edits: Array<{ id: string } & CurriculumEditDoc>;
  pendingEdits: Array<{ id: string } & CurriculumEditDoc>;
  loadingEdits: boolean;

  pendingWordsCount: number;
  pendingEditsCount: number;

  fetchWords: (filters?: WordBankFilters) => Promise<void>;
  fetchWordsByIds: (ids: string[]) => Promise<void>;
  updateWordLocally: (wordId: string, data: Partial<WordBankDoc>) => void;

  fetchCurriculum: (lang: LanguageCode, grade: number) => Promise<void>;
  updateCurriculumLocally: (lang: LanguageCode, grade: number, levels: CurriculumLevel[]) => void;

  fetchEditsForClass: (classId: string) => Promise<void>;
  fetchPendingEdits: (projectId?: string) => Promise<void>;

  refreshBadgeCounts: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  words: {},
  loadingWords: false,
  wordsError: null,
  curricula: {},
  loadingCurricula: false,
  edits: [],
  pendingEdits: [],
  loadingEdits: false,
  pendingWordsCount: 0,
  pendingEditsCount: 0,
};

export const useCurriculumStore = create<CurriculumState>((set) => ({
  ...initialState,

  fetchWords: async (filters?: WordBankFilters) => {
    set({ loadingWords: true, wordsError: null });
    try {
      const { words } = await getWordBankPage(filters);
      const map: Record<string, WordBankDoc> = {};
      words.forEach(w => { map[w.id] = w; });
      set({ words: map, loadingWords: false });
    } catch (e: any) {
      set({ loadingWords: false, wordsError: e.message });
    }
  },

  fetchWordsByIds: async (ids: string[]) => {
    if (ids.length === 0) return;
    const fetched = await getWordBankByIds(ids);
    set(state => ({ words: { ...state.words, ...fetched } }));
  },

  updateWordLocally: (wordId, data) => {
    set(state => ({
      words: {
        ...state.words,
        [wordId]: state.words[wordId] ? { ...state.words[wordId], ...data } : state.words[wordId],
      },
    }));
  },

  fetchCurriculum: async (lang, grade) => {
    set({ loadingCurricula: true });
    try {
      const data = await getLanguageCurriculum(lang, grade);
      if (data) {
        const key = `${lang}_g${grade}`;
        set(state => ({
          curricula: { ...state.curricula, [key]: data },
          loadingCurricula: false,
        }));
      } else {
        set({ loadingCurricula: false });
      }
    } catch {
      set({ loadingCurricula: false });
    }
  },

  updateCurriculumLocally: (lang, grade, levels) => {
    const key = `${lang}_g${grade}`;
    set(state => ({
      curricula: {
        ...state.curricula,
        [key]: state.curricula[key]
          ? { ...state.curricula[key], levels }
          : { language: lang, grade, active: true, version: 1, levels, updatedAt: '', updatedBy: '' },
      },
    }));
  },

  fetchEditsForClass: async (classId) => {
    set({ loadingEdits: true });
    try {
      const edits = await getCurriculumEditsForClass(classId);
      set({ edits, loadingEdits: false });
    } catch {
      set({ loadingEdits: false });
    }
  },

  fetchPendingEdits: async (projectId?) => {
    set({ loadingEdits: true });
    try {
      const pendingEdits = await getPendingEdits(projectId);
      set({ pendingEdits, loadingEdits: false });
    } catch {
      set({ loadingEdits: false });
    }
  },

  refreshBadgeCounts: async () => {
    const [pendingWordsCount, pendingEditsCount] = await Promise.all([
      getPendingWordsCount(),
      getPendingEditsCount(),
    ]);
    set({ pendingWordsCount, pendingEditsCount });
  },

  reset: () => set(initialState),
}));
