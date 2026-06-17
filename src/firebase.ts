import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  indexedDBLocalPersistence,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  updateProfile,
  type Auth,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

const isNativeApp = Capacitor.isNativePlatform();

function createAuth(): Auth {
  if (isNativeApp) {
    return initializeAuth(app, {
      persistence: indexedDBLocalPersistence,
    });
  }

  return getAuth(app);
}

export const auth = createAuth();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL */
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export function isGoogleUser(user: User | null): boolean {
  if (!user) return false;
  return user.providerData.some((provider) => provider.providerId === 'google.com');
}

export function getUserPhotoURL(user: User | null, fallbackPhotoURL?: string | null): string | null {
  if (!user) return fallbackPhotoURL || null;
  if (user.photoURL) return user.photoURL;

  const googleProvider = user.providerData.find((provider) => provider.providerId === 'google.com');
  if (googleProvider?.photoURL) return googleProvider.photoURL;

  return fallbackPhotoURL || null;
}

async function syncGoogleProfilePhoto(user: User, photoURL?: string | null, displayName?: string | null): Promise<User> {
  const resolvedPhoto = photoURL || getUserPhotoURL(user);
  const resolvedName = displayName || user.displayName;

  if (!resolvedPhoto && !resolvedName) {
    return user;
  }

  const needsPhoto = resolvedPhoto && user.photoURL !== resolvedPhoto;
  const needsName = resolvedName && user.displayName !== resolvedName;

  if (!needsPhoto && !needsName) {
    return user;
  }

  await updateProfile(user, {
    ...(needsPhoto && resolvedPhoto ? { photoURL: resolvedPhoto } : {}),
    ...(needsName && resolvedName ? { displayName: resolvedName } : {}),
  });
  await user.reload();

  return auth.currentUser || user;
}

export async function ensureGoogleProfilePhoto(user: User): Promise<User> {
  if (getUserPhotoURL(user)) {
    return user;
  }

  if (isNativeApp) {
    try {
      const { user: nativeUser } = await FirebaseAuthentication.getCurrentUser();
      if (nativeUser?.photoUrl || nativeUser?.displayName) {
        return syncGoogleProfilePhoto(user, nativeUser.photoUrl, nativeUser.displayName);
      }
    } catch (error) {
      console.error('Failed to read native Google profile:', error);
    }
  }

  const providerPhoto = user.providerData.find((provider) => provider.providerId === 'google.com')?.photoURL;
  if (providerPhoto || user.displayName) {
    return syncGoogleProfilePhoto(user, providerPhoto, user.displayName);
  }

  return user;
}

export const ANDROID_DEBUG_SHA1 = 'C5:19:EF:EF:69:B3:72:DE:43:06:13:B0:73:48:DB:45:88:EB:EE:25';

export const GOOGLE_SIGNIN_SETUP_HINT =
  `Add this SHA-1 in Firebase Console (Project Settings → Android app → Add fingerprint), then download a new google-services.json:\n${ANDROID_DEBUG_SHA1}`;

export function formatAuthError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Google sign-in failed.';
}

export function isAndroidGoogleSignInMisconfigured(error: unknown): boolean {
  const message = formatAuthError(error).toLowerCase();
  return (
    message.includes('no credential') ||
    (message.includes('credential') && message.includes('available')) ||
    message.includes('id token') ||
    message.includes('native_no_id_token') ||
    message.includes('12500') ||
    message.includes('10:') ||
    message.includes('developer_error')
  );
}

export async function handleGoogleRedirectResult(): Promise<UserCredential | null> {
  if (!isNativeApp) return null;

  try {
    return await getRedirectResult(auth);
  } catch (error) {
    console.error('Google redirect sign-in failed:', error);
    return null;
  }
}

async function signInWithGoogleNative() {
  try {
    return await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
  } catch (legacyError) {
    console.warn('Legacy Google sign-in failed, trying Credential Manager:', legacyError);
    return FirebaseAuthentication.signInWithGoogle();
  }
}

export async function signInWithGoogle(): Promise<UserCredential> {
  if (isNativeApp) {
    try {
      const result = await signInWithGoogleNative();
      const idToken = result.credential?.idToken;

      if (!idToken) {
        console.warn('Native Google sign-in returned no ID token, trying browser redirect');
        await signInWithRedirect(auth, googleProvider);
        throw new Error('REDIRECT_PENDING');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);

      if (result.user?.photoUrl || result.user?.displayName) {
        await syncGoogleProfilePhoto(
          userCredential.user,
          result.user.photoUrl,
          result.user.displayName,
        );
        if (auth.currentUser) {
          return { ...userCredential, user: auth.currentUser };
        }
      }

      return userCredential;
    } catch (nativeError) {
      const nativeMessage = formatAuthError(nativeError);
      if (nativeMessage === 'REDIRECT_PENDING') {
        throw nativeError;
      }

      console.warn('Native Google sign-in failed, trying browser redirect:', nativeError);
      await signInWithRedirect(auth, googleProvider);
      throw new Error('REDIRECT_PENDING');
    }
  }

  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser(): Promise<void> {
  if (isNativeApp) {
    await FirebaseAuthentication.signOut();
  }

  await signOut(auth);
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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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

// Check connection to Firestore database server
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or network status.");
    }
  }
}

testConnection();
