import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyBEGwHq7KswLbniCsby_pm7_dx3XkuJ7yY',
  authDomain: 'chitram-51e22.firebaseapp.com',
  projectId: 'chitram-51e22',
  storageBucket: 'chitram-51e22.firebasestorage.app',
  messagingSenderId: '324255891023',
  appId: '1:324255891023:web:fa710e557884301beb743a',
  measurementId: 'G-39WMZHXN05',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Set persistence to local (survives browser restarts)
setPersistence(auth, browserLocalPersistence);

export default app;
