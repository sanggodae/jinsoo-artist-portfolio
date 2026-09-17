import { Artwork, MaterialType } from '../types';
import { CANVAS_SIZES } from '../data/canvasSizes';
import { parseArtworkString } from './artworkParser';
import { generateNextArtworkCode, materialToCode } from './codeGenerator';

/**
 * Splits CSV string into 2D array of cells, properly respecting quoted fields and commas inside quotes.
 */
export function parseCSVToRows(csvText: string): string[][] {
  const cleanText = csvText.replace(/^\uFEFF/, ''); // Strip UTF-8 BOM if present
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentCell += '"';
          i++;
        } else {
          // End of quoted field
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r') {
        // Ignore carriage return
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  // Last cell and row if not empty
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows.filter((r) => r.length > 0 && r.some((cell) => cell.length > 0));
}

/**
 * Normalizes header string to find matching column index.
 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

/**
 * Parses parsed CSV rows into typed Artwork array.
 */
export function parseArtworkCSV(csvText: string, existingArtworks: Artwork[] = []): {
  artworks: Artwork[];
  errors: string[];
} {
  const rows = parseCSVToRows(csvText);
  if (rows.length === 0) {
    return { artworks: [], errors: ['CSV 파일에 데이터가 없습니다.'] };
  }

  const headerRow = rows[0];
  const colMap: Record<string, number> = {};

  headerRow.forEach((col, idx) => {
    const norm = normalizeHeader(col);
    if (norm.includes('code') || norm.includes('작품번호')) colMap.code = idx;
    else if (norm.includes('title') || norm.includes('작품제목') || norm.includes('작품명') || norm.includes('제목')) colMap.title = idx;
    else if (norm.includes('canvassize') || norm.includes('캔버스규격') || norm.includes('호수') || norm.includes('규격')) colMap.canvasSizeCode = idx;
    else if (norm.includes('width') || norm.includes('가로')) colMap.widthCm = idx;
    else if (norm.includes('height') || norm.includes('세로')) colMap.heightCm = idx;
    else if (norm.includes('materialcode') || norm.includes('재료코드')) colMap.materialCode = idx;
    else if (norm.includes('material') || norm.includes('재료')) colMap.material = idx;
    else if (norm.includes('year') || norm.includes('연도') || norm.includes('년도')) colMap.year = idx;
    else if (norm.includes('displayorder') || norm.includes('전시순서') || norm.includes('순서')) colMap.displayOrder = idx;
    else if (norm.includes('isfeatured') || norm.includes('대표작') || norm.includes('대표')) colMap.isFeatured = idx;
    else if (norm.includes('desc') || norm.includes('작품설명') || norm.includes('설명')) colMap.description = idx;
    else if (norm.includes('image') || norm.includes('이미지') || norm.includes('사진')) colMap.imageUrl = idx;
  });

  const parsedArtworks: Artwork[] = [];
  const errors: string[] = [];
  const workingArtworks = [...existingArtworks];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every((c) => !c)) continue;

    const getVal = (colKey: string, fallback = ''): string => {
      const idx = colMap[colKey];
      return idx !== undefined && idx < row.length ? row[idx] : fallback;
    };

    const rawTitle = getVal('title') || getVal('code') || `무제 작품 #${i}`;
    const parsedTitleMeta = parseArtworkString(rawTitle);

    const title = parsedTitleMeta.hasMatch ? parsedTitleMeta.title : rawTitle;
    const year = Number(getVal('year')) || parsedTitleMeta.year || new Date().getFullYear();

    let canvasCode = getVal('canvasSizeCode') || parsedTitleMeta.canvasSizeCode || '030P';
    // Normalize canvas code format (e.g., '30P' -> '030P')
    if (/^\d{1,2}[FPMSR]$/i.test(canvasCode)) {
      const match = canvasCode.match(/^(\d+)([FPMSR])$/i);
      if (match) {
        canvasCode = `${match[1].padStart(3, '0')}${match[2].toUpperCase()}`;
      }
    }

    const matchedSize = CANVAS_SIZES.find((s) => s.code === canvasCode);
    const widthCm = Number(getVal('widthCm')) || parsedTitleMeta.widthCm || (matchedSize ? matchedSize.widthCm : 90.9);
    const heightCm = Number(getVal('heightCm')) || parsedTitleMeta.heightCm || (matchedSize ? matchedSize.heightCm : 65.1);

    const rawMat = getVal('material') || parsedTitleMeta.material || 'Acrylic';
    const mat: MaterialType = rawMat.toLowerCase().includes('oil') || rawMat.includes('유채')
      ? 'Oil'
      : rawMat.toLowerCase().includes('mix') || rawMat.includes('혼합')
      ? 'Mixed'
      : 'Acrylic';

    let code = getVal('code');
    if (!code || workingArtworks.some((a) => a.code === code)) {
      code = generateNextArtworkCode(year, canvasCode, mat, workingArtworks);
    }

    const displayOrder = Number(getVal('displayOrder')) || parsedArtworks.length + 1;
    const isFeaturedRaw = getVal('isFeatured').toLowerCase();
    const isFeatured = isFeaturedRaw === 'true' || isFeaturedRaw === '1' || isFeaturedRaw === 'yes' || isFeaturedRaw === 'y';
    const description = getVal('description') || '';
    
    let imageUrl = getVal('imageUrl') || '';
    if (imageUrl === '[Base64 Image Data]') {
      imageUrl = ''; // Placeholder in text-only CSV exports
    }

    const newArtwork: Artwork = {
      id: `csv-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      code,
      title,
      canvasSizeCode: canvasCode,
      widthCm,
      heightCm,
      material: mat,
      materialCode: materialToCode(mat),
      year,
      description,
      displayOrder,
      isFeatured,
      imageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    parsedArtworks.push(newArtwork);
    workingArtworks.push(newArtwork);
  }

  return { artworks: parsedArtworks, errors };
}
