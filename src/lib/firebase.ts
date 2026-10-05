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
  setLogLevel,
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Configure logging level to silent to suppress noisy internal transport retry warnings
try {
  setLogLevel('silent');
} catch {
  // Ignore in case already configured
}

// Config sourced directly from provisioned firebase-applet-config.json
const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth with Local Persistence to persist auth state
export const auth = getAuth(app);
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase Auth persistence initialization warning:', err);
  });
}

// Initialize Firestore directly with provisioned database ID
function initFirestoreInstance(): Firestore {
  const dbId = firebaseConfigJson.firestoreDatabaseId || undefined;
  try {
    return dbId ? getFirestore(app, dbId) : getFirestore(app);
  } catch (err) {
    console.warn('Fallback getFirestore initialization:', err);
    return getFirestore(app);
  }
}

export const db: Firestore = initFirestoreInstance();
// Validate Connection to Firestore per Firebase Skill guidelines
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Operating in offline mode or checking Firebase configuration.');
    }
    return false;
  }
}

if (typeof window !== 'undefined') {
  testConnection().catch(() => {});
}

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
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Google Auth Provider configured with prompt selection
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export function isUnauthorizedDomainError(error: any): boolean {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || error || '').toLowerCase();
  return code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain') || message.includes('unauthorized domain');
}

/**
 * Clean data before sending to Firestore to strip out any `undefined` values
 * which would cause Firestore setDoc() or updateDoc() to throw "Unsupported field value: undefined".
 */
export function cleanFirestoreData<T extends Record<string, any>>(data: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      clean[key] = cleanFirestoreData(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Safe wrapper around setDoc that strips undefined fields and gracefully handles offline/errors
 */
export async function safeSetDoc(docRef: any, data: any, options?: any): Promise<void> {
  try {
    const cleaned = cleanFirestoreData(data);
    if (options) {
      await setDoc(docRef, cleaned, options);
    } else {
      await setDoc(docRef, cleaned);
    }
  } catch (err: any) {
    // If backend is unreachable or user is offline, Firestore continues locally or logs warning
    console.warn('Firestore safeSetDoc notice:', err?.message || err);
  }
}

/**
 * Safe getDoc that enforces a timeout and handles offline mode gracefully
 */
export async function safeGetDoc(docRef: any, timeoutMs: number = 3500): Promise<any> {
  try {
    return await Promise.race([
      getDoc(docRef),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore getDoc timeout, operating in offline mode')), timeoutMs)
      ),
    ]);
  } catch (err: any) {
    console.warn('Firestore safeGetDoc notice (operating in offline/cached mode):', err?.message || err);
    return null;
  }
}

/**
 * Safe getDocs query that enforces a timeout and handles offline mode gracefully
 */
export async function safeGetDocs(queryRef: any, timeoutMs: number = 3500): Promise<any> {
  try {
    return await Promise.race([
      getDocs(queryRef),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore getDocs timeout, operating in offline mode')), timeoutMs)
      ),
    ]);
  } catch (err: any) {
    console.warn('Firestore safeGetDocs notice (operating in offline/cached mode):', err?.message || err);
    return null;
  }
}

/**
 * Sign in / Register with Google using Firebase Auth
 */
export async function signInWithGoogle(): Promise<{ user: FirebaseUser; isNewUser?: boolean }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return {
      user: result.user,
    };
  } catch (error: any) {
    if (isUnauthorizedDomainError(error)) {
      throw new Error('This app domain is not authorized for Google sign-in. Add it to Firebase Console > Authentication > Settings > Authorized domains.');
    }
    if (error?.code === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups or open the app in a new tab.');
    }
    if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in popup was closed before completing verification.');
    }
    if (error?.code === 'auth/cancelled-popup-request') {
      throw new Error('Another sign-in attempt is currently in progress.');
    }
    throw error;
  }
}

export const ADMIN_EMAIL = 'aftabshehzadmm24@gmail.com';

/**
 * Helper to map Firebase Auth error codes to helpful, user-friendly messages
 */
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

/** Register a client account with Firebase Authentication. */
export async function registerWithEmail(
  name: string,
  email: string,
  pass: string
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

/**
 * Sign in with Email and Password through Firebase Authentication.
 */
export async function loginWithEmail(email: string, pass: string): Promise<{ user: FirebaseUser }> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    return { user: credential.user };
  } catch (error) {
    throw parseAuthError(error);
  }
}

/**
 * Send email verification link
 */
export async function sendVerificationToCurrentUser(): Promise<void> {
  if (!auth.currentUser) return;
  await sendEmailVerification(auth.currentUser);
}

/**
 * Send password reset email
 */
export async function resetPasswordForEmail(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err: any) {
    if (err?.code === 'auth/operation-not-allowed') {
      // Gracefully acknowledge password reset request
      return;
    }
    throw parseAuthError(err);
  }
}

/**
 * Update the user profile in Firebase Auth and active session
 */
export async function updateFirebaseUserProfile(
  displayName?: string,
  photoURL?: string | null,
  email?: string
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

/**
 * Log out
 */
export async function logOut(): Promise<void> {
  await signOut(auth).catch(() => {});
}

export { onAuthStateChanged };
export type { FirebaseUser };
