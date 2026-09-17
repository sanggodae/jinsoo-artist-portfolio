import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

/**
 * Firebase configuration with verified project ID: gen-lang-client-0635539736
 */
export const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || appletConfig.apiKey,
  authDomain: appletConfig.authDomain || 'gen-lang-client-0635539736.firebaseapp.com',
  projectId: 'gen-lang-client-0635539736',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || appletConfig.storageBucket,
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || appletConfig.messagingSenderId,
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || appletConfig.appId,
};

export const firestoreDatabaseId: string =
  appletConfig.firestoreDatabaseId ||
  'ai-studio-artworkmanagemen-3dc860c2-f0d3-49b5-8f1b-ae981ebb9a15';

// Initialize and export the Firebase App singleton
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize and export Firebase Authentication
export const auth: Auth = getAuth(app);

// Initialize and export Cloud Firestore using the canonical getFirestore() with the project database
export const db: Firestore = getFirestore(app, firestoreDatabaseId);

export const firestore: Firestore = db;

// Initialize and export Firebase Storage
// Required bucket: gs://gen-lang-client-0635539736-artworks-seoul
export const STORAGE_BUCKET_URI = 'gs://gen-lang-client-0635539736-artworks-seoul';

function initStorageInstance(): FirebaseStorage {
  const instance = getStorage(app, STORAGE_BUCKET_URI);
  // Set retry limits: 60s for full image uploads, 30s for general operations
  instance.maxUploadRetryTime = 60000;
  instance.maxOperationRetryTime = 30000;
  return instance;
}

export const storage: FirebaseStorage = initStorageInstance();

// Functional getters for lazy or dynamic access
export function getFirebaseApp(): FirebaseApp {
  return app;
}

export function getFirebaseAuth(): Auth {
  return auth;
}

export function getFirebaseFirestore(): Firestore {
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  return storage;
}

// Standard storage folder hierarchy for artworks and portfolio assets
export const STORAGE_PATHS = {
  ARTWORKS_ORIGINALS: 'artworks/originals',
  ARTWORKS_WEB: 'artworks/web',
  ARTIST: 'artist',
  COVERS: 'covers',
  DOCUMENTS: 'documents',
} as const;

/**
 * Validates connectivity to the Firestore instance.
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      console.warn('[Firebase] Firestore client is offline.');
      return false;
    }
    // A non-offline error (e.g. permission or not-found) indicates network reachability
    return true;
  }
}
