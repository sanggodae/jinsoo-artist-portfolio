/**
 * Debug utility to inspect records in browser's IndexedDB without any modification.
 * Strictly readonly access.
 */
import { Artwork } from '../types';

export const DB_NAME = 'ARTWORK_MANAGEMENT_INDEXED_DB';
export const STORE_NAME = 'artworks_store';
export const RECORD_KEY = 'artworks_list';

export interface ArtworkBrief {
  id: string;
  code: string;
  title: string;
  year?: number;
  material?: string;
  canvasSizeCode?: string;
}

/**
 * Opens 'ARTWORK_MANAGEMENT_INDEXED_DB', inspects the 'artworks_store' object store,
 * reads the first 5 records, and logs their id, code, and title to the console.
 *
 * Supports both:
 * 1. Single-key array record under 'artworks_list' (current app architecture)
 * 2. Individual records stored directly with keyPath or individual keys in 'artworks_store' (cursor iteration)
 */
export async function logFirstFiveArtworks(): Promise<ArtworkBrief[]> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    console.warn('[debugIndexedDB] IndexedDB is not available in this environment.');
    return [];
  }

  console.log(`%c[debugIndexedDB] Opening database '${DB_NAME}'...`, 'color: #0284c7; font-weight: bold;');

  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open database'));
    });

    if (!db.objectStoreNames.contains(STORE_NAME)) {
      console.warn(`[debugIndexedDB] Object store '${STORE_NAME}' does not exist in '${DB_NAME}'.`);
      db.close();
      return [];
    }

    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    // 1. Try reading the 'artworks_list' key (where the array of Artwork[] is stored)
    const arrayResult = await new Promise<any>((resolve) => {
      const req = store.get(RECORD_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    let artworks: Artwork[] = [];

    if (Array.isArray(arrayResult) && arrayResult.length > 0) {
      artworks = arrayResult;
    } else {
      // 2. Fallback: Iterate store using cursor in case records are stored individually
      const cursorRecords = await new Promise<any[]>((resolve) => {
        const records: any[] = [];
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor && records.length < 5) {
            records.push(cursor.value);
            cursor.continue();
          } else {
            resolve(records);
          }
        };
        cursorReq.onerror = () => resolve([]);
      });

      if (cursorRecords.length > 0) {
        if (Array.isArray(cursorRecords[0])) {
          artworks = cursorRecords[0];
        } else {
          artworks = cursorRecords;
        }
      }
    }

    db.close();

    if (!artworks || artworks.length === 0) {
      console.warn(`%c[debugIndexedDB] No artworks found in '${DB_NAME}' -> '${STORE_NAME}'.`, 'color: #ea580c; font-weight: bold;');
      return [];
    }

    const totalCount = artworks.length;
    const firstFive = artworks.slice(0, 5);

    const formatted: ArtworkBrief[] = firstFive.map((art) => ({
      id: art.id || '(no-id)',
      code: art.code || '(no-code)',
      title: art.title || '(no-title)',
      year: art.year,
      material: art.material,
      canvasSizeCode: art.canvasSizeCode,
    }));

    console.log(
      `%c[debugIndexedDB] Found total ${totalCount} records in '${STORE_NAME}'. Logging first 5 records:`,
      'color: #059669; font-weight: bold; font-size: 13px;'
    );

    console.table(
      formatted.map((item, idx) => ({
        '#': idx + 1,
        'ID (id)': item.id,
        '작품번호 (code)': item.code,
        '작품 제목 (title)': item.title,
        '규격': item.canvasSizeCode || '-',
        '재료': item.material || '-',
        '연도': item.year || '-',
      }))
    );

    formatted.forEach((item, idx) => {
      console.log(
        `%cRecord #${idx + 1}:%c ID="${item.id}", Code="${item.code}", Title="${item.title}"`,
        'font-weight: bold; color: #1e40af;',
        'font-weight: normal; color: #111827;'
      );
    });

    return formatted;
  } catch (err: any) {
    console.error('[debugIndexedDB] Error accessing IndexedDB:', err);
    return [];
  }
}

// Attach to window object for convenient invocation in the browser console
if (typeof window !== 'undefined') {
  (window as any).logFirstFiveArtworks = logFirstFiveArtworks;
}
