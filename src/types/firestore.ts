import { Timestamp } from 'firebase/firestore';

// Language codes supported in the app
export type LanguageCode = 'en' | 'hi' | 'te' | 'mr' | 'es' | 'fr';

// ===== Core User Collections =====

export interface StudentDoc {
  name: string;
  email: string;
  parentEmail?: string;
  age?: number;
  grade?: string;
  homeLanguage?: LanguageCode;
  learningLanguages?: LanguageCode[];
  activeLearningLanguage?: LanguageCode;
  kidType?: 'individual' | 'classroom' | null;
  classId?: string | null;
  classIds?: string[];
  schoolId?: string | null;
  avatarColor: string;
  analytics?: {
    streakDays?: number;
    lastStudyDate?: string;
    totalWordsLearned?: number;
    totalSessions?: number;
    averageAccuracy?: number;
    quizAccuracy?: number;
    drawingAccuracy?: number;
    levelProgress?: Record<string, { completed: boolean; wordsDone: number; totalWords: number; completedAt?: Timestamp }>;
  };
  expoPushToken?: string;
  createdAt: Timestamp;
}

export interface TeacherDoc {
  name: string;
  email: string;
  school?: string;
  schoolId?: string | null;
  projectId?: string | null;
  avatarColor: string;
  analytics?: any;
  createdAt: Timestamp;
}

/** @deprecated Use StudentDoc or TeacherDoc instead */
export interface UserDoc {
  role: 'kid' | 'teacher';
  name: string;
  email: string;
  avatarColor: string;
  createdAt: Timestamp;
  parentEmail?: string;
  age?: number;
  grade?: string;
  homeLanguage?: LanguageCode;
  learningLanguages?: LanguageCode[];
  activeLearningLanguage?: LanguageCode;
  kidType?: 'individual' | 'classroom' | null;
  classId?: string | null;
  classIds?: string[];
  schoolId?: string | null;
  school?: string;
  analytics?: any;
}

export interface SchoolDoc {
  name: string;
  code: string;
  projectId?: string;
  createdBy: string;
  teacherIds: string[];
  createdAt: Timestamp;
}

export interface CustomWordEdit {
  word?: Partial<Record<LanguageCode, string>>;
  pronunciation?: Partial<Record<LanguageCode, string>>;
  sentence?: Partial<Record<LanguageCode, string>>;
  imageUrl?: string | null;
  editedAt?: Timestamp;
  editedBy?: string;
}

export interface ClassCustomCurriculum {
  levels: CurriculumLevel[];
  /** Per-word overrides for this class — originals in wordBank are never touched */
  customWords?: Record<string, CustomWordEdit>;
  adoptedFrom?: string;
  appliedAt: Timestamp;
}

export interface ClassDoc {
  name: string;
  grade: string;
  teacherId: string;
  schoolId: string;
  code: string;
  studentIds: string[];
  pendingStudentIds: string[];
  homeLanguage: LanguageCode;
  learningLanguage: LanguageCode;
  // Legacy — kept for mobile app compat via getMyData CF
  addedWordIds: string[];
  removedWordIds: string[];
  // New — overrides languageCurricula when set
  customCurriculum?: ClassCustomCurriculum | null;
  createdAt: Timestamp;
}

export interface ProjectDoc {
  name: string;
  description?: string;
  schoolIds: string[];
  createdBy: string;
  createdAt: Timestamp;
}

export interface LearningAttemptDoc {
  wordId: number;
  timestamp: Timestamp;
  finalLabel: boolean;
  mlPrediction?: boolean;
  mlConfidence?: number;
  recallDuration?: number;
  guidedDrawingDuration?: number;
  unguidedDrawingDuration?: number;
}

// ===== Word Bank =====

export interface AudioUrlMap {
  word: Record<LanguageCode, string | null>;
  meaning: Record<LanguageCode, string | null>;
  sentence: Record<LanguageCode, string | null>;
}

