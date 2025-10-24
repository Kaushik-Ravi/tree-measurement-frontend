// src/config/featureFlags.ts
/**
 * Feature Flag System for Elite Tree Measurement App
 * 
 * This centralized configuration controls the rollout of new features
 * across the application. Feature flags allow us to:
 * - Deploy code without activating features
 * - Gradually roll out features to users
 * - Quickly disable features if issues arise
 * - A/B test new functionality
 */

export const FeatureFlags = {
  /**
   * Live AR Tree Measurement Mode
   * 
   * Enables real-time tree measurement using:
   * - Two-angle trigonometry (base + top)
   * - WebXR plane detection for distance
   * - Device motion sensors (gyroscope)
   * - SAM-powered species identification
   * 
   * When disabled, users will only see the existing photo upload workflow.
   * 
   * Default: false (manual activation required)
   * Enable via: localStorage.setItem('ENABLE_LIVE_AR', 'true')
   */
  LIVE_AR_MODE: import.meta.env.VITE_ENABLE_LIVE_AR === 'true' || 
                localStorage.getItem('ENABLE_LIVE_AR') === 'true',

  /**
   * Debug Mode
   * Enables additional logging and developer tools
   */
  DEBUG_MODE: import.meta.env.DEV,
} as const;

/**
 * Device Capability Detection
 * Determines what features the current device supports
 */
export interface DeviceCapabilities {
  hasWebXR: boolean;
  hasGyroscope: boolean;
  hasCameraAccess: boolean;
  hasWebGL: boolean;
  hasGeolocation: boolean;
}

/**
 * Detects all required device capabilities for Live AR mode
 * @returns Promise<DeviceCapabilities>
 */
export const detectDeviceCapabilities = async (): Promise<DeviceCapabilities> => {
  const capabilities: DeviceCapabilities = {
    hasWebXR: false,
    hasGyroscope: false,
    hasCameraAccess: false,
    hasWebGL: false,
    hasGeolocation: false,
  };

  // Check WebXR support (best AR experience)
  if ('xr' in navigator && navigator.xr) {
    try {
      capabilities.hasWebXR = await navigator.xr.isSessionSupported('immersive-ar');
    } catch (error) {
      console.warn('WebXR check failed:', error);
    }
  }

  // Check gyroscope/orientation sensors
  if ('DeviceOrientationEvent' in window) {
    capabilities.hasGyroscope = true;
  }

  // Check camera access
  if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
    capabilities.hasCameraAccess = true;
  }

  // Check WebGL support (required for TensorFlow.js)
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  capabilities.hasWebGL = !!gl;

  // Check geolocation
  capabilities.hasGeolocation = 'geolocation' in navigator;

  return capabilities;
};

/**
 * Determines the best measurement mode based on device capabilities
 * @param capabilities - Device capability object
 * @returns 'full-ar' | 'gyroscope-only' | 'photo-upload'
 */
export const decideMeasurementMode = (capabilities: DeviceCapabilities): 'full-ar' | 'gyroscope-only' | 'photo-upload' => {
  // Full AR mode: WebXR + Gyroscope (best experience)
  if (capabilities.hasWebXR && capabilities.hasGyroscope && capabilities.hasWebGL) {
    return 'full-ar';
  }

  // Gyroscope-only mode: Manual distance input + angle measurement
  if (capabilities.hasGyroscope && capabilities.hasCameraAccess && capabilities.hasWebGL) {
    return 'gyroscope-only';
  }

  // Fallback: Existing photo upload workflow
  return 'photo-upload';
};

/**
 * Checks if Live AR mode should be shown to the user
 * @returns Promise<boolean>
 */
export const shouldShowLiveAR = async (): Promise<boolean> => {
  if (!FeatureFlags.LIVE_AR_MODE) {
    return false;
  }

  const capabilities = await detectDeviceCapabilities();
  const mode = decideMeasurementMode(capabilities);

  // Show Live AR if device supports at least gyroscope mode
  return mode === 'full-ar' || mode === 'gyroscope-only';
};

/**
 * Manual feature flag toggle (for testing/debugging)
 * Call this from browser console to enable/disable features
 */
export const toggleLiveAR = (enabled: boolean) => {
  localStorage.setItem('ENABLE_LIVE_AR', enabled ? 'true' : 'false');
  window.location.reload(); // Reload to apply changes
};

// Make toggle available in console for testing
if (typeof window !== 'undefined' && FeatureFlags.DEBUG_MODE) {
  (window as any).toggleLiveAR = toggleLiveAR;
  console.log('🔧 Debug mode active. Use toggleLiveAR(true/false) to test Live AR feature.');
}
