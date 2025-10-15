// src/apiService.ts

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const MAX_IMAGE_DIMENSION = 1024; // Max width/height for measurement images
const IMAGE_QUALITY = 0.9; // JPEG quality for measurement images

export interface Point { x: number; y: number; }
export interface Metrics { height_m: number; canopy_m: number; dbh_cm: number; }
export interface SpeciesInfo { scientificName: string; score: number; commonNames: string[]; }
export interface WoodDensityInfo { value: number; unit: string; sourceSpecies: string; matchScore: number; sourceRegion: string; }
export interface IdentificationResponse { bestMatch: SpeciesInfo | null; woodDensity: WoodDensityInfo | null; remainingIdentificationRequests?: number; }
export interface CO2Response { co2_sequestered_kg: number; unit: string; }

/**
 * NEW: Client-side image processing function.
 * Resizes and compresses an image file before it's sent to the API.
 * This is the core of the frontend performance optimization.
 * @param file The original image file.
 * @param maxDimension The maximum width or height for the output image.
 * @param quality The JPEG compression quality (0 to 1).
 * @returns A promise that resolves to the processed image as a Blob.
 */
const processImageBeforeUpload = (file: File, maxDimension: number, quality: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to get canvas context'));
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};


export const calculateCO2 = async (metrics: Metrics, woodDensity: number): Promise<CO2Response> => {
  const payload = { metrics, wood_density: woodDensity };
  const response = await fetch(`${API_BASE_URL}/api/calculate_co2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
    throw new Error(errorData.error || `API error! status: ${response.status}`);
  }
  return response.json();
};

export const identifySpecies = async (imageFile: File, organ: string): Promise<IdentificationResponse> => {
  const formData = new FormData();
  // Species ID images are smaller and can be higher quality for detail.
  const processedImageBlob = await processImageBeforeUpload(imageFile, 800, 0.92);
  formData.append('image', processedImageBlob, imageFile.name);
  formData.append('organ', organ);
  const response = await fetch(`${API_BASE_URL}/api/plantnet/identify`, { method: 'POST', body: formData, });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
    throw new Error(errorData.error || `API error! status: ${response.status}`);
  }
  return response.json();
};

export const samAutoSegment = async (imageFile: File, distanceM: number, scaleFactor: number, clickPoint: Point) => {
  const processedImageBlob = await processImageBeforeUpload(imageFile, MAX_IMAGE_DIMENSION, IMAGE_QUALITY);
  const formData = new FormData();
  formData.append('image', processedImageBlob, imageFile.name);
  formData.append('distance_m', distanceM.toString());
  formData.append('scale_factor', scaleFactor.toString());
  formData.append('click_x', clickPoint.x.toString());
  formData.append('click_y', clickPoint.y.toString());
  const response = await fetch(`${API_BASE_URL}/api/sam_auto_segment`, { method: 'POST', body: formData, });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const samRefineWithPoints = async (imageFile: File, foregroundPoints: Point[], scaleFactor: number) => {
    const processedImageBlob = await processImageBeforeUpload(imageFile, MAX_IMAGE_DIMENSION, IMAGE_QUALITY);
    const dataPayload = { foreground_points: foregroundPoints, scale_factor: scaleFactor, };
    const formData = new FormData();
    formData.append('image', processedImageBlob, imageFile.name);
    formData.append('data', JSON.stringify(dataPayload));
    const response = await fetch(`${API_BASE_URL}/api/sam_refine_with_points`, { method: 'POST', body: formData, });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

export const manualGetDbhRectangle = async (trunkBasePoint: Point, scaleFactor: number, imageWidth: number, imageHeight: number) => {
    const payload = { trunk_base_point: trunkBasePoint, scale_factor: scaleFactor, image_width: imageWidth, image_height: imageHeight, };
    const response = await fetch(`${API_BASE_URL}/api/manual_get_dbh_rectangle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

export const manualCalculation = async (heightPoints: Point[], canopyPoints: Point[], girthPoints: Point[], scaleFactor: number) => {
    const payload = { height_points: heightPoints, canopy_points: canopyPoints, girth_points: girthPoints, scale_factor: scaleFactor, };
    const response = await fetch(`${API_BASE_URL}/api/manual_calculation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};