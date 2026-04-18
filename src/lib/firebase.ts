import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = Object.values(firebaseConfig).every(Boolean);

let cachedApp: FirebaseApp | null | undefined;
let cachedDb: Firestore | null | undefined;

function supportsClientFirestore() {
  if (typeof window === "undefined") {
    return false;
  }

  const hasCoreApis =
    typeof window.fetch === "function" &&
    typeof window.Promise !== "undefined" &&
    typeof window.crypto?.getRandomValues === "function";

  const hasStorageApis = "indexedDB" in window;

  return hasCoreApis && hasStorageApis;
}

export function isFirestoreConfigured() {
  return isConfigured;
}

export function getFirebaseApp(): FirebaseApp | null {
  if (cachedApp !== undefined) {
    return cachedApp;
  }

  if (!isConfigured) {
    cachedApp = null;
    return cachedApp;
  }

  if (!supportsClientFirestore()) {
    cachedApp = null;
    return cachedApp;
  }

  try {
    cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  } catch {
    cachedApp = null;
  }

  return cachedApp;
}

export function getFirebaseDb(): Firestore | null {
  if (cachedDb !== undefined) {
    return cachedDb;
  }

  const app = getFirebaseApp();

  if (!app) {
    cachedDb = null;
    return cachedDb;
  }

  try {
    cachedDb = getFirestore(app);
  } catch {
    cachedDb = null;
  }

  return cachedDb;
}
