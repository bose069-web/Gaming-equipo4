import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, type User } from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
};

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseFirestore: Firestore | null = null;

export function getFirebaseAuth(): Auth | null {
  if (firebaseAuth) return firebaseAuth;

  const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);
  if (missingKeys.length > 0) return null;

  firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  return firebaseAuth;
}

export function getMissingFirebaseAuthConfig(): string[] {
  return requiredKeys.filter((key) => !firebaseConfig[key]);
}

export function getFirebaseFirestore(): Firestore | null {
  if (firebaseFirestore) return firebaseFirestore;

  const auth = getFirebaseAuth();
  if (!auth) return null;

  firebaseFirestore = getFirestore(firebaseApp ?? initializeApp(firebaseConfig));
  return firebaseFirestore;
}

export async function saveUserProfile(user: User, hasVerifiedEmail: boolean): Promise<void> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return;

  const profileReference = doc(firestore, 'users', user.uid);
  await setDoc(profileReference, {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    emailVerified: hasVerifiedEmail,
    lastLoginAt: serverTimestamp()
  }, { merge: true });
}

export interface UserProfileData {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  registeredAt?: unknown;
  lastLoginAt?: unknown;
  bio?: string;
  favoritePlatform?: string;
  favoriteGenre?: string;
  favoriteGame?: string;
  favoriteGames?: string[];
  savedGames?: string[];
  recentlyViewedGames?: string[];
}

export async function getUserProfile(uid: string): Promise<UserProfileData | null> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return null;

  const profileReference = doc(firestore, 'users', uid);
  const snapshot = await getDoc(profileReference);
  if (!snapshot.exists()) return null;

  return snapshot.data() as UserProfileData;
}

export async function updateUserProfile(uid: string, data: Partial<Pick<UserProfileData, 'displayName' | 'bio' | 'favoritePlatform' | 'favoriteGenre' | 'favoriteGame' | 'favoriteGames' | 'savedGames' | 'recentlyViewedGames'>>): Promise<void> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return;

  const profileReference = doc(firestore, 'users', uid);
  await updateDoc(profileReference, data);
}

export async function markUserRegistration(user: User): Promise<void> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return;

  const profileReference = doc(firestore, 'users', user.uid);
  await setDoc(profileReference, {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    emailVerified: user.emailVerified,
    registeredAt: serverTimestamp(),
    lastLoginAt: serverTimestamp()
  }, { merge: true });
}