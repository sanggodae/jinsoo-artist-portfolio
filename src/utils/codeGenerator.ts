import { Artwork, MaterialCode, MaterialType } from '../types';

export function materialToCode(material: MaterialType): MaterialCode {
  switch (material) {
    case 'Acrylic':
      return 'A';
    case 'Oil':
      return 'O';
    case 'Mixed':
    default:
      return 'M';
  }
}

export function codeToMaterial(codeChar: string): MaterialType {
  const upper = codeChar.toUpperCase();
  if (upper === 'A') return 'Acrylic';
  if (upper === 'O') return 'Oil';
  return 'Mixed';
}

export interface CodeGeneratorOptions {
  overallCounterOffset?: number; // e.g. 14 (default)
  yearlyCounters?: Record<number, number>; // e.g. { 2026: 5 }
}

/**
 * Generate unique artwork code following the new rule:
 * Format: YYSSSM-00,000
 * e.g., 26030PA-01,014
 * 26 = year 2026 (last 2 digits)
 * 030P = canvas size code
 * A/O/M = material code (A = Acrylic, O = Oil, M = Mixed)
 * -
 * 00 = 해당 연도의 누적 작품번호 (2-digit)
 * ,
 * 000 = 전체 누적 작품번호 (3-digit)
 *
 * * 기존 13개 작품의 작품번호는 절대로 변경하지 않고 그대로 보존합니다.
 */
export function generateNextArtworkCode(
  year: number,
  canvasSizeCode: string,
  material: MaterialType,
  existingArtworks: Artwork[],
  excludeArtworkId?: string,
  options?: CodeGeneratorOptions
): string {
  const year2Digits = String(year).slice(-2);
  const cleanCanvas = (canvasSizeCode || '030P').trim().toUpperCase();
  const matCode = materialToCode(material);
  const prefix = `${year2Digits}${cleanCanvas}${matCode}-`;

  // 1. Calculate yearly cumulative number (00)
  let yearlyCount = 0;
  if (options?.yearlyCounters && typeof options.yearlyCounters[year] === 'number') {
    yearlyCount = options.yearlyCounters[year];
  } else {
    // Count artworks for this specific year
    const sameYearArts = existingArtworks.filter((art) => {
      if (excludeArtworkId && art.id === excludeArtworkId) return false;
      return art.year === year || (art.code && art.code.startsWith(year2Digits));
    });
    yearlyCount = sameYearArts.length + 1;
  }
  const yearSeqStr = String(yearlyCount).padStart(2, '0');

  // 2. Calculate overall cumulative number (000)
  // Default offset is 14 (since initial dataset has 13 works, so next is 014)
  let overallOffset = options?.overallCounterOffset ?? 14;

  // Check highest parsed overall counter from existing artworks with comma format
  let maxFoundOverall = 0;
  existingArtworks.forEach((art) => {
    if (excludeArtworkId && art.id === excludeArtworkId) return;
    if (art.code && art.code.includes(',')) {
      const parts = art.code.split(',');
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed) && parsed > maxFoundOverall) {
        maxFoundOverall = parsed;
      }
    }
  });

  const nextOverall = Math.max(overallOffset, maxFoundOverall > 0 ? maxFoundOverall + 1 : overallOffset);
  const overallSeqStr = String(nextOverall).padStart(3, '0');

  let candidate = `${prefix}${yearSeqStr},${overallSeqStr}`;

  // Safety duplicate avoidance
  let safetyYearIncrement = yearlyCount;
  let safetyOverallIncrement = nextOverall;
  while (isCodeDuplicated(candidate, existingArtworks, excludeArtworkId)) {
    safetyYearIncrement++;
    safetyOverallIncrement++;
    candidate = `${prefix}${String(safetyYearIncrement).padStart(2, '0')},${String(safetyOverallIncrement).padStart(3, '0')}`;
  }

  return candidate;
}

/**
 * Check whether the given artwork code is duplicated
 */
export function isCodeDuplicated(
  code: string,
  existingArtworks: Artwork[],
  excludeArtworkId?: string
): boolean {
  if (!code) return false;
  const trimmed = code.trim().toUpperCase();
  return existingArtworks.some((art) => {
    if (excludeArtworkId && art.id === excludeArtworkId) return false;
    return art.code.trim().toUpperCase() === trimmed;
  });
}

/**
 * Validate artwork code (supports legacy format 26050PA-01 and new format 26030PA-01,014)
 */
export function validateArtworkCode(
  code: string,
  existingArtworks: Artwork[],
  excludeArtworkId?: string
): { isValid: boolean; error?: string } {
  const trimmed = code.trim();
  if (!trimmed) {
    return { isValid: false, error: '작품번호를 입력해주세요.' };
  }

  if (isCodeDuplicated(trimmed, existingArtworks, excludeArtworkId)) {
    return { isValid: false, error: '이미 사용 중인 작품번호입니다. 중복은 허용되지 않습니다.' };
  }

  // Accepts both:
  // 1. Legacy format: e.g. 26050PA-01
  // 2. New format: e.g. 26030PA-01,014
  const legacyOrNewRegex = /^[0-9]{2}[0-9A-Za-z]+[AOMaom]-[0-9]{2}(,[0-9]{3})?$/;
  if (!legacyOrNewRegex.test(trimmed)) {
    // Non-blocking warning: allows custom codes if intentional
  }

  return { isValid: true };
}
