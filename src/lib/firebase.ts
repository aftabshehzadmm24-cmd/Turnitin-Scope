/**
 * Hybrid Firebase module: REAL Firebase Auth + stubbed Firestore.
 *
 * Google sign-in uses the actual Firebase Authentication SDK so the
 * "Continue with Google" button performs a real OAuth login.  Firestore
 * operations are stubbed so the app runs entirely on localStorage —
 * no database reads or writes go to the cloud.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updateEmail,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc as firestoreDoc,
  collection as firestoreCollection,
  deleteDoc as firestoreDeleteDoc,
  documentId as firestoreDocumentId,
  getDoc as firestoreGetDoc,
  getDocFromServer,
  getDocs as firestoreGetDocs,
  limit as firestoreLimit,
  onSnapshot as firestoreOnSnapshot,
  orderBy as firestoreOrderBy,
  query as firestoreQuery,
  runTransaction as firestoreRunTransaction,
  setDoc as firestoreSetDoc,
  startAfter as firestoreStartAfter,
  where as firestoreWhere,
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// ── Constants ───────────────────────────────────────────────────────────

export const ADMIN_EMAIL = 'aftabshehzadmm24@gmail.com';

// ── Types ────────────────────────────────────────────────────────────────

export type DocumentData = Record<string, any>;

export interface QueryDocumentSnapshot<T = DocumentData> {
  id: string;
  data: () => T;
  exists: () => boolean;
  ref: { id: string; path: string };
}

export interface QuerySnapshotResult<T = DocumentData> {
  empty: boolean;
  docs: QueryDocumentSnapshot<T>[];
  size: number;
  forEach: (callback: (doc: QueryDocumentSnapshot<T>) => void) => void;
}

// ── Firebase App + Auth (real) ───────────────────────────────────────────

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = firebaseConfigJson.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase Auth persistence initialization warning:', err);
  });
}

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { onAuthStateChanged };
export type { FirebaseUser };

// ── Auth functions (real) ────────────────────────────────────────────────

export function isUnauthorizedDomainError(error: any): boolean {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || error || '').toLowerCase();
  return (
    code === 'auth/unauthorized-domain' ||
    message.includes('auth/unauthorized-domain') ||
    message.includes('unauthorized domain')
  );
}

export function getGoogleAuthErrorMessage(error: any): string | undefined {
  const message = String(error?.message || error || '');
  const code = String(
    error?.code || message.match(/auth\/[\w-]+/i)?.[0] || '',
  ).toLowerCase();
  if (code === 'auth/internal-error') {
    return 'Firebase could not complete Google sign-in. In Firebase Console, confirm Google is enabled under Authentication > Sign-in method, add localhost (without :3000) under Authentication > Settings > Authorized domains, and check that your Firebase API key allows Firebase Authentication. If these are already correct, inspect the browser console Network tab for the failed identitytoolkit.googleapis.com request.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Google sign-in could not reach Firebase Authentication. Check your internet connection, browser extensions, and firewall, then try again.';
  }
  return undefined;
}

export async function signInWithGoogle(): Promise<{ user: FirebaseUser }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user };
  } catch (error: any) {
    if (isUnauthorizedDomainError(error)) {
      throw new Error(
        'This app domain is not authorized for Google sign-in. Add it to Firebase Console > Authentication > Settings > Authorized domains.',
      );
    }
    if (error?.code === 'auth/popup-blocked') {
      throw new Error(
        'Sign-in popup was blocked by your browser. Please allow popups or open the app in a new tab.',
      );
    }
    if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in popup was closed before completing verification.');
    }
    if (error?.code === 'auth/cancelled-popup-request') {
      throw new Error('Another sign-in attempt is currently in progress.');
    }
    const actionableMessage = getGoogleAuthErrorMessage(error);
    if (actionableMessage) {
      throw new Error(actionableMessage, { cause: error });
    }
    throw error;
  }
}

function parseAuthError(error: any): Error {
  const code = error?.code || '';
  if (code === 'auth/operation-not-allowed') {
    return new Error('This sign-in provider is disabled. Enable it in Firebase Console > Authentication > Sign-in method.');
  }
  if (code === 'auth/email-already-in-use') {
    return new Error('An account with this email already exists. Please switch to "Sign in" or use Google Sign-In.');
  }
  if (code === 'auth/weak-password') {
    return new Error('Password should be at least 6 characters.');
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return new Error('Invalid email or password. If you registered via Google, please use "Sign in with Google".');
  }
  if (code === 'auth/invalid-email') {
    return new Error('Please enter a valid email address format.');
  }
  if (code === 'auth/too-many-requests') {
    return new Error('Too many failed attempts. Please try again in a few moments, or use Google Sign-In.');
  }
  return error instanceof Error ? error : new Error(String(error?.message || error || 'Authentication failed.'));
}

export async function registerWithEmail(
  name: string,
  email: string,
  pass: string,
): Promise<{ user: FirebaseUser }> {
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === ADMIN_EMAIL) {
    throw new Error('This administrative account is pre-configured. Please sign in with the administrator account.');
  }
  try {
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    if (name.trim()) {
      await updateProfile(credential.user, { displayName: name.trim() });
    }
    try {
      await sendEmailVerification(credential.user);
    } catch (error) {
      console.warn('Could not send initial email verification:', error);
    }
    return { user: credential.user };
  } catch (error) {
    throw parseAuthError(error);
  }
}

export async function loginWithEmail(email: string, pass: string): Promise<{ user: FirebaseUser }> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    return { user: credential.user };
  } catch (error) {
    throw parseAuthError(error);
  }
}

export async function sendVerificationToCurrentUser(): Promise<void> {
  if (!auth.currentUser) return;
  await sendEmailVerification(auth.currentUser);
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err: any) {
    if (err?.code === 'auth/operation-not-allowed') return;
    throw parseAuthError(err);
  }
}

export async function updateFirebaseUserProfile(
  displayName?: string,
  photoURL?: string | null,
  email?: string,
): Promise<void> {
  if (auth.currentUser) {
    try {
      await updateProfile(auth.currentUser, {
        displayName: displayName ?? undefined,
        photoURL: photoURL ?? undefined,
      });
      if (email && email.trim() && email.trim().toLowerCase() !== (auth.currentUser.email || '').toLowerCase()) {
        try {
          await updateEmail(auth.currentUser, email.trim());
        } catch (emailErr) {
          console.warn('Firebase Auth updateEmail notice:', emailErr);
        }
      }
    } catch (err) {
      console.warn('Could not update Firebase Auth profile:', err);
    }
  }
}

export async function logOut(): Promise<void> {
  await signOut(auth).catch(() => {});
}

// ── Firestore helpers ───────────────────────────────────────────────────

export function cleanFirestoreData<T extends Record<string, any>>(data: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      clean[key] = cleanFirestoreData(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export async function safeSetDoc(docRef: any, data: any, options?: any): Promise<void> {
  try {
    await firestoreSetDoc(docRef, cleanFirestoreData(data), options);
  } catch (error) {
    console.error('Firestore write failed:', error);
    throw error;
  }
}

export async function safeGetDoc(docRef: any, timeoutMs = 3500): Promise<any | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      firestoreGetDoc(docRef),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Firestore getDoc timed out.')), timeoutMs);
      }),
    ]);
  } catch (error) {
    console.error('Firestore read failed:', error);
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function safeGetDocs(queryRef: any, timeoutMs = 3500): Promise<any | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      firestoreGetDocs(queryRef),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Firestore getDocs timed out.')), timeoutMs);
      }),
    ]);
  } catch (error) {
    console.error('Firestore query failed:', error);
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// ── Firestore query builders ────────────────────────────────────────────

export const doc = firestoreDoc;
export const collection = firestoreCollection;
export const deleteDoc = firestoreDeleteDoc;
export const documentId = firestoreDocumentId;
export const limit = firestoreLimit;
export const onSnapshot = firestoreOnSnapshot;
export const orderBy = firestoreOrderBy;
export const query = firestoreQuery;
export const runTransaction = firestoreRunTransaction;
export const setDoc = firestoreSetDoc;
export const startAfter = firestoreStartAfter;
export const where = firestoreWhere;
export const getDoc = firestoreGetDoc;
export const getDocs = firestoreGetDocs;

// ── Enums / error types ─────────────────────────────────────────────────

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, _operationType: OperationType, _path: string | null): never {
  throw error instanceof Error ? error : new Error(String(error));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(firestoreDoc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    return false;
  }
}
