import { useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdTokenResult,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../../config/firebase';
import { useAuthStore } from '../../../stores/authStore';
import type { CustomClaims } from '../../../types/claims';

export function useAuth() {
  const { user, claims, loading, setUser, setClaims, setLoading, reset } = useAuthStore();

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Get custom claims from ID token
        const tokenResult = await getIdTokenResult(firebaseUser, true);
        const customClaims = validateClaims(tokenResult.claims);
        setClaims(customClaims);
      } else {
        reset();
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const tokenResult = await getIdTokenResult(credential.user, true);
      const customClaims = validateClaims(tokenResult.claims);

      if (!customClaims) {
        await signOut(auth);
        throw new Error('Invalid or missing role claims. Please contact an administrator.');
      }

      setUser(credential.user);
      setClaims(customClaims);
      return customClaims;
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    try {
      await signOut(auth);
      reset();
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new Error(error.message || 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  }

  async function forceTokenRefresh() {
    if (user) {
      const tokenResult = await getIdTokenResult(user, true);
      const customClaims = validateClaims(tokenResult.claims);
      setClaims(customClaims);
    }
  }

  async function register(name: string, email: string, password: string, schoolCode: string) {
    setLoading(true);
    try {
      const callable = httpsCallable(functions, 'registerTeacher');
      await callable({ name, email, password, schoolCode });

      // Cloud Function created the user and set claims — now sign in
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const tokenResult = await getIdTokenResult(credential.user, true);
      const customClaims = validateClaims(tokenResult.claims);

      if (!customClaims) {
        await signOut(auth);
        throw new Error('Registration succeeded but claims were not set. Please try signing in.');
      }

      setUser(credential.user);
      setClaims(customClaims);
      return customClaims;
    } catch (error: any) {
      console.error('Registration error:', error);
      // Extract message from Firebase callable error
      const message = error?.message || 'Failed to register';
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }

  return {
    user,
    claims,
    loading,
    login,
    logout,
    register,
    forceTokenRefresh,
  };
}

// Helper function to validate and extract custom claims
function validateClaims(claims: any): CustomClaims | null {
  // Check for role claim
  if (!claims.role) {
    return null;
  }

  const validRoles = ['admin', 'projectAdmin', 'pm', 'principal', 'teacher'];
  if (!validRoles.includes(claims.role)) {
    return null;
  }

  return {
    role: claims.role,
    projectId: claims.projectId,
    schoolIds: claims.schoolIds,
    schoolId: claims.schoolId,
  };
}
