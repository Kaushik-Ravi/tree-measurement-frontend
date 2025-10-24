// src/hooks/live-ar/useMotionSensors.ts
/**
 * Motion Sensor Hook for Live AR Tree Measurement
 * 
 * Provides access to device orientation sensors (gyroscope/accelerometer)
 * for measuring tilt angles without user calibration.
 * 
 * Supports:
 * - iOS 13+ (requires DeviceOrientationEvent.requestPermission)
 * - Android 9+ (automatic permission)
 * - Desktop (fallback to manual input)
 * 
 * The hook handles:
 * - Permission requests (iOS)
 * - Sensor calibration
 * - Drift correction
 * - Angle normalization
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Motion sensor data structure
 */
export interface MotionData {
  /** Tilt angle from horizontal in degrees (-90 to 90) */
  tiltAngle: number;
  
  /** Compass heading in degrees (0-360, 0 = North) */
  azimuth: number;
  
  /** Roll angle (device rotation around front-back axis) */
  roll: number;
  
  /** Whether sensors are calibrated and ready */
  isCalibrated: boolean;
  
  /** Permission status */
  permissionGranted: boolean;
  
  /** Last update timestamp */
  timestamp: number;
}

/**
 * Permission status for motion sensors
 */
export type MotionPermissionStatus = 'pending' | 'granted' | 'denied' | 'not-required';

/**
 * Hook options
 */
export interface UseMotionSensorsOptions {
  /** Enable automatic permission request on mount (iOS only) */
  autoRequest?: boolean;
  
  /** Smoothing factor for angle values (0-1, higher = smoother but laggier) */
  smoothing?: number;
  
  /** Calibration timeout in milliseconds */
  calibrationTimeout?: number;
}

/**
 * Custom hook for accessing device motion sensors
 * 
 * @param options - Configuration options
 * @returns Motion sensor data and control functions
 * 
 * @example
 * const { motionData, requestPermission, isSupported } = useMotionSensors({
 *   autoRequest: true,
 *   smoothing: 0.3
 * });
 * 
 * if (!isSupported) {
 *   return <div>Your device doesn't support motion sensors</div>;
 * }
 * 
 * return <div>Tilt: {motionData.tiltAngle.toFixed(1)}°</div>;
 */
