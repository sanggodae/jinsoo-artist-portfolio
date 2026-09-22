import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseStorage, STORAGE_PATHS } from './firebase';

export { STORAGE_PATHS };

/**
 * Checks whether an image URL is already hosted on Firebase / Google Cloud Storage.
 */
export function isFirebaseStorageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return (
    url.startsWith('https://firebasestorage.googleapis.com/') ||
    url.startsWith('http://firebasestorage.googleapis.com/') ||
    url.startsWith('https://storage.googleapis.com/') ||
    url.startsWith('http://storage.googleapis.com/')
  );
}

/**
 * Converts a Base64 or Data URL string into a native browser Blob without string duplication overhead.
 */
export function dataUrlToBlob(base64OrDataUrl: string): Blob {
  let mimeType = 'image/jpeg';
  let base64Content = base64OrDataUrl;

  if (base64OrDataUrl.startsWith('data:')) {
    const commaIndex = base64OrDataUrl.indexOf(',');
    if (commaIndex !== -1) {
      const header = base64OrDataUrl.substring(0, commaIndex);
      base64Content = base64OrDataUrl.substring(commaIndex + 1);
      const mimeMatch = header.match(/data:([^;]+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    }
  }

  // Remove any whitespace or newline characters from base64
  let cleanBase64 = base64Content.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (cleanBase64.length % 4 !== 0) {
    cleanBase64 += '=';
  }

  try {
    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch (decodeErr: any) {
    throw new Error(`이미지 Base64 디코딩 실패: ${decodeErr?.message || decodeErr}`);
  }
}

/**
 * Result structure for the Firebase Storage connection test.
 */
export interface StorageConnectionTestResult {
  success: boolean;
  downloadUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  cleanedUp?: boolean;
}

/**
 * Runs an isolated single-file Firebase Storage connectivity test:
 * 1. Target bucket: gs://gen-lang-client-0635539736-artworks-seoul
 * 2. Test file: Small text blob
 * 3. Path: migration-test/storage-connection-test.txt
 * 4. Verifies upload and download URL acquisition
 * 5. Accurately logs error.code and error.message on failure
 * 6. Deletes the temporary test file after confirmation (clean-up)
 * 7. Does not touch any existing artwork data in IndexedDB, localStorage, or Firestore
 */
export async function runStorageConnectionTest(): Promise<StorageConnectionTestResult> {
  const TEST_PATH = 'migration-test/storage-connection-test.txt';
  const testContent = `Firebase Storage connection test - timestamp: ${new Date().toISOString()}`;
  const testBlob = new Blob([testContent], { type: 'text/plain;charset=utf-8' });

  // 15-second timeout guard to prevent infinite hanging while keeping real errors
  const createTimeout = (ms: number, opName: string) => {
    let timerId: any;
    const promise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        const timeoutErr: any = new Error(`Firebase Storage ${opName} 작업이 ${ms / 1000}초 동안 응답하지 않아 시간 초과되었습니다.`);
        timeoutErr.code = 'storage/timeout';
        reject(timeoutErr);
      }, ms);
    });
    return {
      promise,
      cancel: () => clearTimeout(timerId),
    };
  };

  try {
    const storage = getFirebaseStorage();
    const testRef = ref(storage, TEST_PATH);

    // Step 1: Upload test file with 15s timeout
    const uploadTimeout = createTimeout(15000, 'uploadBytes');
    try {
      await Promise.race([
        uploadBytes(testRef, testBlob, {
          contentType: 'text/plain;charset=utf-8',
        }),
        uploadTimeout.promise,
      ]);
    } finally {
      uploadTimeout.cancel();
    }
    console.log('[Firebase Storage Test] Firebase Storage 업로드 성공');

    // Step 2: Acquire download URL with 10s timeout
    const urlTimeout = createTimeout(10000, 'getDownloadURL');
    let downloadUrl = '';
    try {
      downloadUrl = await Promise.race([
        getDownloadURL(testRef),
        urlTimeout.promise,
      ]);
    } finally {
      urlTimeout.cancel();
    }
    console.log('[Firebase Storage Test] 다운로드 URL 확보 성공:', downloadUrl);

    // Step 3: Cleanup temporary test file
    let cleanedUp = false;
    try {
      await deleteObject(testRef);
      cleanedUp = true;
      console.log('[Firebase Storage Test] 테스트 임시 파일 정상 삭제 완료 (cleanup)');
    } catch (cleanErr) {
      console.warn('[Firebase Storage Test] 테스트 임시 파일 삭제 건너뜀 또는 실패:', cleanErr);
    }

    return {
      success: true,
      downloadUrl,
      cleanedUp,
    };
  } catch (err: any) {
    const errorCode = String(
      err?.code || (err?.name && err.name !== 'Error' ? err.name : 'STORAGE_TEST_ERROR')
    );
    let errorMessage = String(err?.message || err || 'Firebase Storage connection test failed');
    if (err?.customData?.serverResponse) {
      errorMessage += ` (Server: ${err.customData.serverResponse})`;
    }

    // 5. 실패 시 Firebase error.code와 Firebase error.message를 console.error로 정확히 표시
    console.error('[Firebase Storage Test Failed]');
    console.error('Firebase error.code:', errorCode);
    console.error('Firebase error.message:', errorMessage);
    console.error('Raw Error:', err);

    return {
      success: false,
      errorCode,
      errorMessage,
    };
  }
}

// Expose on window for easy developer execution in DevTools console
if (typeof window !== 'undefined') {
  (window as any).__testFirebaseStorage = runStorageConnectionTest;
}

