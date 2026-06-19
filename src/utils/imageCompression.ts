/**
 * src/utils/imageCompression.ts
 * 
 * A robust, memory-safe client-side image compression utility.
 * Uses native createImageBitmap to scale high-res images (e.g., 108MP Android camera intents) 
 * DURING the decode phase. This prevents the browser from allocating hundreds of megabytes
 * of RAM to load the uncompressed bitmap, entirely preventing Out-Of-Memory (OOM) crashes
 * on Samsung Galaxy and Google Pixel devices.
 */

export interface CompressionOptions {
  maxWidthOrHeight: number;
  quality: number; // 0.0 to 1.0
  type?: string; // 'image/jpeg', 'image/png', etc.
}

export const compressImage = async (
  file: File,
  options: CompressionOptions = { maxWidthOrHeight: 1280, quality: 0.9, type: 'image/jpeg' }
): Promise<File> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('File provided is not an image');
  }

  try {
    // 1. Get original dimensions first using a lightweight Object URL (doesn't force full pixel decode in all browsers yet)
    // We only need the aspect ratio to determine whether to scale by width or height.
    const dimensions = await new Promise<{ width: number, height: number }>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for dimension check'));
      };
      img.src = url;
    });

    let { width, height } = dimensions;
    const maxDim = options.maxWidthOrHeight;
    let resizeWidth = undefined;
    let resizeHeight = undefined;

    // Only scale down, never up
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        resizeWidth = maxDim;
        // height is automatically scaled by createImageBitmap if omitted, maintaining aspect ratio
      } else {
        resizeHeight = maxDim;
        // width is automatically scaled
      }
    }

    // 2. Memory-Safe Decode
    // createImageBitmap offloads decoding to a worker and resizes BEFORE allocating the full memory footprint.
    // This is the silver bullet for 50MP+ mobile OOM crashes.
    const bitmapOptions: ImageBitmapOptions = { resizeQuality: 'high' };
    if (resizeWidth) bitmapOptions.resizeWidth = resizeWidth;
    if (resizeHeight) bitmapOptions.resizeHeight = resizeHeight;

    const bitmap = await createImageBitmap(file, bitmapOptions);

    // 3. Draw to a safely-sized canvas (e.g., max 1280x1280, never 8000x6000)
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    ctx.drawImage(bitmap, 0, 0);

    // 4. Export to compressed Blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas to Blob conversion failed'));
            return;
          }
          // Preserve the original file name, but swap extension to .jpg if converting
          const originalNameParts = file.name.split('.');
          const newExtension = options.type === 'image/jpeg' ? 'jpg' : originalNameParts.pop();
          const baseName = originalNameParts.join('.');
          const newName = `${baseName}_compressed.${newExtension}`;
          
          // 6. Return as a new File object
          const compressedFile = new File([blob], newName, {
            type: options.type || 'image/jpeg',
            lastModified: Date.now(),
          });
          
          resolve(compressedFile);
        },
        options.type || 'image/jpeg',
        options.quality || 0.9
      );
    });
  } catch (error) {
    console.warn("Fast createImageBitmap compression failed, falling back to FileReader method", error);
    // FALLBACK for very old browsers (iOS 14 Safari) that don't support createImageBitmap well
    return legacyCompressImage(file, options);
  }
};

const legacyCompressImage = (
  file: File,
  options: CompressionOptions
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        let { width, height } = img;
        const maxDim = options.maxWidthOrHeight;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Failed to get canvas context'));
        
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Canvas to Blob conversion failed'));
            const originalNameParts = file.name.split('.');
            const newExtension = options.type === 'image/jpeg' ? 'jpg' : originalNameParts.pop();
            const baseName = originalNameParts.join('.');
            const newName = `${baseName}_compressed.${newExtension}`;
            
            resolve(new File([blob], newName, {
              type: options.type || 'image/jpeg',
              lastModified: Date.now(),
            }));
          },
          options.type || 'image/jpeg',
          options.quality || 0.9
        );
      };
      img.onerror = () => reject(new Error('Image decode failed in fallback'));
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
  });
};
