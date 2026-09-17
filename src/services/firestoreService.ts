import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db, getFirebaseFirestore, getFirebaseAuth } from './firebase';
import {
  Artwork,
  Exhibition,
  Award,
  CVSection,
  ArtistNoteItem,
  SiteSettings,
  SubmissionPackage,
  MigrationStepStatus,
} from '../types';
import {
  uploadBase64ToStorage,
  isFirebaseStorageUrl,
  testFirebaseStorageConnection,
} from './storageService';
import { parseArtworkString } from '../utils/artworkParser';
import { materialToCode } from '../utils/codeGenerator';

// Collection references
const COLLECTIONS = {
  ARTWORKS: 'artworks',
  EXHIBITIONS: 'exhibitions',
  AWARDS: 'awards',
  CV: 'cv',
  ARTIST_NOTES: 'artistNotes',
  SITE_SETTINGS: 'siteSettings',
  SUBMISSIONS: 'submissions',
} as const;

/* =========================================================
   1. Artworks (작품 컬렉션)
   ========================================================= */

/**
 * Reads all artworks from Firestore 'artworks' collection.
 * Preserves the existing displayOrder sequence.
 */
export async function getArtworksFromFirestore(): Promise<Artwork[]> {
  const db = getFirebaseFirestore();
  const q = query(collection(db, COLLECTIONS.ARTWORKS), orderBy('displayOrder', 'asc'));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => d.data() as Artwork);
  return list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

export const fetchArtworksFromFirestore = getArtworksFromFirestore;

export function subscribeFirestoreArtworks(
  callback: (artworks: Artwork[]) => void
): () => void {
  const db = getFirebaseFirestore();
  const q = query(collection(db, COLLECTIONS.ARTWORKS), orderBy('displayOrder', 'asc'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => d.data() as Artwork);
    callback(list);
  });
}

export async function setArtworkInFirestore(artwork: Artwork): Promise<void> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.ARTWORKS, artwork.id);
  await setDoc(docRef, artwork, { merge: true });
}

/**
 * Checks whether an artwork document with the given artworkId already exists in Firestore.
 */
export async function checkArtworkExistsInFirestore(artworkId: string): Promise<boolean> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.ARTWORKS, artworkId);
  const snap = await getDoc(docRef);
  return snap.exists();
}
export async function saveArtworkToFirestore(artwork: Artwork): Promise<void> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.ARTWORKS, artwork.id);

  await setDoc(docRef, artwork, { merge: true });
}

/**
 * Migration-safe artwork insertion:
 * 1. Checks if document exists using getDoc().
 * 2. If it exists, DOES NOT OVERWRITE, but returns { skipped: true }.
 * 3. Only creates a new document if it does NOT exist.
 * 4. Preserves existing artwork.id, code, title, and all fields without modification.
 */
export async function migrateArtworkToFirestoreWithSkip(
  artwork: Artwork
): Promise<{ skipped: boolean; docId: string }> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.ARTWORKS, artwork.id);
  
  // 1. Check existing document first to prevent overwrite
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    // Document already exists: strictly SKIP, never overwrite
    return { skipped: true, docId: artwork.id };
  }

  // 2. Only create if document does not exist
  await setDoc(docRef, artwork);
  return { skipped: false, docId: artwork.id };
}

export async function deleteArtworkFromFirestore(artworkId: string): Promise<void> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.ARTWORKS, artworkId);
  await deleteDoc(docRef);
}

export interface MigrationCallbackData {
  index: number;
  total: number;
  artwork: Artwork;
  step: string;
  status: MigrationStepStatus;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  failedStage?: 'Storage' | 'Firestore';
  storageUrl?: string;
}

export interface MigrationFirstFailure {
  index: number;
  id: string;
  code: string;
  title: string;
  stage: 'Storage' | 'Firestore';
  errorCode: string;
  errorMessage: string;
}

export interface MigrationFailedDetail {
  index: number;
  id: string;
  code: string;
  title: string;
  stage: 'Storage' | 'Firestore';
  errorCode: string;
  errorMessage: string;
}

