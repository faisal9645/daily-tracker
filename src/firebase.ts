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

export async function signInWithGoogle(): Promise<UserCredential> {
  if (isNativeApp) {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;

    if (!idToken) {
      throw new Error('Google sign-in did not return an ID token.');
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