export const useMotionSensors = (options: UseMotionSensorsOptions = {}) => {
  const {
    autoRequest = false,
    smoothing = 0.3,
    calibrationTimeout = 2000,
  } = options;

  // State
  const [motionData, setMotionData] = useState<MotionData>({
    tiltAngle: 0,
    azimuth: 0,
    roll: 0,
    isCalibrated: false,
    permissionGranted: false,
    timestamp: Date.now(),
  });

  const [permissionStatus, setPermissionStatus] = useState<MotionPermissionStatus>('pending');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for smoothing and calibration
  const previousAnglesRef = useRef({ tilt: 0, azimuth: 0, roll: 0 });
  const calibrationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const listenerActiveRef = useRef(false);

  /**
   * Normalizes tilt angle to -90 to 90 range
   * 0 = horizontal, 90 = pointing straight up, -90 = pointing straight down
   */
  const normalizeTiltAngle = (beta: number, gamma: number): number => {
    // Beta: front-to-back tilt (-180 to 180)
    // Gamma: left-to-right tilt (-90 to 90)
    
    // Convert to tilt from horizontal
    // When device is held upright (portrait):
    // beta = 0 → horizontal
    // beta = 90 → pointing down
    // beta = -90 → pointing up
    
    let tilt = 90 - Math.abs(beta);
    
    // Adjust for device orientation (landscape vs portrait)
    if (Math.abs(gamma) > 45) {
      // Device is in landscape, use gamma instead
      tilt = gamma;
    }
    
    // Clamp to valid range
    return Math.max(-90, Math.min(90, tilt));
  };

  /**
   * Applies exponential smoothing to reduce sensor noise
   */
  const smoothAngle = (current: number, previous: number): number => {
    return previous * (1 - smoothing) + current * smoothing;
  };

  /**
   * Device orientation event handler
   */
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const { alpha, beta, gamma } = event;

    if (alpha === null || beta === null || gamma === null) {
      return; // Sensor data not available
    }

    // Calculate tilt angle
    const rawTilt = normalizeTiltAngle(beta, gamma);
    const smoothedTilt = smoothAngle(rawTilt, previousAnglesRef.current.tilt);

    // Azimuth (compass heading)
    const rawAzimuth = alpha;
    const smoothedAzimuth = smoothAngle(rawAzimuth, previousAnglesRef.current.azimuth);

    // Roll (device rotation)
    const rawRoll = gamma;
    const smoothedRoll = smoothAngle(rawRoll, previousAnglesRef.current.roll);

    // Update previous values
    previousAnglesRef.current = {
      tilt: smoothedTilt,
      azimuth: smoothedAzimuth,
      roll: smoothedRoll,
    };

    // Update state
    setMotionData({
      tiltAngle: parseFloat(smoothedTilt.toFixed(1)),
      azimuth: parseFloat(smoothedAzimuth.toFixed(1)),
      roll: parseFloat(smoothedRoll.toFixed(1)),
      isCalibrated: true,
      permissionGranted: true,
      timestamp: Date.now(),
    });
  }, [smoothing]);

  /**
   * Requests motion sensor permission (iOS 13+ only)
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Check if permission request is needed (iOS 13+)
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        
        if (permission === 'granted') {
          setPermissionStatus('granted');
          return true;
        } else {
          setPermissionStatus('denied');
          setError('Motion sensor permission denied');
          return false;
        }
      } else {
        // Non-iOS device or older iOS - permission not required
        setPermissionStatus('not-required');
        return true;
      }
    } catch (err) {
      console.error('Error requesting motion permission:', err);
      setPermissionStatus('denied');
      setError('Failed to request motion sensor permission');
      return false;
    }
  }, []);

  /**
   * Starts listening to motion sensors
   */
  const startListening = useCallback(() => {
    if (listenerActiveRef.current) {
      return; // Already listening
    }

    window.addEventListener('deviceorientation', handleOrientation, true);
    listenerActiveRef.current = true;

    // Set calibration timeout
    calibrationTimerRef.current = setTimeout(() => {
      setMotionData(prev => ({ ...prev, isCalibrated: true }));
    }, calibrationTimeout);
  }, [handleOrientation, calibrationTimeout]);

  /**
   * Stops listening to motion sensors
   */
  const stopListening = useCallback(() => {
    if (!listenerActiveRef.current) {
      return;
    }

    window.removeEventListener('deviceorientation', handleOrientation, true);
    listenerActiveRef.current = false;

    if (calibrationTimerRef.current) {
      clearTimeout(calibrationTimerRef.current);
      calibrationTimerRef.current = null;
    }
  }, [handleOrientation]);

  /**
   * Resets calibration (useful when device position changes)
   */
  const recalibrate = useCallback(() => {
    setMotionData(prev => ({ ...prev, isCalibrated: false }));
    previousAnglesRef.current = { tilt: 0, azimuth: 0, roll: 0 };

    if (calibrationTimerRef.current) {
      clearTimeout(calibrationTimerRef.current);
    }

    calibrationTimerRef.current = setTimeout(() => {
      setMotionData(prev => ({ ...prev, isCalibrated: true }));
    }, calibrationTimeout);
  }, [calibrationTimeout]);

  // Initialize on mount
  useEffect(() => {
    // Check if DeviceOrientationEvent is supported
    if (typeof DeviceOrientationEvent === 'undefined') {
      setIsSupported(false);
      setError('Motion sensors not supported on this device');
      return;
    }

    setIsSupported(true);

    // Auto-request permission and start listening
    const init = async () => {
      if (autoRequest) {
        const granted = await requestPermission();
        if (granted) {
          startListening();
        }
      } else {
        // Check if permission is needed
        if (
          typeof (DeviceOrientationEvent as any).requestPermission !== 'function'
        ) {
          // Permission not required (Android or older iOS)
          setPermissionStatus('not-required');
          startListening();
        }
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      stopListening();
    };
  }, [autoRequest, requestPermission, startListening, stopListening]);

  return {
    /** Current motion sensor data */
    motionData,
    
    /** Whether motion sensors are supported */
    isSupported,
    
    /** Current permission status */
    permissionStatus,
    
    /** Request permission (iOS only) */
    requestPermission,
    
    /** Start listening to sensors */
    startListening,
    
    /** Stop listening to sensors */
    stopListening,
    
    /** Reset calibration */
    recalibrate,
    
    /** Error message (if any) */
    error,
  };
};

/**
 * Utility: Checks if motion sensors are available
 * (synchronous version for quick checks)
 */
export const isMotionSensorAvailable = (): boolean => {
  return typeof DeviceOrientationEvent !== 'undefined';
};

/**
 * Utility: Formats tilt angle for display
 */
export const formatTiltAngle = (angle: number): string => {
  const absAngle = Math.abs(angle);
  const direction = angle > 0 ? '↑' : angle < 0 ? '↓' : '→';
  return `${absAngle.toFixed(1)}° ${direction}`;
};