/**
 * Tests Firebase Storage connectivity using runStorageConnectionTest.
 */
export async function testFirebaseStorageConnection(): Promise<{
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}> {
  const res = await runStorageConnectionTest();
  return {
    success: res.success,
    errorCode: res.errorCode,
    errorMessage: res.errorMessage,
  };
}

/**
 * Uploads a Base64 data URL string to Firebase Storage using Data URL -> Blob -> uploadBytes()
 * and returns its persistent public download URL.
 */
export async function uploadBase64ToStorage(
  base64DataUrl: string,
  destinationPath: string
): Promise<string> {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, destinationPath);

  // Convert Base64 / Data URL to binary Blob
  const blob = dataUrlToBlob(base64DataUrl);

  // Directly upload binary Blob to Firebase Storage
  await uploadBytes(storageRef, blob, {
    contentType: blob.type || 'image/jpeg',
  });

  return await getDownloadURL(storageRef);
}

/**
 * Uploads a browser File or Blob object to Firebase Storage and returns its download URL.
 */
export async function uploadBlobToStorage(
  blob: Blob,
  destinationPath: string,
  contentType = 'image/jpeg'
): Promise<string> {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, destinationPath);
  await uploadBytes(storageRef, blob, { contentType });
  return await getDownloadURL(storageRef);
}

/**
 * Generates standardized storage paths for an artwork.
 */
export function getArtworkStoragePaths(artworkCode: string, artworkId: string) {
  const safeCode = (artworkCode || 'artwork').replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    originalPath: `${STORAGE_PATHS.ARTWORKS_ORIGINALS}/${safeCode}_${artworkId}.jpg`,
    webPath: `${STORAGE_PATHS.ARTWORKS_WEB}/${safeCode}_${artworkId}_2048.jpg`,
  };
}

/**
 * Uploads an artist profile photo to Firebase Storage at 'artist/profile/...'
 * completely separated from artwork original assets.
 */
export async function uploadArtistProfilePhoto(
  fileOrBlob: Blob | File,
  customFileName?: string
): Promise<string> {
  const storage = getFirebaseStorage();
  const timestamp = Date.now();
  let ext = 'jpg';
  if (fileOrBlob instanceof File && fileOrBlob.name) {
    const parts = fileOrBlob.name.split('.');
    if (parts.length > 1) {
      ext = parts.pop()?.toLowerCase() || 'jpg';
    }
  }
  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const fileName = customFileName || `profile_${timestamp}.${cleanExt}`;
  const destinationPath = `artist/profile/${fileName}`;
  const storageRef = ref(storage, destinationPath);

  const contentType = fileOrBlob.type || (cleanExt === 'png' ? 'image/png' : 'image/jpeg');

  await uploadBytes(storageRef, fileOrBlob, { contentType });
  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}

/**
 * Deletes a file from Firebase Storage.
 */
export async function deleteStorageFile(storagePathOrUrl: string): Promise<void> {
  try {
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, storagePathOrUrl);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('Storage file deletion skipped or failed:', err);
  }
}

/**
 * Uploads a Board post photo to Firebase Storage at 'board/{postId}/images/...'
 * completely separate from existing artworks and artist profile images.
 */
export async function uploadBoardImage(
  postId: string,
  fileOrBlob: Blob | File,
  customFileName?: string
): Promise<string> {
  const timestamp = Date.now();
  let ext = 'jpg';
  if (fileOrBlob instanceof File && fileOrBlob.name) {
    const parts = fileOrBlob.name.split('.');
    if (parts.length > 1) {
      ext = parts.pop()?.toLowerCase() || 'jpg';
    }
  }
  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const fileName = customFileName || `img_${timestamp}_${Math.random().toString(36).substring(2, 7)}.${cleanExt}`;
  const destinationPath = `board/${postId}/images/${fileName}`;

  try {
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, destinationPath);
    const contentType = fileOrBlob.type || (cleanExt === 'png' ? 'image/png' : 'image/jpeg');

    await uploadBytes(storageRef, fileOrBlob, { contentType });
    return await getDownloadURL(storageRef);
  } catch (storageErr: any) {
    console.warn(`[Firebase Storage] Board image upload to ${destinationPath} failed, attempting local fallback:`, storageErr);
    // Graceful fallback: convert to base64 Data URL if storage fails in preview sandbox
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
    });
  }
}

/**
 * Uploads a Board post video to Firebase Storage at 'board/{postId}/videos/...'
 * completely separate from existing artworks and assets.
 */
export async function uploadBoardVideo(
  postId: string,
  fileOrBlob: Blob | File,
  customFileName?: string
): Promise<string> {
  const timestamp = Date.now();
  let ext = 'mp4';
  if (fileOrBlob instanceof File && fileOrBlob.name) {
    const parts = fileOrBlob.name.split('.');
    if (parts.length > 1) {
      ext = parts.pop()?.toLowerCase() || 'mp4';
    }
  }
  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
  const fileName = customFileName || `video_${timestamp}_${Math.random().toString(36).substring(2, 7)}.${cleanExt}`;
  const destinationPath = `board/${postId}/videos/${fileName}`;

  try {
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, destinationPath);
    const contentType = fileOrBlob.type || 'video/mp4';

    await uploadBytes(storageRef, fileOrBlob, { contentType });
    return await getDownloadURL(storageRef);
  } catch (storageErr: any) {
    console.warn(`[Firebase Storage] Board video upload to ${destinationPath} failed, attempting local fallback:`, storageErr);
    return URL.createObjectURL(fileOrBlob);
  }
}

