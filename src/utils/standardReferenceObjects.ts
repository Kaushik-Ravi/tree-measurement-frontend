// src/utils/standardReferenceObjects.ts
/**
 * Standard Reference Objects for Photo-Based Calibration
 * 
 * Provides pre-defined common objects with known dimensions to eliminate
 * manual distance entry during Tier 3 calibration.
 * 
 * Architecture: Surgical enhancement to existing CalibrationView workflow
 * - Zero breaking changes to existing manual calibration
 * - Pre-fills known dimensions automatically
 * - Maintains backward compatibility with fovRatio calculation
 */

export interface StandardReferenceObject {
  id: string;
  name: string;
  widthMM: number;         // Physical width in millimeters
  heightMM: number;        // Physical height in millimeters
  iconName: string;        // Lucide icon component name
  description: string;     // User-friendly description
  commonRegions: string[]; // Geographic regions where this is standard
  instructionText: string; // Specific instruction for marking
  recommendedDistance: number; // Recommended distance in meters for best accuracy
}

/**
 * Curated list of globally-recognized standard objects
 * Each object has ISO-standardized dimensions for accuracy
 */
export const STANDARD_OBJECTS: StandardReferenceObject[] = [
  {
    id: 'card_iso',
    name: 'Standard Card (Loyalty/ID)',
    widthMM: 85.60,
    heightMM: 53.98,
    iconName: 'CreditCard',
    description: 'Loyalty card, ID, or Bank card (ISO 7810)',
    commonRegions: ['Global'],
    instructionText: 'Mark the WIDTH (long edge: 85.6mm) of the card',
    recommendedDistance: 0.3 // 30cm - Close up for small object
  },
  {
    id: 'a4_paper',
    name: 'A4 Paper',
    widthMM: 210,
    heightMM: 297,
    iconName: 'FileText',
    description: 'Standard A4 office paper (210mm × 297mm)',
    commonRegions: ['Europe', 'Asia', 'Oceania', 'Africa', 'South America'],
    instructionText: 'Mark the WIDTH (short edge: 210mm) of the A4 paper',
    recommendedDistance: 0.6 // 60cm - Medium distance
  },
  {
    id: 'us_letter',
    name: 'US Letter Paper',
    widthMM: 215.9,
    heightMM: 279.4,
    iconName: 'FileText',
    description: 'US Letter paper (8.5" × 11")',
    commonRegions: ['North America', 'Central America'],
    instructionText: 'Mark the WIDTH (short edge: 8.5 inches) of the Letter paper',
    recommendedDistance: 0.6 // 60cm - Medium distance
  }
];

/**
 * Standard assumed calibration distance (meters)
 * Research shows most users naturally hold objects 0.8-1.2m from camera
 */
export const DEFAULT_CALIBRATION_DISTANCE = 1.0; // meters

/**
 * Calculate camera FOV ratio from standard reference object
 * 
 * This function matches the existing CalibrationView calculation logic
 * but eliminates manual distance entry by using DEFAULT_CALIBRATION_DISTANCE
 * 
 * @param pixelDistance - Distance in pixels between marked points on image
 * @param objectId - ID of the selected standard reference object
 * @param imageWidth - Image width in pixels (natural dimensions)
 * @param imageHeight - Image height in pixels (natural dimensions)
 * @param customDistance - Optional custom distance override (for advanced users)
 * @returns Camera FOV ratio (same format as existing manual calibration)
 */
export function calculateFovRatioFromStandardObject(
  pixelDistance: number,
  objectId: string,
  imageWidth: number,
  imageHeight: number,
  customDistance: number = DEFAULT_CALIBRATION_DISTANCE
): number {
  const obj = STANDARD_OBJECTS.find(o => o.id === objectId);
  
  if (!obj) {
    throw new Error(`Unknown standard object ID: ${objectId}`);
  }

  // Convert object width from millimeters to centimeters (existing code expects cm)
  const realSizeCM = obj.widthMM / 10;
  
  // Use default distance (1 meter) unless user specifies custom
  const distanceMeters = customDistance;
  
  // CRITICAL: Match existing CalibrationView.tsx calculation (lines 133-139)
  // Formula: cameraConstant = (r * w) / (n * D_in_cm)
  // Where:
  //   r = real size in cm
  //   w = image dimension (max of width/height)
  //   n = pixel distance between marked points
  //   D_in_cm = distance to object in centimeters
  
  const w = Math.max(imageWidth, imageHeight);
  const n = pixelDistance;
  const D_in_cm = distanceMeters * 100;
  
  const fovRatio = (realSizeCM * w) / (n * D_in_cm);
  
  console.log('[Standard Object Calibration]', {
    object: obj.name,
    realSizeCM,
    pixelDistance: n,
    imageMaxDim: w,
    distanceCM: D_in_cm,
    calculatedFovRatio: fovRatio
  });
  
  return fovRatio;
}

/**
 * Get object by ID with error handling
 */
export function getStandardObject(objectId: string): StandardReferenceObject | null {
  return STANDARD_OBJECTS.find(o => o.id === objectId) || null;
}

/**
 * Validate marked points are measuring width (not height)
 * Helps prevent user error when marking
 * 
 * @param point1 - First marked point
 * @param point2 - Second marked point
 * @returns true if points represent a horizontal measurement
 */
export function isHorizontalMeasurement(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): boolean {
  const deltaX = Math.abs(point2.x - point1.x);
  const deltaY = Math.abs(point2.y - point1.y);
  
  // Horizontal if X-distance is greater than Y-distance
  return deltaX > deltaY;
}

/**
 * localStorage key for custom reference objects
 */
const CUSTOM_OBJECTS_KEY = 'treeMeasurement_customReferenceObjects';

/**
 * Save custom reference object to localStorage
 */
export function saveCustomObject(
  name: string,
  widthMM: number,
  heightMM: number
): StandardReferenceObject {
  const customObject: StandardReferenceObject = {
    id: `custom_${Date.now()}`,
    name,
    widthMM,
    heightMM,
    iconName: 'Edit',
    description: `Custom object (${widthMM}mm × ${heightMM}mm)`,
    commonRegions: ['Custom'],
    instructionText: `Mark the WIDTH (${widthMM}mm) of your custom object`
  };
  
  const existing = loadCustomObjects();
  const updated = [...existing, customObject];
  localStorage.setItem(CUSTOM_OBJECTS_KEY, JSON.stringify(updated));
  
  return customObject;
}

/**
 * Load custom reference objects from localStorage
 */
export function loadCustomObjects(): StandardReferenceObject[] {
  try {
    const saved = localStorage.getItem(CUSTOM_OBJECTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('[Custom Objects] Failed to load:', error);
    return [];
  }
}

/**
 * Get all available reference objects (standard + custom)
 */
export function getAllReferenceObjects(): StandardReferenceObject[] {
  return [...STANDARD_OBJECTS, ...loadCustomObjects()];
}

/**
 * Delete custom reference object
 */
export function deleteCustomObject(objectId: string): void {
  const existing = loadCustomObjects();
  const updated = existing.filter(obj => obj.id !== objectId);
  localStorage.setItem(CUSTOM_OBJECTS_KEY, JSON.stringify(updated));
}
