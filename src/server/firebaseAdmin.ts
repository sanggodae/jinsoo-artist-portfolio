import { initializeApp, getApps, cert, applicationDefault, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let adminApp: App | null = null;

export function getFirebaseAdmin(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  if (adminApp) {
    return adminApp;
  }

  const projectId =
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'gen-lang-client-0635539736';

  const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');

  if (fs.existsSync(keyPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
      console.log('[Firebase Admin] Initialized with serviceAccountKey.json');
      return adminApp;
    } catch (err) {
      console.error('[Firebase Admin] Failed to parse serviceAccountKey.json:', err);
    }
  }

  // Fallback to Application Default Credentials
  try {
    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId,
    });
    console.log('[Firebase Admin] Initialized with Application Default Credentials');
  } catch (err) {
    console.warn('[Firebase Admin] ADC fallback, initializing with projectId:', projectId);
    adminApp = initializeApp({
      projectId,
    });
  }

  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdmin());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdmin());
}
