import { CanvasStandardSize } from '../types';

/**
 * 한국/프랑스 표준 캔버스 호수 규격표 (cm)
 * F (Figure: 인물형)
 * P (Paysage: 풍경형)
 * M (Marine: 해경형)
 * S (Square: 정방형)
 */
export const CANVAS_SIZES: CanvasStandardSize[] = [
  // 0호
  { code: '000F', number: 0, type: 'F', typeName: '인물형 (F)', widthCm: 18.0, heightCm: 14.0 },
  { code: '000P', number: 0, type: 'P', typeName: '풍경형 (P)', widthCm: 18.0, heightCm: 12.0 },
  { code: '000M', number: 0, type: 'M', typeName: '해경형 (M)', widthCm: 18.0, heightCm: 10.0 },
  { code: '000S', number: 0, type: 'S', typeName: '정방형 (S)', widthCm: 18.0, heightCm: 18.0 },
  
  // 1호
  { code: '001F', number: 1, type: 'F', typeName: '인물형 (F)', widthCm: 22.7, heightCm: 15.8 },
  { code: '001P', number: 1, type: 'P', typeName: '풍경형 (P)', widthCm: 22.7, heightCm: 14.0 },
  { code: '001M', number: 1, type: 'M', typeName: '해경형 (M)', widthCm: 22.7, heightCm: 12.0 },
  { code: '001S', number: 1, type: 'S', typeName: '정방형 (S)', widthCm: 15.8, heightCm: 15.8 },

  // 2호
  { code: '002F', number: 2, type: 'F', typeName: '인물형 (F)', widthCm: 25.8, heightCm: 17.9 },
  { code: '002P', number: 2, type: 'P', typeName: '풍경형 (P)', widthCm: 25.8, heightCm: 16.0 },
  { code: '002M', number: 2, type: 'M', typeName: '해경형 (M)', widthCm: 25.8, heightCm: 14.0 },

  // 3호
  { code: '003F', number: 3, type: 'F', typeName: '인물형 (F)', widthCm: 27.3, heightCm: 22.0 },
  { code: '003P', number: 3, type: 'P', typeName: '풍경형 (P)', widthCm: 27.3, heightCm: 19.0 },
  { code: '003M', number: 3, type: 'M', typeName: '해경형 (M)', widthCm: 27.3, heightCm: 16.0 },
  { code: '003S', number: 3, type: 'S', typeName: '정방형 (S)', widthCm: 22.0, heightCm: 22.0 },

  // 4호
  { code: '004F', number: 4, type: 'F', typeName: '인물형 (F)', widthCm: 33.4, heightCm: 24.2 },
  { code: '004P', number: 4, type: 'P', typeName: '풍경형 (P)', widthCm: 33.4, heightCm: 21.2 },
  { code: '004M', number: 4, type: 'M', typeName: '해경형 (M)', widthCm: 33.4, heightCm: 19.0 },

  // 6호
  { code: '006F', number: 6, type: 'F', typeName: '인물형 (F)', widthCm: 40.9, heightCm: 31.8 },
  { code: '006P', number: 6, type: 'P', typeName: '풍경형 (P)', widthCm: 40.9, heightCm: 27.3 },
  { code: '006M', number: 6, type: 'M', typeName: '해경형 (M)', widthCm: 40.9, heightCm: 24.2 },
  { code: '006S', number: 6, type: 'S', typeName: '정방형 (S)', widthCm: 31.8, heightCm: 31.8 },

  // 8호
  { code: '008F', number: 8, type: 'F', typeName: '인물형 (F)', widthCm: 45.5, heightCm: 37.9 },
  { code: '008P', number: 8, type: 'P', typeName: '풍경형 (P)', widthCm: 45.5, heightCm: 33.4 },
  { code: '008M', number: 8, type: 'M', typeName: '해경형 (M)', widthCm: 45.5, heightCm: 27.3 },

  // 10호
  { code: '010F', number: 10, type: 'F', typeName: '인물형 (F)', widthCm: 53.0, heightCm: 45.5 },
  { code: '010P', number: 10, type: 'P', typeName: '풍경형 (P)', widthCm: 53.0, heightCm: 40.9 },
  { code: '010M', number: 10, type: 'M', typeName: '해경형 (M)', widthCm: 53.0, heightCm: 33.4 },
  { code: '010S', number: 10, type: 'S', typeName: '정방형 (S)', widthCm: 45.5, heightCm: 45.5 },

  // 15호
  { code: '015F', number: 15, type: 'F', typeName: '인물형 (F)', widthCm: 65.1, heightCm: 53.0 },
  { code: '015P', number: 15, type: 'P', typeName: '풍경형 (P)', widthCm: 65.1, heightCm: 50.0 },
  { code: '015M', number: 15, type: 'M', typeName: '해경형 (M)', widthCm: 65.1, heightCm: 45.5 },

  // 20호
  { code: '020F', number: 20, type: 'F', typeName: '인물형 (F)', widthCm: 72.7, heightCm: 60.6 },
  { code: '020P', number: 20, type: 'P', typeName: '풍경형 (P)', widthCm: 72.7, heightCm: 53.0 },
  { code: '020M', number: 20, type: 'M', typeName: '해경형 (M)', widthCm: 72.7, heightCm: 50.0 },
  { code: '020S', number: 20, type: 'S', typeName: '정방형 (S)', widthCm: 60.6, heightCm: 60.6 },

  // 25호
  { code: '025F', number: 25, type: 'F', typeName: '인물형 (F)', widthCm: 80.3, heightCm: 65.1 },
  { code: '025P', number: 25, type: 'P', typeName: '풍경형 (P)', widthCm: 80.3, heightCm: 60.6 },
  { code: '025M', number: 25, type: 'M', typeName: '해경형 (M)', widthCm: 80.3, heightCm: 53.0 },

  // 30호 (예시: 030P -> 90.9 x 65.1 cm)
  { code: '030F', number: 30, type: 'F', typeName: '인물형 (F)', widthCm: 90.9, heightCm: 72.7 },
  { code: '030P', number: 30, type: 'P', typeName: '풍경형 (P)', widthCm: 90.9, heightCm: 65.1 },
  { code: '030M', number: 30, type: 'M', typeName: '해경형 (M)', widthCm: 90.9, heightCm: 60.6 },
  { code: '030S', number: 30, type: 'S', typeName: '정방형 (S)', widthCm: 72.7, heightCm: 72.7 },

  // 40호
  { code: '040F', number: 40, type: 'F', typeName: '인물형 (F)', widthCm: 100.0, heightCm: 80.3 },
  { code: '040P', number: 40, type: 'P', typeName: '풍경형 (P)', widthCm: 100.0, heightCm: 72.7 },
  { code: '040M', number: 40, type: 'M', typeName: '해경형 (M)', widthCm: 100.0, heightCm: 65.1 },

  // 50호
  { code: '050F', number: 50, type: 'F', typeName: '인물형 (F)', widthCm: 116.8, heightCm: 91.0 },
  { code: '050P', number: 50, type: 'P', typeName: '풍경형 (P)', widthCm: 116.8, heightCm: 80.3 },
  { code: '050M', number: 50, type: 'M', typeName: '해경형 (M)', widthCm: 116.8, heightCm: 72.7 },
  { code: '050S', number: 50, type: 'S', typeName: '정방형 (S)', widthCm: 91.0, heightCm: 91.0 },

  // 60호
  { code: '060F', number: 60, type: 'F', typeName: '인물형 (F)', widthCm: 130.3, heightCm: 97.0 },
  { code: '060P', number: 60, type: 'P', typeName: '풍경형 (P)', widthCm: 130.3, heightCm: 89.4 },
  { code: '060M', number: 60, type: 'M', typeName: '해경형 (M)', widthCm: 130.3, heightCm: 80.3 },

  // 80호
  { code: '080F', number: 80, type: 'F', typeName: '인물형 (F)', widthCm: 145.5, heightCm: 112.1 },
  { code: '080P', number: 80, type: 'P', typeName: '풍경형 (P)', widthCm: 145.5, heightCm: 97.0 },
  { code: '080M', number: 80, type: 'M', typeName: '해경형 (M)', widthCm: 145.5, heightCm: 89.4 },

  // 100호
  { code: '100F', number: 100, type: 'F', typeName: '인물형 (F)', widthCm: 162.2, heightCm: 130.3 },
  { code: '100P', number: 100, type: 'P', typeName: '풍경형 (P)', widthCm: 162.2, heightCm: 112.1 },
  { code: '100M', number: 100, type: 'M', typeName: '해경형 (M)', widthCm: 162.2, heightCm: 97.0 },
  { code: '100S', number: 100, type: 'S', typeName: '정방형 (S)', widthCm: 130.3, heightCm: 130.3 },

  // 120호
  { code: '120F', number: 120, type: 'F', typeName: '인물형 (F)', widthCm: 193.9, heightCm: 130.3 },
  { code: '120P', number: 120, type: 'P', typeName: '풍경형 (P)', widthCm: 193.9, heightCm: 112.1 },
  { code: '120M', number: 120, type: 'M', typeName: '해경형 (M)', widthCm: 193.9, heightCm: 97.0 },
];

