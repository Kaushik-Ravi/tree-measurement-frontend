// src/utils/cameraCalibration.ts
/**
 * Phase 6: 3-Tier Camera Calibration System
 * 
 * Tier 1: Silent EXIF extraction from photos (best accuracy)
 * Tier 2: MediaStream getSettings() API (good accuracy)
 * Tier 3: A4 paper calibration fallback (user-assisted)
 * 
 * Stores calibration data in localStorage per device
 */

import * as ExifReader from 'exifreader';

const CALIBRATION_STORAGE_KEY = 'treeMeasurement_cameraCalibration';
const DEVICE_ID_KEY = 'treeMeasurement_deviceId';

export interface CameraCalibration {
  focalLength35mm: number | null; // Focal length in 35mm equivalent
  fovHorizontal: number | null; // Field of view in degrees
  fovVertical: number | null; // Vertical FOV in degrees
  sensorWidth: number | null; // Sensor width in mm
  sensorHeight: number | null; // Sensor height in mm
  imageWidth: number; // Image resolution width
  imageHeight: number; // Image resolution height
  calibrationMethod: 'exif' | 'api' | 'manual' | 'none';
  deviceId: string; // Unique device identifier
  timestamp: number; // When calibration was performed
}

/**
 * Generate a unique device identifier based on user agent and screen
 */
function generateDeviceId(): string {
  const nav = navigator.userAgent;
  const screen = `${window.screen.width}x${window.screen.height}`;
  const hash = btoa(`${nav}_${screen}`).substring(0, 16);
  return hash;
}

/**
 * Get or create device ID
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Load saved calibration for current device
 */
export function loadSavedCalibration(): CameraCalibration | null {
  const deviceId = getDeviceId();
  const saved = localStorage.getItem(CALIBRATION_STORAGE_KEY);
  
  if (!saved) return null;
  
  try {
    const calibrations: CameraCalibration[] = JSON.parse(saved);
    const deviceCalibration = calibrations.find(c => c.deviceId === deviceId);
    
    if (deviceCalibration) {
      console.log('[Calibration] Loaded saved calibration:', deviceCalibration.calibrationMethod);
      return deviceCalibration;
    }
  } catch (error) {
    console.error('[Calibration] Error loading saved calibration:', error);
  }
  
  return null;
}

/**
 * Save calibration for current device
 */
export function saveCalibration(calibration: CameraCalibration): void {
  const saved = localStorage.getItem(CALIBRATION_STORAGE_KEY);
  let calibrations: CameraCalibration[] = [];
  
  if (saved) {
    try {
      calibrations = JSON.parse(saved);
    } catch (error) {
      console.error('[Calibration] Error parsing saved calibrations:', error);
    }
  }
  
  // Remove old calibration for this device
  calibrations = calibrations.filter(c => c.deviceId !== calibration.deviceId);
  
  // Add new calibration
  calibrations.push(calibration);
  
  // Keep only last 5 devices
  if (calibrations.length > 5) {
    calibrations = calibrations.slice(-5);
  }
  
  localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(calibrations));
  console.log('[Calibration] Saved calibration:', calibration.calibrationMethod);
}

/**
 * Tier 1: Extract camera intrinsics from photo EXIF data
 */
