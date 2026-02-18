// Custom claims types for role-based access control

export type UserRole = 'admin' | 'projectAdmin' | 'pm' | 'principal' | 'teacher';

export interface CustomClaims {
  role: UserRole;
  projectId?: string;  // For projectAdmin and pm
  schoolIds?: string[]; // For principal
  schoolId?: string;    // For teacher
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  claims: CustomClaims;
}
