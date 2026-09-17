import { MaterialType } from '../types';

/**
 * Formats Material value for gallery and catalogue display
 * Acrylic -> Acrylic on Canvas
 * Oil -> Oil on Canvas
 * Mixed -> Mixed Material on Canvas
 */
export function formatMaterialOnCanvas(material?: MaterialType | string | null): string {
  if (!material) return '';
  const trimmed = String(material).trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (lower === 'acrylic') {
    return 'Acrylic on Canvas';
  }
  if (lower === 'oil') {
    return 'Oil on Canvas';
  }
  if (lower === 'mixed' || lower === 'mixed material') {
    return 'Mixed Material on Canvas';
  }
  if (lower.includes('canvas')) {
    return trimmed;
  }
  return `${trimmed} on Canvas`;
}

/**
 * Formats canvas size using actual widthCm and heightCm values:
 * e.g., 80.3 × 116.8 cm
 */
export function formatCanvasDimensions(widthCm?: number | null, heightCm?: number | null): string {
  if (typeof widthCm !== 'number' || typeof heightCm !== 'number') {
    return '';
  }
  return `${widthCm} × ${heightCm} cm`;
}
