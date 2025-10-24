// src/components/live-ar/LiveARMeasureView_v2.tsx
/**
 * Live AR Tree Measurement - REDESIGNED
 * 
 * CRITICAL FIXES:
 * 1. ✅ Live camera feed throughout entire flow
 * 2. ✅ No photo upload requirement
 * 3. ✅ Distance auto-populates to angle screens
 * 4. ✅ No conflict with WebXR (uses HTML5 video)
 * 5. ✅ Motion sensors work independently
 * 
 * Architecture:
 * - Uses getUserMedia() for camera (not WebXR)
 * - DeviceOrientation for angles (no WebXR conflict)
 * - Two-angle trigonometry for height (fast, accurate)
 * - SAM for species ID (future phase)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera, Check, RotateCcw, X, Ruler, TreePine, Loader2, 
  AlertCircle, Navigation, ChevronRight
} from 'lucide-react';
import { useMotionSensors } from '../../hooks/live-ar/useMotionSensors';
import {
  calculateTreeHeight,
  createMeasurement,
  validateMeasurement,
  type TreeMeasurement,
} from '../../utils/live-ar/trigonometry';

interface LiveARMeasureViewProps {
  /** Callback when measurement is complete */
  onMeasurementComplete: (height: number, measurement: TreeMeasurement) => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Optional: Pre-measured distance from AR ruler */
  initialDistance?: number;
}

type MeasurementState =
  | 'CAMERA_INIT'          // Starting camera
  | 'WELCOME'              // Show welcome instructions
  | 'DISTANCE_INPUT'       // Get distance (AR or manual)
  | 'CAPTURING_BASE'       // Aim at tree base
  | 'CAPTURING_TOP'        // Aim at tree top
  | 'MEASUREMENT_COMPLETE' // Show results
  | 'ERROR';              // Error state