export interface MigrationResult {
  success: boolean;
  total: number;
  migrated: number;
  failed: number;
  artworks: Artwork[];
  errors: string[];
  failedDetails: MigrationFailedDetail[];
  firstFailure: MigrationFirstFailure | null;
}

/**
 * Safely migrates backup artworks (snake_case or camelCase) to Firebase Firestore + Firebase Storage:
 * 1. Converts snake_case backup fields to Artwork camelCase structure
 * 2. Uploads base64 image_url to Firebase Storage at 'artworks/originals/{artwork.id}'
 * 3. Saves document to Firestore 'artworks' collection with doc ID = artwork.id using setDoc(..., { merge: true })
 * 4. Preserves all artworks with zero duplicates or data loss
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(timeoutMsg);
      (err as any).code = 'TIMEOUT';
      reject(err);
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function migrateBackupArtworksToFirebase(
  rawArtworks: any[],
  onProgress?: (data: MigrationCallbackData) => void
): Promise<MigrationResult> {
  const db = getFirebaseFirestore();
  const total = rawArtworks.length;
  const migratedArtworks: Artwork[] = [];
  const errors: string[] = [];
  const failedDetails: MigrationFailedDetail[] = [];
  let firstFailure: MigrationFirstFailure | null = null;
  let migratedCount = 0;
  let failedCount = 0;

  // Pre-check Firebase Storage connection before migrating artworks
  try {
    const testResult = await testFirebaseStorageConnection();
    if (!testResult.success) {
      console.warn(
        `[Firebase Storage Pre-Check] Initial ping test note: [${testResult.errorCode}] ${testResult.errorMessage}`
      );
    }
  } catch (testErr) {
    console.warn('[Firebase Storage Pre-Check] Error running test ping:', testErr);
  }

  for (let idx = 0; idx < total; idx++) {
    const currentNum = idx + 1;
    const item = rawArtworks[idx] || {};
    const rawTitle = String(item.title || 'Untitled');
    const parsedMeta = parseArtworkString(rawTitle);

    // Strictly preserve original artwork id and code without modification
    const id = String(item.id || (item.code ? `art-${item.code}` : `artwork-${Date.now()}-${idx}`));
    const code = String(item.code || `CODE-${idx + 1}`);
    const title = parsedMeta.hasMatch ? parsedMeta.title : rawTitle;
    const canvasSizeCode = String(
      item.canvas_size_code || item.canvasSizeCode || parsedMeta.canvasSizeCode || '030P'
    );
    const widthCm = Number(item.width_cm ?? item.widthCm ?? parsedMeta.widthCm ?? 90.9);
    const heightCm = Number(item.height_cm ?? item.heightCm ?? parsedMeta.heightCm ?? 65.1);
    const material = (item.material || parsedMeta.material || 'Acrylic') as Artwork['material'];
    const materialCode = (item.material_code ||
      item.materialCode ||
      (parsedMeta.material ? materialToCode(parsedMeta.material) : 'A')) as Artwork['materialCode'];
    const year = Number(item.year || parsedMeta.year || 2026);
    const description = String(item.description || '');
    const displayOrder = Number(item.display_order ?? item.displayOrder ?? idx + 1);
    const isFeatured = Boolean(item.is_featured ?? item.isFeatured ?? false);
    let imageUrl = String(item.image_url || item.imageUrl || '');
    const createdAt = String(item.created_at || item.createdAt || new Date().toISOString());
    const updatedAt = String(item.updated_at || item.updatedAt || new Date().toISOString());

    const artworkObj: Artwork = {
      id,
      code,
      title,
      canvasSizeCode,
      widthCm,
      heightCm,
      material,
      materialCode,
      year,
      description,
      displayOrder,
      isFeatured,
      imageUrl,
      createdAt,
      updatedAt,
    };

    // Initial progress notification for this artwork
    onProgress?.({
      index: currentNum,
      total,
      artwork: artworkObj,
      step: `${currentNum}/${total} 이전 중...`,
      status: 'in_progress',
    });

    // 3. 기존 이미지가 이미 Firebase Storage URL이라면 다시 업로드하지 않는다.
    // - https://firebasestorage.googleapis.com/...
    // - https://storage.googleapis.com/...
    const isAlreadyStorage = isFirebaseStorageUrl(imageUrl);
    const isBase64 = !isAlreadyStorage && (imageUrl.startsWith('data:') || imageUrl.length > 200);

    let storageFailed = false;
    let storageErrorCode = '';
    let storageErrorMessage = '';

    // Step A: Storage Upload
    if (isBase64) {
      try {
        onProgress?.({
          index: currentNum,
          total,
          artwork: artworkObj,
          step: `${currentNum}/${total} 이전 중... (Storage 업로드)`,
          status: 'in_progress',
        });

        // 6. Storage 경로: artworks/originals/{artwork.id}
        const destinationPath = `artworks/originals/${id}`;
        // Data URL -> Blob -> uploadBytes()
        const storageUrl = await uploadBase64ToStorage(imageUrl, destinationPath);
        artworkObj.imageUrl = storageUrl;
      } catch (sErr: any) {
        storageFailed = true;
        storageErrorCode = String(
          sErr?.code || (sErr?.name && sErr.name !== 'Error' ? sErr.name : 'STORAGE_ERROR')
        );
        storageErrorMessage = String(sErr?.message || sErr || 'Storage 업로드 실패');
        if (sErr?.customData?.serverResponse) {
          storageErrorMessage += ` (Server: ${sErr.customData.serverResponse})`;
        }
      }
    }

    // 4. Firestore 저장과 Storage 업로드를 분리한다.
    // Storage 업로드가 실패하면 Firestore 저장까지 실패한 것으로 처리하되,
    // 실제 Firebase 오류 code와 message를 반드시 기록한다.
    if (storageFailed) {
      failedCount++;

      // 5. 각 작품 실패 시 콘솔에 출력:
      console.error(
        `[Firebase Migration Error]\nartwork: ${id}\ncode: ${code}\nstage: Storage\nerror.code: ${storageErrorCode}\nerror.message: ${storageErrorMessage}`
      );

      // 10. 작품번호 / 실패 단계 / Firebase error code / 오류 메시지
      const formattedError = `${code} / Storage / ${storageErrorCode} / ${storageErrorMessage}`;
      errors.push(formattedError);
      failedDetails.push({
        index: currentNum,
        id,
        code,
        title,
        stage: 'Storage',
        errorCode: storageErrorCode,
        errorMessage: storageErrorMessage,
      });

      if (!firstFailure) {
        firstFailure = {
          index: currentNum,
          id,
          code,
          title,
          stage: 'Storage',
          errorCode: storageErrorCode,
          errorMessage: storageErrorMessage,
        };
      }

      onProgress?.({
        index: currentNum,
        total,
        artwork: artworkObj,
        step: `${currentNum}/${total} 실패 (Storage) - [${storageErrorCode}] ${storageErrorMessage}`,
        status: 'failed',
        error: formattedError,
        errorCode: storageErrorCode,
        errorMessage: storageErrorMessage,
        failedStage: 'Storage',
      });

      // Storage 업로드 실패 시 Firestore 저장을 건너뛰고 다음 작품으로 계속 진행
      continue;
    }

    // Step D: Firestore 저장
    try {
      onProgress?.({
        index: currentNum,
        total,
        artwork: artworkObj,
        step: `${currentNum}/${total} 이전 중... (Firestore 저장)`,
        status: 'in_progress',
        storageUrl: artworkObj.imageUrl,
      });

      // 7. 업로드가 성공하면 다운로드 URL을 받아 Firestore artworks/{artwork.id}에 저장
      const docRef = doc(db, COLLECTIONS.ARTWORKS, id);
      await withTimeout(
        setDoc(docRef, artworkObj, { merge: true }),
        30000,
        'Firestore 저장 30초 시간 초과'
      );

      migratedArtworks.push(artworkObj);
      migratedCount++;

      onProgress?.({
        index: currentNum,
        total,
        artwork: artworkObj,
        step: `${currentNum}/${total} 완료`,
        status: 'completed',
        storageUrl: artworkObj.imageUrl,
      });
    } catch (fErr: any) {
      failedCount++;
      const firestoreErrorCode = String(
        fErr?.code || (fErr?.name && fErr.name !== 'Error' ? fErr.name : 'FIRESTORE_ERROR')
      );
      let firestoreErrorMessage = String(fErr?.message || fErr || 'Firestore 저장 실패');
      if (fErr?.customData?.serverResponse) {
        firestoreErrorMessage += ` (Server: ${fErr.customData.serverResponse})`;
      }

      // 5. 각 작품 실패 시 콘솔에 출력:
      console.error(
        `[Firebase Migration Error]\nartwork: ${id}\ncode: ${code}\nstage: Firestore\nerror.code: ${firestoreErrorCode}\nerror.message: ${firestoreErrorMessage}`
      );

      // 10. 작품번호 / 실패 단계 / Firebase error code / 오류 메시지
      const formattedError = `${code} / Firestore / ${firestoreErrorCode} / ${firestoreErrorMessage}`;
      errors.push(formattedError);
      failedDetails.push({
        index: currentNum,
        id,
        code,
        title,
        stage: 'Firestore',
        errorCode: firestoreErrorCode,
        errorMessage: firestoreErrorMessage,
      });

      if (!firstFailure) {
        firstFailure = {
          index: currentNum,
          id,
          code,
          title,
          stage: 'Firestore',
          errorCode: firestoreErrorCode,
          errorMessage: firestoreErrorMessage,
        };
      }

      onProgress?.({
        index: currentNum,
        total,
        artwork: artworkObj,
        step: `${currentNum}/${total} 실패 (Firestore) - [${firestoreErrorCode}] ${firestoreErrorMessage}`,
        status: 'failed',
        error: formattedError,
        errorCode: firestoreErrorCode,
        errorMessage: firestoreErrorMessage,
        failedStage: 'Firestore',
      });
    }
  }

  return {
    success: failedCount === 0,
    total,
    migrated: migratedCount,
    failed: failedCount,
    artworks: migratedArtworks,
    errors,
    failedDetails,
    firstFailure,
  };
}

/* =========================================================
   2. Exhibitions (전시 이력)
   ========================================================= */