export async function extractCameraIntrinsicsFromPhoto(imageFile: File): Promise<Partial<CameraCalibration> | null> {
  try {
    const arrayBuffer = await imageFile.arrayBuffer();
    const tags = ExifReader.load(arrayBuffer);
    
    console.log('[Calibration Tier 1] EXIF tags found:', Object.keys(tags));
    
    // Extract focal length
    let focalLength35mm: number | null = null;
    const focalLengthIn35mm = tags['FocalLengthIn35mmFilm']?.value;
    const rawFocalLength = tags['FocalLength']?.value;
    const scaleFactor35 = tags['ScaleFactor35efl']?.value;
    
    if (typeof focalLengthIn35mm === 'number') {
      focalLength35mm = focalLengthIn35mm;
    } else if (typeof rawFocalLength === 'number' && typeof scaleFactor35 === 'number') {
      focalLength35mm = rawFocalLength * scaleFactor35;
    }
    
    // Extract image dimensions
    const imageWidth = tags['Image Width']?.value || tags['PixelXDimension']?.value;
    const imageHeight = tags['Image Height']?.value || tags['PixelYDimension']?.value;
    
    // Calculate FOV if we have focal length and sensor info
    let fovHorizontal: number | null = null;
    let fovVertical: number | null = null;
    
    if (focalLength35mm) {
      // For 35mm equivalent, sensor is 36mm x 24mm
      const sensor35mmWidth = 36;
      const sensor35mmHeight = 24;
      
      // Calculate FOV using focal length
      fovHorizontal = 2 * Math.atan(sensor35mmWidth / (2 * focalLength35mm)) * (180 / Math.PI);
      fovVertical = 2 * Math.atan(sensor35mmHeight / (2 * focalLength35mm)) * (180 / Math.PI);
    }
    
    if (focalLength35mm && imageWidth && imageHeight) {
      console.log('[Calibration Tier 1] Success - Focal length:', focalLength35mm, 'FOV:', fovHorizontal);
      
      return {
        focalLength35mm,
        fovHorizontal,
        fovVertical,
        sensorWidth: 36, // 35mm equivalent
        sensorHeight: 24,
        imageWidth: typeof imageWidth === 'number' ? imageWidth : parseInt(imageWidth as string),
        imageHeight: typeof imageHeight === 'number' ? imageHeight : parseInt(imageHeight as string),
        calibrationMethod: 'exif',
        deviceId: getDeviceId(),
        timestamp: Date.now()
      };
    }
    
    console.log('[Calibration Tier 1] Insufficient EXIF data');
    return null;
    
  } catch (error) {
    console.error('[Calibration Tier 1] Error extracting EXIF:', error);
    return null;
  }
}

/**
 * Tier 2: Get camera intrinsics from MediaStream API
 */
export async function extractCameraIntrinsicsFromStream(stream: MediaStream): Promise<Partial<CameraCalibration> | null> {
  try {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      console.log('[Calibration Tier 2] No video track found');
      return null;
    }
    
    const settings = videoTrack.getSettings();
    console.log('[Calibration Tier 2] Video track settings:', settings);
    
    const imageWidth = settings.width;
    const imageHeight = settings.height;
    
    // Some browsers provide focal length directly
    const focalLength = (settings as any).focalLength;
    
    if (focalLength && imageWidth && imageHeight) {
      // Calculate FOV from focal length
      // Assuming standard smartphone sensor (~5.5mm diagonal)
      const sensorDiagonal = 5.5; // mm (typical smartphone)
      const aspectRatio = imageWidth / imageHeight;
      const sensorHeight = sensorDiagonal / Math.sqrt(1 + aspectRatio * aspectRatio);
      const sensorWidth = sensorHeight * aspectRatio;
      
      const fovHorizontal = 2 * Math.atan(sensorWidth / (2 * focalLength)) * (180 / Math.PI);
      const fovVertical = 2 * Math.atan(sensorHeight / (2 * focalLength)) * (180 / Math.PI);
      
      // Convert to 35mm equivalent
      const focalLength35mm = focalLength * (36 / sensorWidth);
      
      console.log('[Calibration Tier 2] Success - Focal length:', focalLength35mm, 'FOV:', fovHorizontal);
      
      return {
        focalLength35mm,
        fovHorizontal,
        fovVertical,
        sensorWidth,
        sensorHeight,
        imageWidth,
        imageHeight,
        calibrationMethod: 'api',
        deviceId: getDeviceId(),
        timestamp: Date.now()
      };
    }
    
    // Fallback: estimate FOV from resolution (rough approximation)
    if (imageWidth && imageHeight) {
      // Typical smartphone camera FOV: 60-75 degrees horizontal
      const estimatedFovHorizontal = 70; // degrees (conservative estimate)
      const aspectRatio = imageWidth / imageHeight;
      const estimatedFovVertical = 2 * Math.atan(Math.tan((estimatedFovHorizontal * Math.PI / 180) / 2) / aspectRatio) * (180 / Math.PI);
      
      console.log('[Calibration Tier 2] Using estimated FOV:', estimatedFovHorizontal);
      
      return {
        focalLength35mm: null,
        fovHorizontal: estimatedFovHorizontal,
        fovVertical: estimatedFovVertical,
        sensorWidth: null,
        sensorHeight: null,
        imageWidth,
        imageHeight,
        calibrationMethod: 'api',
        deviceId: getDeviceId(),
        timestamp: Date.now()
      };
    }
    
    console.log('[Calibration Tier 2] Insufficient data from stream');
    return null;
    
  } catch (error) {
    console.error('[Calibration Tier 2] Error extracting from stream:', error);
    return null;
  }
}

/**
 * Tier 3: Manual calibration using A4 paper reference
 */
