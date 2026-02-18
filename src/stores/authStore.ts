import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { CustomClaims } from '../types/claims';

interface AuthState {
  user: User | null;
  claims: CustomClaims | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setClaims: (claims: CustomClaims | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  claims: null,
  loading: true,

  setUser: (user) => set({ user }),

  setClaims: (claims) => set({ claims }),

  setLoading: (loading) => set({ loading }),

  reset: () => set({ user: null, claims: null, loading: false }),
}));
