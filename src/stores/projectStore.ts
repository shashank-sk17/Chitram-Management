import { create } from 'zustand';
import type { ProjectDoc, SchoolDoc } from '../types/firestore';

interface ProjectState {
  projects: ProjectDoc[];
  schools: SchoolDoc[];
  selectedProjectId: string | null;
  loading: boolean;

  setProjects: (projects: ProjectDoc[]) => void;
  setSchools: (schools: SchoolDoc[]) => void;
  setSelectedProjectId: (projectId: string | null) => void;
  setLoading: (loading: boolean) => void;

  addProject: (project: ProjectDoc) => void;
  updateProject: (projectId: string, updates: Partial<ProjectDoc>) => void;
  removeProject: (projectId: string) => void;

  addSchool: (school: SchoolDoc) => void;
  updateSchool: (schoolId: string, updates: Partial<SchoolDoc>) => void;
  removeSchool: (schoolId: string) => void;

  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  schools: [],
  selectedProjectId: null,
  loading: false,

  setProjects: (projects) => set({ projects }),
  setSchools: (schools) => set({ schools }),
  setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),
  setLoading: (loading) => set({ loading }),

  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),

  updateProject: (projectId, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.name === projectId ? { ...p, ...updates } : p
      ),
    })),

  removeProject: (projectId) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.name !== projectId),
    })),

  addSchool: (school) =>
    set((state) => ({ schools: [...state.schools, school] })),

  updateSchool: (schoolId, updates) =>
    set((state) => ({
      schools: state.schools.map((s) =>
        s.name === schoolId ? { ...s, ...updates } : s
      ),
    })),

  removeSchool: (schoolId) =>
    set((state) => ({
      schools: state.schools.filter((s) => s.name !== schoolId),
    })),

  reset: () =>
    set({
      projects: [],
      schools: [],
      selectedProjectId: null,
      loading: false,
    }),
}));