export function getCanvasSizeByCode(code: string): CanvasStandardSize | undefined {
  return CANVAS_SIZES.find((item) => item.code.toUpperCase() === code.toUpperCase());
}

export function getCanvasOrientation(
  widthCm: number | string,
  heightCm: number | string
): 'landscape' | 'portrait' | 'square' {
  const w = Number(widthCm);
  const h = Number(heightCm);
  if (!w || !h || isNaN(w) || isNaN(h)) return 'landscape';
  if (Math.abs(w - h) < 0.1) return 'square';
  return w > h ? 'landscape' : 'portrait';
}

export function getCanvasDimensions(
  code: string,
  orientation: 'landscape' | 'portrait'
): { widthCm: number; heightCm: number } | undefined {
  const std = getCanvasSizeByCode(code);
  if (!std) return undefined;
  const longSide = Math.max(std.widthCm, std.heightCm);
  const shortSide = Math.min(std.widthCm, std.heightCm);
  if (std.type === 'S') {
    return { widthCm: std.widthCm, heightCm: std.heightCm };
  }
  return orientation === 'landscape'
    ? { widthCm: longSide, heightCm: shortSide }
    : { widthCm: shortSide, heightCm: longSide };
}

export function formatCanvasSizeText(widthCm: number, heightCm: number, canvasSizeCode?: string): string {
  const dim = `${widthCm} × ${heightCm} cm`;
  if (canvasSizeCode) {
    return `${dim} (${canvasSizeCode})`;
  }
  return dim;
}
