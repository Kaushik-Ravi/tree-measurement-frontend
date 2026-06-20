/**
 * src/utils/imageCompression.ts
 * 
 * A robust, memory-safe client-side image compression utility.
 * Uses native createImageBitmap to scale high-res images (e.g., 108MP Android camera intents) 
 * DURING the decode phase. This prevents the browser from allocating hundreds of megabytes
 * of RAM.
 */
import ExifReader from 'exifreader';

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
    let resizeWidth = undefined;
    let resizeHeight = undefined;
    const maxDim = options.maxWidthOrHeight;

    // 1. Memory-Safe Dimension Check via EXIF (Binary headers only, NO pixel decoding)
    try {
      const tags = await ExifReader.load(file);
      const width = tags['ImageWidth']?.value;
      const height = tags['ImageLength']?.value;

      if (typeof width === 'number' && typeof height === 'number') {
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            resizeWidth = maxDim;
          } else {
            resizeHeight = maxDim;
          }
        }
      } else {
         // Fallback: If EXIF is missing, just bound the width. 
         // createImageBitmap will automatically scale height proportionally.
         resizeWidth = maxDim;
      }
    } catch (exifError) {
      console.warn("EXIF read failed, falling back to width-bounding:", exifError);
      resizeWidth = maxDim;
    }

    // 2. Memory-Safe Decode
    const bitmapOptions: ImageBitmapOptions = { resizeQuality: 'high' };
    if (resizeWidth) bitmapOptions.resizeWidth = resizeWidth;
    if (resizeHeight) bitmapOptions.resizeHeight = resizeHeight;

    const bitmap = await createImageBitmap(file, bitmapOptions);

    // 3. Draw to a safely-sized canvas
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
          const originalNameParts = file.name.split('.');
          const newExtension = options.type === 'image/jpeg' ? 'jpg' : originalNameParts.pop();
          const baseName = originalNameParts.join('.');
          const newName = `${baseName}_compressed.${newExtension}`;
          
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
    console.error("Critical error in createImageBitmap compression:", error);
    throw new Error("Failed to compress image safely. The image might be too large or corrupted.");
  }
};

