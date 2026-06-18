/**
 * src/utils/imageCompression.ts
 * 
 * A robust, completely client-side image compression utility.
 * Adheres strictly to PlantNet API limits and Supabase 1GB free tier limits.
 * Default rules: 1280px maximum dimension, 90% JPEG quality.
 */

export interface CompressionOptions {
  maxWidthOrHeight: number;
  quality: number; // 0.0 to 1.0
  type?: string; // 'image/jpeg', 'image/png', etc.
}

export const compressImage = (
  file: File,
  options: CompressionOptions = { maxWidthOrHeight: 1280, quality: 0.9, type: 'image/jpeg' }
): Promise<File> => {
  return new Promise((resolve, reject) => {
    // 1. Validate the file
    if (!file.type.startsWith('image/')) {
      reject(new Error('File provided is not an image'));
      return;
    }

    // 2. Read the file into an Image object
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        // 3. Calculate new dimensions preserving aspect ratio
        let { width, height } = img;
        const maxDim = options.maxWidthOrHeight;
        
        // Only scale down, never up
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        // 4. Draw to canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);

        // 5. Export to compressed Blob
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
            
            console.log(`[Compression] Shrink: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(compressedFile);
          },
          options.type || 'image/jpeg',
          options.quality
        );
      };

      img.onerror = (error) => {
        reject(new Error('Failed to load image for compression'));
      };
    };

    reader.onerror = (error) => {
      reject(new Error('FileReader failed to read the file'));
    };
  });
};
