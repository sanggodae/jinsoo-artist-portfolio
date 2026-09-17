import { CANVAS_SIZES } from '../data/canvasSizes';
import { MaterialType } from '../types';

export interface ParsedArtworkInfo {
  hasMatch: boolean;
  title: string;
  year?: number;
  canvasSizeCode?: string;
  widthCm?: number;
  heightCm?: number;
  material?: MaterialType;
  rawMatched: {
    title?: string;
    year?: string;
    size?: string;
    material?: string;
  };
}

/**
 * Parses strings formatted like:
 * "제목, 년도, 크기, 재료"
 * e.g., "침묵의 결, 2025, 30P, Acrylic"
 * or "무제, 2024, 50호, 유화"
 * or filename "바람의 흔적, 2026, 100F, Oil.jpg"
 */
export function parseArtworkString(rawInput: string): ParsedArtworkInfo {
  if (!rawInput || typeof rawInput !== 'string') {
    return { hasMatch: false, title: rawInput || '', rawMatched: {} };
  }

  // Remove file extension if present (e.g. .jpg, .png, .webp, .jpeg)
  let cleaned = rawInput.replace(/\.(jpe?g|png|webp|gif|bmp|tiff|heic)$/i, '').trim();

  // If no comma or separator, check if there's an underscore or dash separated string
  // Primary separator is comma (standard or full-width)
  let tokens: string[] = [];
  if (cleaned.includes(',') || cleaned.includes('，')) {
    tokens = cleaned.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  } else if (cleaned.includes('_')) {
    tokens = cleaned.split('_').map((s) => s.trim()).filter(Boolean);
  }

  if (tokens.length < 2) {
    return { hasMatch: false, title: cleaned, rawMatched: {} };
  }

  let extractedYear: number | undefined;
  let extractedCanvasCode: string | undefined;
  let extractedWidth: number | undefined;
  let extractedHeight: number | undefined;
  let extractedMaterial: MaterialType | undefined;
  let rawYear: string | undefined;
  let rawSize: string | undefined;
  let rawMaterial: string | undefined;

  const usedIndices = new Set<number>();

  // 1. Identify Year (e.g. 2024, 2025, 2026, 1998, '24, '25)
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    const yearMatch = token.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      extractedYear = parseInt(yearMatch[1], 10);
      rawYear = token;
      usedIndices.add(i);
      break;
    }
  }

  // 2. Identify Material (Acrylic, Oil, Mixed, 아크릴, 유화, 유채, 혼합)
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (usedIndices.has(i)) continue;
    const token = tokens[i].toLowerCase();

    if (token.includes('acrylic') || token.includes('아크릴') || token === 'a') {
      extractedMaterial = 'Acrylic';
      rawMaterial = tokens[i];
      usedIndices.add(i);
      break;
    } else if (
      token.includes('oil') ||
      token.includes('유화') ||
      token.includes('유채') ||
      token === 'o'
    ) {
      extractedMaterial = 'Oil';
      rawMaterial = tokens[i];
      usedIndices.add(i);
      break;
    } else if (
      token.includes('mixed') ||
      token.includes('혼합') ||
      token.includes('믹스') ||
      token === 'm'
    ) {
      extractedMaterial = 'Mixed';
      rawMaterial = tokens[i];
      usedIndices.add(i);
      break;
    }
  }

  // 3. Identify Size (e.g. 30P, 50F, 100호, 030P, 90.9x65.1cm, etc.)
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (usedIndices.has(i)) continue;
    const token = tokens[i];

    // Case A: Standard code like 30P, 030P, 50F, 10S, 20M, 30호P, 50호 F
    const codeMatch = token.match(/(\d{1,3})\s*(?:호)?\s*([FPMSfpms])/i);
    if (codeMatch) {
      const num = parseInt(codeMatch[1], 10);
      const type = codeMatch[2].toUpperCase();
      const paddedCode = `${String(num).padStart(3, '0')}${type}`;
      const found = CANVAS_SIZES.find((c) => c.code === paddedCode);
      if (found) {
        extractedCanvasCode = found.code;
        extractedWidth = found.widthCm;
        extractedHeight = found.heightCm;
        rawSize = token;
        usedIndices.add(i);
        break;
      }
    }

    // Case B: Number with "호" like "30호", "50호" (default to F - Figure)
    const hoMatch = token.match(/(\d{1,3})\s*호/);
    if (hoMatch) {
      const num = parseInt(hoMatch[1], 10);
      const paddedCode = `${String(num).padStart(3, '0')}F`;
      const found = CANVAS_SIZES.find((c) => c.code === paddedCode);
      if (found) {
        extractedCanvasCode = found.code;
        extractedWidth = found.widthCm;
        extractedHeight = found.heightCm;
        rawSize = token;
        usedIndices.add(i);
        break;
      }
    }

    // Case C: Direct dimensions like "90.9x65.1" or "90.9 × 65.1 cm"
    const dimMatch = token.match(/(\d+(?:\.\d+)?)\s*(?:[xX*×])\s*(\d+(?:\.\d+)?)/);
    if (dimMatch) {
      const w = parseFloat(dimMatch[1]);
      const h = parseFloat(dimMatch[2]);
      if (w > 0 && h > 0) {
        extractedWidth = w;
        extractedHeight = h;
        rawSize = token;
        // Check if matches a standard size
        const matchedStandard = CANVAS_SIZES.find(
          (c) =>
            (Math.abs(c.widthCm - w) < 0.5 && Math.abs(c.heightCm - h) < 0.5) ||
            (Math.abs(c.widthCm - h) < 0.5 && Math.abs(c.heightCm - w) < 0.5)
        );
        extractedCanvasCode = matchedStandard ? matchedStandard.code : 'CUSTOM';
        usedIndices.add(i);
        break;
      }
    }
  }

  // 4. Remaining tokens form the Title
  const remainingTokens: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!usedIndices.has(i)) {
      remainingTokens.push(tokens[i]);
    }
  }

  let extractedTitle = remainingTokens.join(', ').trim();

  // If no title left, or if first token was used, default to tokens[0]
  if (!extractedTitle && tokens.length > 0) {
    extractedTitle = tokens[0];
  }

  // Strip wrapping quotation marks if any
  extractedTitle = extractedTitle.replace(/^["'“”‘]+|["'“”’]+$/g, '').trim();

  const matchCount =
    (extractedYear ? 1 : 0) +
    (extractedCanvasCode ? 1 : 0) +
    (extractedMaterial ? 1 : 0);

  const hasMatch = matchCount >= 1 && Boolean(extractedTitle);

  return {
    hasMatch,
    title: extractedTitle,
    year: extractedYear,
    canvasSizeCode: extractedCanvasCode,
    widthCm: extractedWidth,
    heightCm: extractedHeight,
    material: extractedMaterial,
    rawMatched: {
      title: extractedTitle,
      year: rawYear,
      size: rawSize,
      material: rawMaterial,
    },
  };
}