export interface WordBankDoc {
  numericId: number;
  status: 'active' | 'pending' | 'rejected';
  wordType: 'NS360' | 'GQD';
  difficulty: 'Low' | 'Medium' | 'High';
  active: boolean;
  word: Record<LanguageCode, string>;
  pronunciation: Record<LanguageCode, string>;
  meaning: Record<LanguageCode, string>;
  sentence: Record<LanguageCode, string>;
  imageUrl: string | null;
  imageStoragePath?: string | null;
  audioUrl: AudioUrlMap;
  submittedBy?: string;
  submittedAt?: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  rejectionNote?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== Language Curricula =====

export interface CurriculumLevel {
  levelNum: number;
  wordIds: string[];
}

export interface LanguageCurriculumDoc {
  language: LanguageCode;
  grade: number;
  active: boolean;
  version: number;
  levels: CurriculumLevel[];
  updatedAt: Timestamp | string;
  updatedBy: string;
}

// ===== Curriculum Edits (teacher proposals) =====

export interface CurriculumEditDoc {
  classId: string;
  projectId: string;
  teacherUid: string;
  grade: number;
  language: LanguageCode;
  submittedAt: Timestamp;
  status: 'pending' | 'approved' | 'rejected';
  shareWithProject: boolean;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  rejectionNote?: string;
  proposedLevels: CurriculumLevel[];
  pendingWordIds: string[];
  resolvedLevels?: CurriculumLevel[];
  adoptedBy: string[];
}

// ===== MCQ Assignments =====

export interface McqQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctIndices: number[];
}

export interface McqAssignmentDoc {
  classId: string;
  projectId?: string;
  teacherUid?: string;
  title: string;
  dueDate: Timestamp | string;
  totalPoints: number;
  status: 'draft' | 'active' | 'closed';
  questions: McqQuestion[];
  createdAt: Timestamp;
}

export interface McqAnswer {
  questionId: string;
  selectedIndices: number[];
  correct: boolean;
}

export interface StudentSubmissionDoc {
  assignmentId: string;
  uid: string;
  classId: string;
  submittedAt?: Timestamp;
  status: 'pending' | 'submitted' | 'graded';
  score?: number;
  totalPoints: number;
  answers: McqAnswer[];
}

// ===== Announcements =====

export interface AnnouncementDoc {
  classId: string;
  teacherUid: string;
  teacherName: string;
  title: string;
  body: string;
  createdAt: Timestamp;
  pinned: boolean;
}

// ===== License Keys =====

export interface LicenseKeyDoc {
  key: string;
  grade: number;
  language: LanguageCode;
  status: 'unused' | 'active' | 'expired';
  createdBy: string;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  usedBy?: string;
  redeemedAt?: Timestamp;
}

// ===== Legacy (kept for old pages until migration complete) =====

/** @deprecated use WordBankDoc */
export interface CurriculumWordDoc {
  numericId: number;
  grade: number;
  level: number;
  orderInLevel: number;
  wordType: 'NS360' | 'GQD';
  source: 'mother' | 'teacher';
  createdBy: string;
  word: Record<string, string>;
  meaning: Record<string, string>;
  sentence: Record<string, string>;
  imageUrl: string | null;
  imageStoragePath: string | null;
  audioUrl: AudioUrlMap;
  difficulty: 'Low' | 'Medium' | 'High';
  active: boolean;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

/** @deprecated use LanguageCurriculumDoc */
export interface MotherCurriculumDoc {
  grade: string;
  wordIds: string[];
  levelCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** @deprecated use CurriculumEditDoc */
export interface TeacherCurriculumDoc {
  teacherId: string;
  grade: string;
  addedWordIds: string[];
  removedWordIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** @deprecated use McqAssignmentDoc */
export interface AssignmentDoc {
  wordSetId: number | string;
  classId: string;
  className: string;
  assignedTo: 'all' | string[];
  teacherId: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'upcoming' | 'completed';
  createdAt: Timestamp;
  curriculumSnapshot?: {
    grade: string;
    wordIds: string[];
    sourceType: 'mother' | 'teacher-customized';
  };
}
