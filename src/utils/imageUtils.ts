// src/utils/imageUtils.ts
import { Crop } from 'react-image-crop';

/**
 * Creates a cropped image File from a source image and crop parameters.
 * @param image - The source HTMLImageElement.
 * @param crop - The crop parameters from react-image-crop.
 * @param fileName - The desired file name for the new File object.
 * @returns A Promise that resolves to the cropped image as a File object.
 */
export function getCroppedImg(
  image: HTMLImageElement,
  crop: Crop,
  fileName: string
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // Ensure crop dimensions are defined and not zero
    if (!crop.width || !crop.height) {
      return reject(new Error('Crop width or height is zero.'));
    }

    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return reject(new Error('Could not get canvas context.'));
    }

    // We draw the cropped section of the original image onto the canvas
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );

    // Convert the canvas content to a Blob, then to a File
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        const file = new File([blob], fileName, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        resolve(file);
      },
      'image/jpeg',
      0.95 // Use high quality JPEG for the output
    );
  });
}