/**
 * Client-side Image Optimization Utility for High-Resolution Paintings
 * - Preserves EXACT original aspect ratio (no cropping, no distortion)
 * - Downscales ultra-large camera/smartphone photos (e.g., 5000x4000 15MB+)
 *   to a museum-crisp web resolution (max 2048px dimension)
 * - Converts to optimized JPEG/WEBP data URL (~250KB - 700KB)
 * - Prevents localStorage/IndexedDB memory exhaustion while maintaining pristine visual detail
 */

export interface OptimizeImageOptions {
  maxDimension?: number;
  quality?: number;
}

export function optimizeImageFile(
  file: File,
  options: OptimizeImageOptions = {}
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { maxDimension = 2048, quality = 0.88 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('이미지 파일을 읽는데 실패했습니다.'));
    };

    reader.onload = () => {
      const img = new Image();
      img.onerror = () => {
        reject(new Error('이미지 데이터를 파싱하는데 실패했습니다.'));
      };

      img.onload = () => {
        let { width, height } = img;

        // If both dimensions are within limits and file is small, keep as is
        if (width <= maxDimension && height <= maxDimension && file.size < 1024 * 1024) {
          resolve({
            dataUrl: reader.result as string,
            width,
            height,
          });
          return;
        }

        // Calculate scaled dimensions preserving EXACT aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original
          resolve({
            dataUrl: reader.result as string,
            width: img.width,
            height: img.height,
          });
          return;
        }

        // Use high quality image interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Determine best output format
        const outputMime = file.type === 'image/png' ? 'image/jpeg' : (file.type || 'image/jpeg');
        const optimizedDataUrl = canvas.toDataURL(outputMime, quality);

        resolve({
          dataUrl: optimizedDataUrl,
          width,
          height,
        });
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
