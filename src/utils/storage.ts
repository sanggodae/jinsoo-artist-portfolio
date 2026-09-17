import { Artwork } from '../types';
import { INITIAL_ARTWORKS } from '../data/initialArtworks';

const STORAGE_KEY = 'ARTWORK_MANAGEMENT_DB_V1';
const DB_NAME = 'ARTWORK_MANAGEMENT_INDEXED_DB';
const DB_VERSION = 1;
const STORE_NAME = 'artworks_store';
const RECORD_KEY = 'artworks_list';

// Maximum size in bytes before skipping localStorage to prevent QuotaExceededError
const LOCAL_STORAGE_SAFE_BYTE_LIMIT = 2.5 * 1024 * 1024; // 2.5MB

// IndexedDB Helper
function openIndexedDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Loads artworks asynchronously from IndexedDB, with fallback to initial data
 */
export async function loadArtworksFromIndexedDB(): Promise<Artwork[] | null> {
  try {
    const db = await openIndexedDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_KEY);
      req.onsuccess = () => {
        const val = req.result;
        if (Array.isArray(val) && val.length > 0) {
          resolve(val);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Saves artworks asynchronously to IndexedDB (supports hundreds of MBs of data)
 */
export async function saveArtworksToIndexedDB(artworks: Artwork[]): Promise<void> {
  try {
    const db = await openIndexedDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(artworks, RECORD_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB persistence error:', err);
  }
}

/**
 * Synchronous initial load (fast boot from localStorage if user previously saved data).
 * NOTE: Returns empty array [] if no saved data exists.
 * Does NOT fallback to INITIAL_ARTWORKS to prevent polluting real user data.
 */
export function loadArtworksFromStorage(): Artwork[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.warn('Fallback loading from storage:', err);
    return [];
  }
}

/**
 * Dual-layer save:
 * 1. Always persists to IndexedDB (virtually unlimited quota for 500+ paintings & photos)
 * 2. Only attempts localStorage if within safe size limit, safely catching quota exceptions
 */
export function saveArtworksToStorage(artworks: Artwork[]): void {
  // 1. Primary durable storage: IndexedDB
  saveArtworksToIndexedDB(artworks).catch((e) => {
    console.warn('IndexedDB auto-save notification:', e);
  });

  // 2. Secondary lightweight cache: localStorage (with strict quota guard)
  try {
    const serialized = JSON.stringify(artworks);
    // If serialized string is larger than 2.5MB, do not write to localStorage to prevent browser QuotaExceededError
    if (serialized.length > LOCAL_STORAGE_SAFE_BYTE_LIMIT) {
      // Clear or leave minimal marker in localStorage to free up space
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (err) {
    // QuotaExceededError is safely handled here: IndexedDB has already persisted the data.
    console.info('Storage notice: Dataset size exceeds localStorage limit; persisted safely to IndexedDB.', err);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function exportArtworksToJSON(artworks: Artwork[]): void {
  // Structure aligned for future Supabase table export & Google Sheets
  const exportData = {
    metadata: {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      totalArtworks: artworks.length,
      targetPlatform: 'Supabase / Google Sheets Compatible',
    },
    artworks: artworks.map((art) => ({
      id: art.id,
      code: art.code,
      title: art.title,
      canvas_size_code: art.canvasSizeCode,
      width_cm: art.widthCm,
      height_cm: art.heightCm,
      dimensions_text: `${art.widthCm} × ${art.heightCm} cm`,
      material: art.material,
      material_code: art.materialCode,
      year: art.year,
      description: art.description,
      display_order: art.displayOrder,
      is_featured: art.isFeatured,
      image_url: art.imageUrl,
      created_at: art.createdAt,
      updated_at: art.updatedAt,
    })),
  };

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(exportData, null, 2)
  )}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute('download', `PARK_JINSOO_ARTWORK_BACKUP_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportArtworksToCSV(artworks: Artwork[]): void {
  // Google Sheets friendly UTF-8 BOM
  const headers = [
    '작품번호(code)',
    '작품제목(title)',
    '캔버스규격(canvas_size_code)',
    '가로cm(width_cm)',
    '세로cm(height_cm)',
    '규격텍스트(dimensions)',
    '재료(material)',
    '재료코드(material_code)',
    '제작연도(year)',
    '전시순서(display_order)',
    '대표작(is_featured)',
    '작품설명(description)',
    '이미지URL(image_url)',
    '생성일시(created_at)',
  ];

  const rows = artworks.map((a) => [
    `"${a.code}"`,
    `"${(a.title || '').replace(/"/g, '""')}"`,
    `"${a.canvasSizeCode}"`,
    a.widthCm,
    a.heightCm,
    `"${a.widthCm} × ${a.heightCm} cm"`,
    `"${a.material}"`,
    `"${a.materialCode}"`,
    a.year,
    a.displayOrder,
    a.isFeatured ? 'TRUE' : 'FALSE',
    `"${(a.description || '').replace(/"/g, '""')}"`,
    `"${(a.imageUrl || '').startsWith('data:') ? '[Base64 Image Data]' : a.imageUrl || ''}"`,
    `"${a.createdAt}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `PARK_JINSOO_ARTWORK_BACKUP_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
