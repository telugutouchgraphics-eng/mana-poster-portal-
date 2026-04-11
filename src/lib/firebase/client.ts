import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

const PUBLIC_ENV = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

export function isFirebaseClientConfigured(): boolean {
  return Object.values(PUBLIC_ENV).every(
    (value) => Boolean(value && value.trim().length > 0)
  );
}

function requiredEnv(value: string | undefined, name: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function getClientApp(): FirebaseApp {
  if (cachedApp) {
    return cachedApp;
  }

  const firebaseConfig = {
    apiKey: requiredEnv(PUBLIC_ENV.apiKey, "NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: requiredEnv(
      PUBLIC_ENV.authDomain,
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
    ),
    projectId: requiredEnv(
      PUBLIC_ENV.projectId,
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    ),
    storageBucket: requiredEnv(
      PUBLIC_ENV.storageBucket,
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
    ),
    messagingSenderId: requiredEnv(
      PUBLIC_ENV.messagingSenderId,
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    ),
    appId: requiredEnv(PUBLIC_ENV.appId, "NEXT_PUBLIC_FIREBASE_APP_ID"),
  };

  cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

export function getClientAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getClientApp());
  }
  return cachedAuth;
}

export function getClientDb(): Firestore {
  if (!cachedDb) {
    cachedDb = getFirestore(getClientApp());
  }
  return cachedDb;
}
