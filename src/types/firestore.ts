import { Timestamp } from 'firebase/firestore';

// Language codes supported in the app
export type LanguageCode = 'en' | 'hi' | 'te' | 'mr' | 'es' | 'fr';

// ===== Existing Collections (from mobile app) =====

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
  analytics?: any;
  createdAt: Timestamp;
}

export interface TeacherDoc {
  name: string;
  email: string;
  school?: string;
  schoolId?: string | null;
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
  projectId?: string; // NEW: Link to project
  createdBy: string;
  teacherIds: string[];
  createdAt: Timestamp;
}

export interface ClassDoc {
  name: string;
  grade: string;
  teacherId: string;
  schoolId: string;
  code: string;
  studentIds: string[];
  pendingStudentIds: string[];
  /** Home language of students in this class (e.g. 'en') */
  homeLanguage: LanguageCode;
  /** Language kids in this class are learning (e.g. 'te') */
  learningLanguage: LanguageCode;
  /** curriculumWords docIds added by the teacher beyond mother curriculum */
  addedWordIds: string[];
  /** curriculumWords docIds removed from the mother curriculum for this class */
  removedWordIds: string[];
  createdAt: Timestamp;
}

export interface AssignmentDoc {
  wordSetId: number | string; // number for legacy, string for new
  classId: string;
  className: string;
  assignedTo: 'all' | string[];
  teacherId: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'upcoming' | 'completed';
  createdAt: Timestamp;
  // NEW: Enhanced for curriculum integration
  curriculumSnapshot?: {
    grade: string;
    wordIds: string[];
    sourceType: 'mother' | 'teacher-customized';
  };
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

// ===== New Collections (for web app) =====

export interface ProjectDoc {
  name: string;
  description?: string;
  schoolIds: string[];
  createdBy: string; // Super Admin or Project Admin UID
  createdAt: Timestamp;
}

export interface MotherCurriculumDoc {
  grade: string; // '1', '2', '3', '4', '5'
  wordIds: string[]; // Firestore docIds for curriculumWords in this grade
  levelCount: number; // max level number in this grade
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AudioUrlMap {
  word: Record<string, string | null>;
  meaning: Record<string, string | null>;
  sentence: Record<string, string | null>;
}

export interface CurriculumWordDoc {
  numericId: number;         // 1–189, sequential; used by kid app for wordProgress
  grade: number;             // 1–5
  level: number;             // 1–4 within grade
  orderInLevel: number;      // 1–10 position within level
  wordType: 'NS360' | 'GQD';
  source: 'mother' | 'teacher';
  createdBy: string;         // UID (admin/seed)
  word: Record<string, string>;       // { te, en, hi, mr, es, fr }
  meaning: Record<string, string>;    // definition per language; starts empty
  sentence: Record<string, string>;   // { te, en, hi, mr, es, fr }
  imageUrl: string | null;
  imageStoragePath: string | null;
  audioUrl: AudioUrlMap;             // null until pre-recorded
  difficulty: 'Low' | 'Medium' | 'High';
  active: boolean;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface TeacherCurriculumDoc {
  teacherId: string;
  grade: string;
  addedWordIds: string[]; // Teacher-added words
  removedWordIds: string[]; // Removed from mother curriculum
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