export async function fetchExhibitionsFromFirestore(): Promise<Exhibition[]> {
  const db = getFirebaseFirestore();
  const q = query(collection(db, COLLECTIONS.EXHIBITIONS), orderBy('displayOrder', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Exhibition);
}

export async function setExhibitionInFirestore(exhibition: Exhibition): Promise<void> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.EXHIBITIONS, exhibition.id);
  await setDoc(docRef, exhibition, { merge: true });
}

/* =========================================================
   3. Awards (수상 이력)
   ========================================================= */

export async function fetchAwardsFromFirestore(): Promise<Award[]> {
  const db = getFirebaseFirestore();
  const q = query(collection(db, COLLECTIONS.AWARDS), orderBy('displayOrder', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Award);
}

export async function setAwardInFirestore(award: Award): Promise<void> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.AWARDS, award.id);
  await setDoc(docRef, award, { merge: true });
}

/* =========================================================
   4. CV (작가 이력)
   ========================================================= */

export async function fetchCVFromFirestore(): Promise<CVSection[]> {
  const db = getFirebaseFirestore();
  const snap = await getDocs(collection(db, COLLECTIONS.CV));
  return snap.docs.map((d) => d.data() as CVSection);
}

export const getCVSectionsFromFirestore = fetchCVFromFirestore;

