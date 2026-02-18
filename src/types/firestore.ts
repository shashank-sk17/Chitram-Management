import { Timestamp } from 'firebase/firestore';

// Language codes supported in the app
export type LanguageCode = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'ml' | 'bn' | 'mr' | 'es' | 'fr';

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
  wordIds: string[]; // References to curriculumWords
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CurriculumWordDoc {
  source: 'mother' | 'teacher';
  createdBy: string; // UID (admin or teacher)
  word: Record<LanguageCode, string>;
  translations: Record<LanguageCode, string>;
  meaning: Record<LanguageCode, string>;
  sentence: Record<LanguageCode, string>;
  imageUrl?: string;
  imageStoragePath?: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TeacherCurriculumDoc {
  teacherId: string;
  grade: string;
  addedWordIds: string[]; // Teacher-added words
  removedWordIds: string[]; // Removed from mother curriculum
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
