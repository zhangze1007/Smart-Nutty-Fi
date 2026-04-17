import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let cachedDb: Firestore | null | undefined;

export function getAdminFirestore(): Firestore | null {
  if (cachedDb !== undefined) {
    return cachedDb;
  }

  try {
    const app =
      getApps()[0] ??
      initializeApp({
        credential: applicationDefault(),
        projectId:
          process.env.FIREBASE_PROJECT_ID ??
          process.env.GOOGLE_CLOUD_PROJECT ??
          process.env.GCLOUD_PROJECT,
      });

    cachedDb = getFirestore(app);
  } catch {
    cachedDb = null;
  }

  return cachedDb;
}