export async function setCVSectionInFirestore(section: CVSection): Promise<void> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.CV, section.id);
  await setDoc(docRef, section, { merge: true });
}

export const saveCVSectionToFirestore = setCVSectionInFirestore;

export async function deleteCVSectionFromFirestore(sectionId: string): Promise<void> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.CV, sectionId);
  await deleteDoc(docRef);
}

/* =========================================================
   5. Artist Notes (작가노트 및 비평)
   ========================================================= */

export async function fetchArtistNotesFromFirestore(): Promise<ArtistNoteItem[]> {
  const db = getFirebaseFirestore();
  const snap = await getDocs(collection(db, COLLECTIONS.ARTIST_NOTES));
  const list = snap.docs.map((d) => d.data() as ArtistNoteItem);
  return list.sort((a, b) => a.key.localeCompare(b.key));
}

export const getArtistNotesFromFirestore = fetchArtistNotesFromFirestore;

export async function setArtistNoteInFirestore(note: ArtistNoteItem): Promise<void> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.ARTIST_NOTES, note.id);
  await setDoc(docRef, note, { merge: true });
}

export const saveArtistNoteToFirestore = setArtistNoteInFirestore;

/* =========================================================
   6. Site Settings (웹사이트 전역 설정)
   ========================================================= */

export async function fetchSiteSettingsFromFirestore(): Promise<SiteSettings | null> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.SITE_SETTINGS, 'general');
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as SiteSettings) : null;
}

