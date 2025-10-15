// src/apiService.ts

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export interface Point { x: number; y: number; }
export interface Metrics { height_m: number; canopy_m: number; dbh_cm: number; }
export interface SpeciesInfo { scientificName: string; score: number; commonNames: string[]; }
export interface WoodDensityInfo { value: number; unit: string; sourceSpecies: string; matchScore: number; sourceRegion: string; }
export interface IdentificationResponse { bestMatch: SpeciesInfo | null; woodDensity: WoodDensityInfo | null; remainingIdentificationRequests?: number; }
export interface CO2Response { co2_sequestered_kg: number; unit: string; }

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

export const identifySpecies = async (imageBlob: Blob, originalFileName: string, organ: string): Promise<IdentificationResponse> => {
  const formData = new FormData();
  formData.append('image', imageBlob, originalFileName);
  formData.append('organ', organ);
  const response = await fetch(`${API_BASE_URL}/api/plantnet/identify`, { method: 'POST', body: formData, });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
    throw new Error(errorData.error || `API error! status: ${response.status}`);
  }
  return response.json();
};

export const samAutoSegment = async (imageBlob: Blob, originalFileName: string, distanceM: number, scaleFactor: number, clickPoint: Point) => {
  const formData = new FormData();
  formData.append('image', imageBlob, originalFileName);
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

export const samRefineWithPoints = async (imageBlob: Blob, originalFileName: string, foregroundPoints: Point[], scaleFactor: number) => {
    const dataPayload = { foreground_points: foregroundPoints, scale_factor: scaleFactor, };
    const formData = new FormData();
    formData.append('image', imageBlob, originalFileName);
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