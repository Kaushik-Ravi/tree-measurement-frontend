// src/apiService.ts

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export interface Point { x: number; y: number; }
export interface Metrics { height_m: number; canopy_m: number; dbh_cm: number; }
export interface SpeciesInfo { scientificName: string; score: number; commonNames: string[]; }
export interface WoodDensityInfo { value: number; unit: string; sourceSpecies: string; matchScore: number; sourceRegion: string; }
export interface IdentificationResponse { bestMatch: SpeciesInfo | null; woodDensity: WoodDensityInfo | null; remainingIdentificationRequests?: number; }
export interface CO2Response { co2_sequestered_kg: number; unit: string; }

// --- MODIFIED: Interfaces updated to support Community Grove ---
export interface TreeResult {
  id: string;
  created_at: string;
  user_id: string;
  file_name: string;
  metrics: Metrics | null; // Can be null for pending
  species?: SpeciesInfo;
  wood_density?: WoodDensityInfo;
  co2_sequestered_kg?: number;
  condition?: string;
  ownership?: string;
  remarks?: string;
  latitude?: number;
  longitude?: number;
  image_url?: string;
  distance_m?: number;
  scale_factor?: number;
  device_heading?: number;
  status?: 'PENDING_ANALYSIS' | 'COMPLETE' | 'ANALYSIS_IN_PROGRESS' | 'VERIFIED'; // More specific status
  confidence?: any; // To hold the consensus data
}

export interface PendingTree extends TreeResult {
    analysis_count: number; // Field from our RPC call
}

export interface TreeResultPayload {
  fileName: string;
  metrics: Metrics;
  species?: SpeciesInfo;
  woodDensity?: WoodDensityInfo;
  co2_sequestered_kg?: number;
  condition?: string;
  ownership?: string;
  remarks?: string;
  latitude?: number;
  longitude?: number;
  image_url?: string; 
  distance_m?: number;
  scale_factor?: number;
}
// --- END MODIFIED BLOCK ---

export interface UpdateTreeResultPayload {
    condition?: string;
    ownership?: string;
    remarks?: string;
    latitude?: number | null;
    longitude?: number | null;
}

// --- NEW: Interface for Community Analysis submission ---
export interface CommunityAnalysisPayload {
  metrics: Metrics;
  species?: SpeciesInfo | null;
}
// --- END NEW BLOCK ---


const getAuthHeaders = (token: string, contentType: string | null = 'application/json') => {
  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
};

// --- Database & Upload API Functions ---

export const uploadImage = async (imageFile: File, token: string): Promise<{ image_url: string }> => {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch(`${API_BASE_URL}/api/upload-image`, {
    method: 'POST',
    headers: getAuthHeaders(token, null), // Let browser set Content-Type for FormData
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred during upload.' }));
    throw new Error(errorData.detail || `Image upload API error! status: ${response.status}`);
  }
  return response.json();
};

export const quickCapture = async (
  imageFile: File,
  distance: number,
  scaleFactor: number,
  heading: number | null,
  latitude: number,
  longitude: number,
  token: string
): Promise<any> => {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('distance_m', distance.toString());
  formData.append('scale_factor', scaleFactor.toString());
  formData.append('latitude', latitude.toString());
  formData.append('longitude', longitude.toString());
  if (heading !== null) {
    formData.append('device_heading', heading.toString());
  }

  const response = await fetch(`${API_BASE_URL}/api/quick-capture`, {
    method: 'POST',
    headers: getAuthHeaders(token, null),
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred during quick capture.' }));
    throw new Error(errorData.detail || `Quick Capture API error! status: ${response.status}`);
  }
  return response.json();
};

export const getResults = async (token: string): Promise<TreeResult[]> => {
  const response = await fetch(`${API_BASE_URL}/api/results`, {
    method: 'GET',
    headers: getAuthHeaders(token),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
    throw new Error(errorData.detail || `API error! status: ${response.status}`);
  }
  return response.json();
};

export const saveResult = async (resultData: TreeResultPayload, token: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/api/results`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(resultData),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
    throw new Error(errorData.detail || `API error! status: ${response.status}`);
  }
  return response.json();
};

export const updateResult = async (resultId: string, updateData: UpdateTreeResultPayload, token: string): Promise<TreeResult> => {
    const response = await fetch(`${API_BASE_URL}/api/results/${resultId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(token),
        body: JSON.stringify(updateData),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
        throw new Error(errorData.detail || `API error! status: ${response.status}`);
    }
    const responseData = await response.json();
    return responseData.data;
};

export const deleteResult = async (resultId: string, token: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/api/results/${resultId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
    throw new Error(errorData.detail || `API error! status: ${response.status}`);
  }
  return response.json();
};


// --- [START] NEW COMMUNITY GROVE API FUNCTIONS ---

export const getPendingTrees = async (token: string): Promise<PendingTree[]> => {
  const response = await fetch(`${API_BASE_URL}/api/grove/pending`, {
    method: 'GET',
    headers: getAuthHeaders(token),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
    throw new Error(errorData.detail || `API error! status: ${response.status}`);
  }
  return response.json();
};

export const claimTree = async (resultId: string, token: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/api/grove/claim/${resultId}`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
    throw new Error(errorData.detail || `API error! status: ${response.status}`);
  }
  return response.json();
};

export const submitCommunityAnalysis = async (resultId: string, submission: CommunityAnalysisPayload, token: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/api/grove/submit/${resultId}`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(submission),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
    throw new Error(errorData.detail || `API error! status: ${response.status}`);
  }
  return response.json();
};

// --- [END] NEW COMMUNITY GROVE API FUNCTIONS ---


// --- Existing Unchanged Functions ---

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
  formData.append('image', imageFile);
  formData.append('organ', organ);
  const response = await fetch(`${API_BASE_URL}/api/plantnet/identify`, { method: 'POST', body: formData, });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
    throw new Error(errorData.error || `API error! status: ${response.status}`);
  }
  return response.json();
};

export const samAutoSegment = async (imageFile: File, distanceM: number, scaleFactor: number, clickPoint: Point) => {
  const formData = new FormData();
  formData.append('image', imageFile);
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
    const dataPayload = { foreground_points: foregroundPoints, scale_factor: scaleFactor, };
    const formData = new FormData();
    formData.append('image', imageFile);
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