export const getSiteSettingsFromFirestore = fetchSiteSettingsFromFirestore;

export async function setSiteSettingsInFirestore(settings: SiteSettings): Promise<void> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.SITE_SETTINGS, 'general');
  await setDoc(docRef, settings, { merge: true });
}

export const saveSiteSettingsToFirestore = setSiteSettingsInFirestore;

/* =========================================================
   7. Submissions (공모전 / 갤러리 제출 관리 - 관리자 전용)
   ========================================================= */

export async function fetchSubmissionsFromFirestore(): Promise<SubmissionPackage[]> {
  const db = getFirebaseFirestore();
  const q = query(collection(db, COLLECTIONS.SUBMISSIONS), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SubmissionPackage);
}

export const getSubmissionsFromFirestore = fetchSubmissionsFromFirestore;

export async function setSubmissionInFirestore(pkg: SubmissionPackage): Promise<void> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.SUBMISSIONS, pkg.id);
  await setDoc(docRef, pkg, { merge: true });
}

export const saveSubmissionToFirestore = setSubmissionInFirestore;

export async function deleteSubmissionFromFirestore(submissionId: string): Promise<void> {
  const db = getFirebaseFirestore();
  const docRef = doc(db, COLLECTIONS.SUBMISSIONS, submissionId);
  await deleteDoc(docRef);
}

/* =========================================================
   8. Firestore Connection Test (단일 테스트 문서 저장 검증)
   ========================================================= */

export interface FirestoreConnectionTestResult {
  success: boolean;
  message: string;
  errorCode?: string;
  errorMessage?: string;
  docPath: string;
  timestamp: string | number;
  data?: Record<string, any>;
}

/**
 * Executes a minimal Firestore connection test:
 * - Target document: migration-test/firestore-connection-test
 * - Payload: { test: true, timestamp: Date.now() }
 * - Direct setDoc() call without custom timeout wrappers or polling
 * - Returns success / error with actual Firebase error.code & error.message
 */
export async function testSmallFirestoreConnection(): Promise<FirestoreConnectionTestResult> {
  const docPath = 'migration-test/firestore-connection-test';
  const timestamp = Date.now();
  const payload = {
    test: true,
    timestamp,
  };

  try {
    const docRef = doc(db, 'migration-test', 'firestore-connection-test');
    await setDoc(docRef, payload);

    return {
      success: true,
      message: 'Firestore 연결 성공',
      docPath,
      timestamp,
      data: payload,
    };
  } catch (err: any) {
    console.error('[Firestore Connection Test] Failed:', err);
    const errorCode = String(
      err?.code || (err?.name && err.name !== 'Error' ? err.name : 'FIRESTORE_ERROR')
    );
    let errorMessage = String(err?.message || err || 'Firestore 저장 실패');
    if (err?.customData?.serverResponse) {
      errorMessage += ` (Server: ${err.customData.serverResponse})`;
    }

    return {
      success: false,
      message: 'Firestore 연결 실패',
      errorCode,
      errorMessage,
      docPath,
      timestamp,
    };
  }
}

