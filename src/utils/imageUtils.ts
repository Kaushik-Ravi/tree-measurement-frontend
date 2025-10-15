// src/utils/imageUtils.ts
import { PixelCrop } from 'react-image-crop';

/**
 * Creates a cropped image File from a source image URL and crop parameters,
 * ensuring the crop is performed on the full-resolution image.
 *
 * @param imageSrc - The URL of the source image (full resolution).
 * @param crop - The crop parameters in pixels, relative to the displayed image size.
 * @param displayImage - The HTMLImageElement as it is displayed on screen (could be resized).
 * @param fileName - The desired file name for the new File object.
 * @returns A Promise that resolves to the cropped image as a File object.
 */
export function getCroppedImg(
  imageSrc: string,
  crop: PixelCrop,
  displayImage: HTMLImageElement,
  fileName: string
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Create a new Image object to load the full-resolution image
    // This avoids issues with scaled/transformed display images.
    const sourceImage = new Image();
    sourceImage.src = imageSrc;
    sourceImage.crossOrigin = 'anonymous'; // Recommended for canvas operations

    sourceImage.onload = () => {
      const canvas = document.createElement('canvas');

      // These are the scaling factors between the displayed image and the original, full-res image.
      const scaleX = sourceImage.naturalWidth / displayImage.width;
      const scaleY = sourceImage.naturalHeight / displayImage.height;

      // The final dimensions of the cropped image in pixels.
      const canvasWidth = Math.floor(crop.width * scaleX);
      const canvasHeight = Math.floor(crop.height * scaleY);

      if (canvasWidth === 0 || canvasHeight === 0) {
        return reject(new Error('Crop width or height is zero. Cannot create crop.'));
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get 2D canvas context.'));
      }

      // We draw the relevant section of the full-resolution source image onto the canvas.
      ctx.drawImage(
        sourceImage,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // Convert the canvas content to a Blob, then to a File.
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Canvas to Blob conversion failed.'));
          }
          const file = new File([blob], fileName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(file);
        },
        'image/jpeg',
        0.95 // Maintain high quality for the output JPEG.
      );
    };

    sourceImage.onerror = (error) => {
      reject(error);
    };
  });
}