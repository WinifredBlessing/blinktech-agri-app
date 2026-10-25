/**
 * Utility functions for client-side image compression and resizing.
 * Prevents sending massive raw uncompressed images over HTTP to Supabase / PostgreSQL.
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.65,
  maxSizeKB: 80,
};

/**
 * Compresses an image File or Blob using an HTML5 Canvas.
 * Returns a Promise that resolves to a compressed Data URL string.
 */
export async function compressImageFile(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = typeof performance !== 'undefined' ? performance.now() : 0;
  const initialSizeKB = Math.round(file.size / 1024);

  // If already under 60KB and is a standard image, it's already tiny
  if (file.size < 60 * 1024 && file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      const timer = setTimeout(() => resolve(''), 3000);
      reader.onload = () => {
        clearTimeout(timer);
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        clearTimeout(timer);
        resolve('');
      };
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    // Safety timer: Never allow image compression to stall the UI for more than 4 seconds
    const safetyTimer = setTimeout(() => {
      console.warn('[ImageCompression] compressImageFile timed out after 4s, falling back to basic FileReader');
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    }, 4000);

    // If not in browser environment or canvas not supported, fallback to FileReader
    if (typeof window === 'undefined' || !window.document || !window.document.createElement) {
      clearTimeout(safetyTimer);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      clearTimeout(safetyTimer);
      URL.revokeObjectURL(objectUrl);

      try {
        let { width, height } = img;

        // Calculate aspect-ratio preserving dimensions
        if (width > opts.maxWidth || height > opts.maxHeight) {
          const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        let result = canvas.toDataURL('image/jpeg', opts.quality);
        let resultSizeKB = Math.round((result.length * 0.75) / 1024);

        if (resultSizeKB > opts.maxSizeKB) {
          result = canvas.toDataURL('image/jpeg', 0.55);
          resultSizeKB = Math.round((result.length * 0.75) / 1024);
        }

        const duration = performance.now() - startTime;
        console.log(
          `[ImageCompression] Compressed: ${initialSizeKB}KB -> ${resultSizeKB}KB in ${duration.toFixed(1)}ms`
        );

        resolve(result);
      } catch (err) {
        console.warn('[ImageCompression] Canvas compression failed, falling back to original:', err);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      }
    };

    img.onerror = () => {
      clearTimeout(safetyTimer);
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Compresses an existing Data URL if it is excessively large (e.g. > 80KB base64 string).
 * External URLs (http/https) are returned immediately without modification.
 */
export async function compressDataUrlIfNeeded(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  const approxSizeKB = Math.round((dataUrl.length * 0.75) / 1024);
  if (approxSizeKB <= 80) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    // Safety timer: Never allow data URL compression to stall for more than 3 seconds
    const safetyTimer = setTimeout(() => {
      resolve(dataUrl);
    }, 3000);

    if (typeof window === 'undefined') {
      clearTimeout(safetyTimer);
      return resolve(dataUrl);
    }

    const img = new Image();
    img.onload = () => {
      clearTimeout(safetyTimer);
      try {
        let { width, height } = img;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', 0.65);
        resolve(compressed);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      clearTimeout(safetyTimer);
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}

/**
 * Converts a Base64 Data URL string to a standard Blob object for HTTP / Storage upload.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(';base64,');
  if (parts.length < 2) {
    throw new Error('Invalid data URL format for Blob conversion');
  }
  const contentType = parts[0].replace(/^data:/, '') || 'image/jpeg';
  const binaryString = atob(parts[1]);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}
