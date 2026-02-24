import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { CustomClaims } from '../types/claims';

interface AuthState {
  user: User | null;
  claims: CustomClaims | null;
  loading: boolean;
  loginError: string | null;
  needsVerification: boolean;
  setUser: (user: User | null) => void;
  setClaims: (claims: CustomClaims | null) => void;
  setLoading: (loading: boolean) => void;
  setLoginError: (error: string | null) => void;
  setNeedsVerification: (v: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  claims: null,
  loading: true,
  loginError: null,
  needsVerification: false,

  setUser: (user) => set({ user }),
  setClaims: (claims) => set({ claims }),
  setLoading: (loading) => set({ loading }),
  setLoginError: (loginError) => set({ loginError }),
  setNeedsVerification: (needsVerification) => set({ needsVerification }),

  reset: () => set({ user: null, claims: null, loading: false, loginError: null, needsVerification: false }),
}));