export function calculateCalibrationFromA4Paper(
  paperPixelWidth: number,
  imageWidth: number,
  imageHeight: number,
  distanceToCamera: number = 1.0 // meters
): Partial<CameraCalibration> {
  // A4 paper width: 210mm = 0.21m
  const A4_WIDTH_METERS = 0.21;
  
  // Calculate focal length in pixels
  const focalLengthPixels = (paperPixelWidth * distanceToCamera) / A4_WIDTH_METERS;
  
  // Calculate FOV
  const fovHorizontal = 2 * Math.atan(imageWidth / (2 * focalLengthPixels)) * (180 / Math.PI);
  const fovVertical = 2 * Math.atan(imageHeight / (2 * focalLengthPixels)) * (180 / Math.PI);
  
  // Estimate 35mm equivalent focal length
  // Assuming typical smartphone sensor width ~5.5mm
  const estimatedSensorWidth = 5.5;
  const focalLength35mm = (focalLengthPixels / imageWidth) * estimatedSensorWidth * (36 / estimatedSensorWidth);
  
  console.log('[Calibration Tier 3] Manual calibration - FOV:', fovHorizontal, 'Focal length:', focalLength35mm);
  
  return {
    focalLength35mm,
    fovHorizontal,
    fovVertical,
    sensorWidth: estimatedSensorWidth,
    sensorHeight: estimatedSensorWidth * (imageHeight / imageWidth),
    imageWidth,
    imageHeight,
    calibrationMethod: 'manual',
    deviceId: getDeviceId(),
    timestamp: Date.now()
  };
}

/**
 * Auto-calibrate: Try all tiers in sequence
 */
export async function autoCalibrate(
  imageFile?: File,
  stream?: MediaStream
): Promise<CameraCalibration> {
  // Try Tier 1: EXIF extraction from photo
  if (imageFile) {
    const exifCalibration = await extractCameraIntrinsicsFromPhoto(imageFile);
    if (exifCalibration && exifCalibration.focalLength35mm) {
      const fullCalibration: CameraCalibration = {
        focalLength35mm: null,
        fovHorizontal: null,
        fovVertical: null,
        sensorWidth: null,
        sensorHeight: null,
        imageWidth: 1920,
        imageHeight: 1080,
        calibrationMethod: 'none',
        deviceId: getDeviceId(),
        timestamp: Date.now(),
        ...exifCalibration
      };
      saveCalibration(fullCalibration);
      return fullCalibration;
    }
  }
  
  // Try Tier 2: MediaStream API
  if (stream) {
    const apiCalibration = await extractCameraIntrinsicsFromStream(stream);
    if (apiCalibration && (apiCalibration.focalLength35mm || apiCalibration.fovHorizontal)) {
      const fullCalibration: CameraCalibration = {
        focalLength35mm: null,
        fovHorizontal: null,
        fovVertical: null,
        sensorWidth: null,
        sensorHeight: null,
        imageWidth: 1920,
        imageHeight: 1080,
        calibrationMethod: 'none',
        deviceId: getDeviceId(),
        timestamp: Date.now(),
        ...apiCalibration
      };
      saveCalibration(fullCalibration);
      return fullCalibration;
    }
  }
  
  // Fallback: Use default calibration (needs manual calibration later)
  console.log('[Calibration] Using default calibration - manual calibration recommended');
  const defaultCalibration: CameraCalibration = {
    focalLength35mm: 28, // Common smartphone focal length
    fovHorizontal: 70, // Conservative estimate
    fovVertical: 55,
    sensorWidth: null,
    sensorHeight: null,
    imageWidth: 1920,
    imageHeight: 1080,
    calibrationMethod: 'none',
    deviceId: getDeviceId(),
    timestamp: Date.now()
  };
  
  return defaultCalibration;
}

/**
 * Calculate FOV ratio for distance calculations
 */
export function calculateFOVRatio(calibration: CameraCalibration): number {
  if (calibration.fovHorizontal) {
    // Convert FOV to radians and calculate ratio
    const fovRadians = (calibration.fovHorizontal * Math.PI) / 180;
    return Math.tan(fovRadians / 2);
  }
  
  if (calibration.focalLength35mm) {
    // Calculate from focal length (35mm equivalent)
    const sensor35mmWidth = 36; // mm
    const fovRadians = 2 * Math.atan(sensor35mmWidth / (2 * calibration.focalLength35mm));
    return Math.tan(fovRadians / 2);
  }
  
  // Default fallback
  console.warn('[Calibration] No FOV data available, using default ratio');
  return 0.5773; // tan(60° / 2) - conservative default
}