export const LiveARMeasureView: React.FC<LiveARMeasureViewProps> = ({
  onMeasurementComplete,
  onCancel,
  initialDistance,
}) => {
  // --- STATE ---
  const [state, setState] = useState<MeasurementState>('CAMERA_INIT');
  const [distance, setDistance] = useState<number | null>(initialDistance || null);
  const [manualDistanceInput, setManualDistanceInput] = useState(
    initialDistance?.toString() || ''
  );
  const [angleToBase, setAngleToBase] = useState<number | null>(null);
  const [angleToTopValue, setAngleToTopValue] = useState<number | null>(null);
  const [measurement, setMeasurement] = useState<TreeMeasurement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- REFS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- HOOKS ---
  const {
    motionData,
    permissionStatus,
    requestPermission,
  } = useMotionSensors({ autoRequest: false, smoothing: 0.3 });

  // --- CAMERA SETUP ---
  /**
   * Initialize camera feed (HTML5 getUserMedia, NOT WebXR)
   * This prevents conflicts with motion sensors
   */
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setState('WELCOME');
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please enable camera access.'
          : 'Could not access camera. Make sure no other app is using it.'
      );
      setState('ERROR');
    }
  }, []);

  /**
   * Cleanup camera when component unmounts
   */
  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  // --- MOTION SENSOR SETUP ---
  /**
   * Request motion sensor permission (iOS requires explicit request)
   */
  const handleRequestSensors = useCallback(async () => {
    try {
      await requestPermission();
      // Permission granted, proceed to distance input
      setState('DISTANCE_INPUT');
    } catch (err: any) {
      setError('Motion sensors required for angle measurement. Please grant permission.');
      setState('ERROR');
    }
  }, [requestPermission]);

  // --- MEASUREMENT LOGIC ---
  /**
   * Lock base angle
   */
  const handleLockBase = useCallback(() => {
    if (motionData.tiltAngle === null) {
      setError('Unable to read tilt angle. Make sure sensors are active.');
      return;
    }

    setAngleToBase(motionData.tiltAngle);
    setState('CAPTURING_TOP');
  }, [motionData.tiltAngle]);

  /**
   * Lock top angle and calculate height
   */
  const handleLockTop = useCallback(() => {
    if (motionData.tiltAngle === null || angleToBase === null || distance === null) {
      setError('Missing required data for calculation.');
      return;
    }

    const angleTop = motionData.tiltAngle;
    setAngleToTopValue(angleTop);

    // Calculate height using two-angle trigonometry
    const height = calculateTreeHeight(distance, angleTop, angleToBase);
    const treeMeasurement = createMeasurement(distance, angleTop, angleToBase);

    // Validate measurement
    if (!validateMeasurement(treeMeasurement)) {
      setError(
        `Low confidence (${(treeMeasurement.confidence * 100).toFixed(0)}%). Try adjusting distance (5-20m ideal) or angles.`
      );
      setMeasurement(treeMeasurement); // Still show it
      setState('MEASUREMENT_COMPLETE');
      return;
    }

    setMeasurement(treeMeasurement);
    setState('MEASUREMENT_COMPLETE');
  }, [motionData.tiltAngle, angleToBase, distance]);

  /**
   * Retry measurement
   */
  const handleRetry = useCallback(() => {
    setAngleToBase(null);
    setAngleToTopValue(null);
    setMeasurement(null);
    setError(null);
    setState('DISTANCE_INPUT');
  }, []);

  /**
   * Confirm and use measurement
   */
  const handleConfirm = useCallback(() => {
    if (measurement) {
      onMeasurementComplete(measurement.height, measurement);
    }
  }, [measurement, onMeasurementComplete]);

  /**
   * Handle manual distance input
   */
  const handleDistanceSubmit = useCallback(() => {
    const dist = parseFloat(manualDistanceInput);
    if (isNaN(dist) || dist <= 0) {
      setError('Please enter a valid distance greater than 0');
      return;
    }

    setDistance(dist);
    setError(null);

    // Request motion sensors before proceeding
    if (permissionStatus !== 'granted') {
      handleRequestSensors();
    } else {
      setState('CAPTURING_BASE');
    }
  }, [manualDistanceInput, permissionStatus, handleRequestSensors]);

  // --- ANGLE INDICATOR VISUALIZATION ---
  /**
   * Visual feedback for angle alignment
   */
  const renderAngleIndicator = () => {
    if (!motionData.tiltAngle) return null;

    const angle = motionData.tiltAngle;
    const isGoodAngle = Math.abs(angle) > 5 && Math.abs(angle) < 75;

    return (
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
        {/* Crosshair */}
        <div className="relative w-64 h-64">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/50"></div>
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/50"></div>
          
          {/* Angle arc */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 256 256">
            <circle
              cx="128"
              cy="128"
              r="80"
              fill="none"
              stroke={isGoodAngle ? '#10B981' : '#EF4444'}
              strokeWidth="4"
              strokeDasharray="5,5"
              className="opacity-60"
            />
            {/* Angle line */}
            <line
              x1="128"
              y1="128"
              x2={128 + Math.cos((angle * Math.PI) / 180) * 80}
              y2={128 - Math.sin((angle * Math.PI) / 180) * 80}
              stroke={isGoodAngle ? '#10B981' : '#FBBF24'}
              strokeWidth="3"
              className="drop-shadow-lg"
            />
          </svg>

          {/* Angle display */}
          <div
            className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-6 py-3 rounded-full ${
              isGoodAngle
                ? 'bg-green-500/90'
                : 'bg-yellow-500/90'
            } text-white font-mono text-2xl font-bold shadow-lg`}
          >
            {angle.toFixed(1)}°
          </div>
        </div>
      </div>
    );
  };

  // --- RENDER STATES ---

  /**
   * Camera initialization / loading state
   */
  if (state === 'CAMERA_INIT') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg">Starting camera...</p>
        </div>
      </div>
    );
  }

  /**
   * Error state
   */
  if (state === 'ERROR') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50 p-6">
        <div className="max-w-md bg-red-500/10 border border-red-500 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error</h2>
          <p className="text-red-200 mb-4">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setError(null);
                setState('WELCOME');
              }}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* --- CAMERA FEED (ALWAYS VISIBLE) --- */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* --- DARK OVERLAY --- */}
      <div className="absolute inset-0 bg-black/30 z-10"></div>

      {/* --- HEADER --- */}
      <div className="relative z-20 flex justify-between items-center p-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-6 h-6" />
          <h1 className="text-lg font-semibold">Live AR Measurement</h1>
        </div>
        <button
          onClick={onCancel}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* --- ANGLE INDICATOR (for base/top capture) --- */}
      {(state === 'CAPTURING_BASE' || state === 'CAPTURING_TOP') && renderAngleIndicator()}

      {/* --- STATE-SPECIFIC UI --- */}
      <div className="relative z-20 flex-1 flex items-end pb-safe">
        {/* WELCOME */}
        {state === 'WELCOME' && (
          <div className="w-full p-6 bg-gradient-to-t from-black/90 via-black/80 to-transparent text-white">
            <div className="max-w-md mx-auto">
              <div className="bg-gradient-to-br from-green-500 to-blue-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <TreePine className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-2">
                Measure Trees in Real-Time
              </h2>
              <p className="text-center text-gray-300 mb-6">
                Use your phone's sensors to measure tree height instantly - no calibration
                needed!
              </p>

              <div className="bg-white/10 rounded-lg p-4 mb-6 space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-yellow-400" />
                  How it works:
                </h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-start gap-3">
                    <div className="bg-green-500 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      1
                    </div>
                    <p>Measure distance to tree (AR or manual)</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-green-500 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      2
                    </div>
                    <p>Point phone at tree BASE and lock angle</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-green-500 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      3
                    </div>
                    <p>Point phone at tree TOP and lock angle</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-green-500 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      4
                    </div>
                    <p>Height calculated instantly!</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setState('DISTANCE_INPUT')}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Start Measurement
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* DISTANCE INPUT */}
        {state === 'DISTANCE_INPUT' && (
          <div className="w-full p-6 bg-gradient-to-t from-black/90 via-black/80 to-transparent text-white">
            <div className="max-w-md mx-auto">
              <div className="bg-yellow-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ruler className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-center mb-2">Distance to Tree</h2>
              <p className="text-center text-gray-300 mb-6 text-sm">
                Measure or estimate the distance from where you're standing to the tree's
                base
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Distance (meters)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualDistanceInput}
                    onChange={(e) => setManualDistanceInput(e.target.value)}
                    placeholder="e.g., 10.5"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Recommended: 5-20 meters for best accuracy
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleDistanceSubmit}
                  disabled={!manualDistanceInput || parseFloat(manualDistanceInput) <= 0}
                  className="w-full py-3 bg-green-500 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CAPTURING BASE ANGLE */}
        {state === 'CAPTURING_BASE' && (
          <div className="w-full p-6 bg-gradient-to-t from-black/90 via-black/70 to-transparent text-white">
            <div className="max-w-md mx-auto text-center">
              <div className="mb-4">
                <div className="inline-block bg-blue-500/20 px-4 py-2 rounded-full text-sm font-medium mb-2">
                  Distance: {distance?.toFixed(1)}m
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Step 1: Tree Base</h2>
              <p className="text-gray-300 mb-6">
                Point your phone camera at the very bottom of the tree trunk
              </p>

              {motionData.tiltAngle !== null && (
                <div className="bg-white/10 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-300 mb-2">Current Angle:</p>
                  <p className="text-4xl font-mono font-bold">
                    {motionData.tiltAngle.toFixed(1)}°
                  </p>
                  {Math.abs(motionData.tiltAngle) < 5 && (
                    <p className="text-yellow-400 text-sm mt-2">
                      Tip: Tilt phone down more for better accuracy
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handleLockBase}
                disabled={motionData.tiltAngle === null}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-6 h-6" />
                Lock Base Angle
              </button>
            </div>
          </div>
        )}

        {/* CAPTURING TOP ANGLE */}
        {state === 'CAPTURING_TOP' && (
          <div className="w-full p-6 bg-gradient-to-t from-black/90 via-black/70 to-transparent text-white">
            <div className="max-w-md mx-auto text-center">
              <div className="mb-4">
                <div className="inline-block bg-green-500/20 px-4 py-2 rounded-full text-sm font-medium mb-2">
                  Base Angle: {angleToBase?.toFixed(1)}° ✓
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Step 2: Tree Top</h2>
              <p className="text-gray-300 mb-6">
                Point your phone camera at the highest point of the tree
              </p>

              {motionData.tiltAngle !== null && (
                <div className="bg-white/10 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-300 mb-2">Current Angle:</p>
                  <p className="text-4xl font-mono font-bold">
                    {motionData.tiltAngle.toFixed(1)}°
                  </p>
                  {motionData.tiltAngle < 10 && (
                    <p className="text-yellow-400 text-sm mt-2">
                      Tip: Tilt phone up more to see tree top
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleLockTop}
                  disabled={motionData.tiltAngle === null}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check className="w-6 h-6" />
                  Lock Top Angle
                </button>

                <button
                  onClick={() => {
                    setAngleToBase(null);
                    setState('CAPTURING_BASE');
                  }}
                  className="w-full py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry Base Angle
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MEASUREMENT COMPLETE */}
        {state === 'MEASUREMENT_COMPLETE' && measurement && (
          <div className="w-full p-6 bg-gradient-to-t from-black/90 via-black/80 to-transparent text-white">
            <div className="max-w-md mx-auto">
              <div className="bg-gradient-to-br from-green-500 to-blue-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-2">
                Measurement Complete
              </h2>

              {/* TREE HEIGHT */}
              <div className="bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-white/20 rounded-lg p-6 mb-4 text-center">
                <p className="text-7xl font-mono font-bold mb-2">
                  {measurement.height.toFixed(2)}m
                </p>
                <p className="text-gray-300">Tree Height</p>
              </div>

              {/* MEASUREMENT DETAILS */}
              <div className="bg-white/10 rounded-lg p-4 mb-4 space-y-3">
                <h3 className="font-semibold mb-2">Measurement Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400">Distance</p>
                    <p className="font-mono font-bold">{measurement.distance.toFixed(1)}m</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Confidence</p>
                    <p
                      className={`font-mono font-bold ${
                        measurement.confidence >= 0.7
                          ? 'text-green-400'
                          : measurement.confidence >= 0.5
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}
                    >
                      {(measurement.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Base Angle</p>
                    <p className="font-mono font-bold">
                      {measurement.angleToBase.toFixed(1)}°
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Top Angle</p>
                    <p className="font-mono font-bold">
                      {measurement.angleToTop.toFixed(1)}°
                    </p>
                  </div>
                </div>
              </div>

              {/* CONFIDENCE WARNING */}
              {measurement.confidence < 0.7 && (
                <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-3 mb-4 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-yellow-400">
                        Confidence below optimal
                      </p>
                      <p className="text-yellow-200">
                        Consider retrying with adjusted distance or angles for better
                        accuracy.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTIONS */}
              <div className="space-y-3">
                <button
                  onClick={handleConfirm}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Check className="w-6 h-6" />
                  Use This Measurement
                </button>

                <button
                  onClick={handleRetry}
                  className="w-full py-2 bg-white/10 rounded-lg hover:bg-white/20 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Retry Measurement
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
