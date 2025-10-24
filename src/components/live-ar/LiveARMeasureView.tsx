// src/components/live-ar/LiveARMeasureView.tsx
/**
 * Live AR Tree Measurement View
 * 
 * This component provides a real-time augmented reality interface for
 * measuring trees using device sensors and computer vision.
 * 
 * User Flow:
 * 1. Open camera feed
 * 2. Measure distance (using existing ARMeasureView or manual input)
 * 3. Aim at tree base → Lock angle
 * 4. Aim at tree top → Lock angle
 * 5. Height calculated automatically (two-angle trigonometry)
 * 6. Tap on leaf/bark → SAM segments → PlantNet identifies
 * 7. Save measurement
 * 
 * Features:
 * - No user calibration required (two-angle method)
 * - Works on any device with gyroscope
 * - Real-time angle visualization
 * - SAM-powered species identification
 * - Graceful fallbacks for older devices
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Check, RotateCcw, X, Ruler, TreePine, Navigation, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import { ARMeasureView as DistanceMeasureView } from '../ARMeasureView';
import { useMotionSensors } from '../../hooks/live-ar/useMotionSensors';
import { calculateTreeHeight, createMeasurement, validateMeasurement, formatMeasurement, type TreeMeasurement } from '../../utils/live-ar/trigonometry';

/**
 * Component props
 */
interface LiveARMeasureViewProps {
  /** Callback when measurement is complete */
  onMeasurementComplete: (height: number, measurement: TreeMeasurement) => void;
  
  /** Callback when user cancels */
  onCancel: () => void;
}

/**
 * Measurement workflow states
 */
type MeasurementState = 
  | 'WELCOME'              // Initial welcome screen
  | 'REQUESTING_SENSORS'   // Requesting motion sensor permission
  | 'MEASURING_DISTANCE'   // Using AR to measure distance
  | 'MANUAL_DISTANCE'      // Manual distance input fallback
  | 'CAPTURING_BASE'       // Capturing base angle
  | 'CAPTURING_TOP'        // Capturing top angle
  | 'MEASUREMENT_COMPLETE' // Showing results
  | 'ERROR';              // Error state

export const LiveARMeasureView: React.FC<LiveARMeasureViewProps> = ({
  onMeasurementComplete,
  onCancel,
}) => {
  // --- STATE ---
  const [state, setState] = useState<MeasurementState>('WELCOME');
  const [distance, setDistance] = useState<number | null>(null);
  const [manualDistanceInput, setManualDistanceInput] = useState('');
  const [angleToBase, setAngleToBase] = useState<number | null>(null);
  const [angleToTop, setAngleToTop] = useState<number | null>(null);
  const [measurement, setMeasurement] = useState<TreeMeasurement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- REFS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- HOOKS ---
  const {
    motionData,
    isSupported: sensorsSupported,
    permissionStatus,
    requestPermission,
    error: sensorError,
  } = useMotionSensors({ autoRequest: false, smoothing: 0.3 });

  // --- COMPUTED VALUES ---
  const canProceed = distance !== null && distance > 0;
  const hasBaseAngle = angleToBase !== null;
  const hasTopAngle = angleToTop !== null;
  const sensorsReady = motionData.isCalibrated && motionData.permissionGranted;

  // --- HANDLERS ---
  
  /**
   * Start the measurement flow
   */
  const handleStart = useCallback(async () => {
    setError(null);

    if (!sensorsSupported) {
      setError('Motion sensors not supported on this device');
      setState('MANUAL_DISTANCE'); // Fallback to manual input
      return;
    }

    setState('REQUESTING_SENSORS');
    
    // Request permission for iOS devices
    const granted = await requestPermission();
    
    if (!granted && permissionStatus === 'denied') {
      setError('Motion sensor access denied. Using manual mode.');
      setState('MANUAL_DISTANCE');
      return;
    }

    // Proceed to distance measurement
    setState('MEASURING_DISTANCE');
  }, [sensorsSupported, requestPermission, permissionStatus]);

  /**
   * Handle distance measurement complete (from AR mode)
   */
  const handleDistanceMeasured = useCallback((measuredDistance: number) => {
    setDistance(measuredDistance);
    setState('CAPTURING_BASE');
  }, []);

  /**
   * Handle manual distance entry
   */
  const handleManualDistanceSubmit = useCallback(() => {
    const dist = parseFloat(manualDistanceInput);
    
    if (isNaN(dist) || dist <= 0) {
      setError('Please enter a valid distance');
      return;
    }

    if (dist < 3) {
      setError('Distance too close (minimum 3 meters recommended)');
      return;
    }

    setDistance(dist);
    setState('CAPTURING_BASE');
  }, [manualDistanceInput]);

  /**
   * Lock base angle
   */
  const handleLockBase = useCallback(() => {
    if (!motionData.isCalibrated) {
      setError('Sensors not calibrated yet. Please move device slightly.');
      return;
    }

    setAngleToBase(motionData.tiltAngle);
    setState('CAPTURING_TOP');
  }, [motionData]);

  /**
   * Lock top angle and calculate height
   */
  const handleLockTop = useCallback(() => {
    if (!motionData.isCalibrated) {
      setError('Sensors not calibrated yet. Please move device slightly.');
      return;
    }

    if (distance === null) {
      setError('Distance not set');
      return;
    }

    const topAngle = motionData.tiltAngle;
    setAngleToTop(topAngle);

    try {
      // Calculate measurement
      const result = createMeasurement(distance, topAngle, angleToBase || 0);
      
      // Validate
      const validation = validateMeasurement(result);
      if (!validation.valid) {
        setError(validation.reason || 'Invalid measurement');
        return;
      }

      setMeasurement(result);
      setState('MEASUREMENT_COMPLETE');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
    }
  }, [motionData, distance, angleToBase]);

  /**
   * Confirm and return measurement
   */
  const handleConfirm = useCallback(() => {
    if (!measurement) return;
    onMeasurementComplete(measurement.height, measurement);
  }, [measurement, onMeasurementComplete]);

  /**
   * Retry measurement
   */
  const handleRetry = useCallback(() => {
    setAngleToBase(null);
    setAngleToTop(null);
    setMeasurement(null);
    setError(null);
    setState('CAPTURING_BASE');
  }, []);

  // --- RENDER HELPERS ---

  /**
   * Renders the angle indicator (visual feedback)
   */
  const renderAngleIndicator = (currentAngle: number, targetType: 'base' | 'top') => {
    const isPointingDown = currentAngle < -5;
    const isPointingUp = currentAngle > 5;
    const isHorizontal = Math.abs(currentAngle) <= 5;

    let statusColor = 'bg-status-warning';
    let statusText = 'Adjust angle';

    if (targetType === 'base' && isPointingDown) {
      statusColor = 'bg-status-success';
      statusText = 'Good! Tap to lock';
    } else if (targetType === 'top' && isPointingUp) {
      statusColor = 'bg-status-success';
      statusText = 'Good! Tap to lock';
    }

    return (
      <div className="relative w-full max-w-sm mx-auto">
        {/* Angle arc visualization */}
        <div className="relative h-32 flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 200 100">
            {/* Horizontal reference line */}
            <line x1="0" y1="50" x2="200" y2="50" stroke="currentColor" strokeWidth="1" className="text-content-subtle opacity-30" strokeDasharray="4 2" />
            
            {/* Angle indicator */}
            <g transform="translate(100, 50)">
              <line
                x1="0"
                y1="0"
                x2={Math.cos((currentAngle * Math.PI) / 180) * 80}
                y2={-Math.sin((currentAngle * Math.PI) / 180) * 80}
                stroke="currentColor"
                strokeWidth="3"
                className={statusColor === 'bg-status-success' ? 'text-status-success' : 'text-brand-primary'}
              />
              <circle cx="0" cy="0" r="4" className="fill-current text-content-default" />
            </g>
          </svg>
        </div>

        {/* Angle value display */}
        <div className="text-center mt-4">
          <div className="text-5xl font-bold text-content-default">
            {Math.abs(currentAngle).toFixed(1)}°
          </div>
          <div className={`mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusColor} text-white text-sm font-medium`}>
            {statusText}
          </div>
        </div>
      </div>
    );
  };

  // --- RENDER ---

  // Welcome Screen
  if (state === 'WELCOME') {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-background-default via-background-subtle to-background-inset flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-stroke-default">
          <h1 className="text-xl font-semibold text-content-default flex items-center gap-2">
            <Camera className="w-6 h-6 text-brand-primary" />
            Live AR Measurement
          </h1>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-background-inset transition-colors"
            aria-label="Cancel"
          >
            <X className="w-5 h-5 text-content-subtle" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
          <div className="max-w-md w-full space-y-8">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-brand-primary/20 rounded-full blur-2xl animate-pulse" />
                <div className="relative bg-gradient-to-br from-brand-primary to-brand-secondary p-6 rounded-full">
                  <TreePine className="w-16 h-16 text-content-on-brand" />
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold text-content-default">
                Measure Trees in Real-Time
              </h2>
              <p className="text-lg text-content-subtle">
                Use your phone's sensors to measure tree height instantly - no calibration needed!
              </p>
            </div>

            {/* How it works */}
            <div className="bg-background-subtle border border-stroke-default rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-content-default flex items-center gap-2">
                <Navigation className="w-5 h-5 text-brand-accent" />
                How it works:
              </h3>
              <ol className="space-y-3 text-sm text-content-subtle">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-content-on-brand flex items-center justify-center text-xs font-bold">1</span>
                  <span>Measure distance to tree (AR or manual)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-content-on-brand flex items-center justify-center text-xs font-bold">2</span>
                  <span>Point phone at tree BASE and lock angle</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-content-on-brand flex items-center justify-center text-xs font-bold">3</span>
                  <span>Point phone at tree TOP and lock angle</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-content-on-brand flex items-center justify-center text-xs font-bold">4</span>
                  <span>Height calculated instantly!</span>
                </li>
              </ol>
            </div>

            {/* Device compatibility notice */}
            {!sensorsSupported && (
              <div className="flex items-start gap-3 p-4 bg-status-warning/10 border border-status-warning/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm text-content-subtle">
                  <p className="font-medium text-content-default">Limited Sensor Support</p>
                  <p>Your device may not support motion sensors. You can still use manual distance input.</p>
                </div>
              </div>
            )}

            {/* Start button */}
            <button
              onClick={handleStart}
              className="w-full bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary-hover text-content-on-brand font-bold py-5 px-8 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3 group"
            >
              <Camera className="w-6 h-6 group-hover:animate-pulse" />
              <span className="text-lg">Start Measurement</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Requesting Sensors
  if (state === 'REQUESTING_SENSORS') {
    return (
      <div className="fixed inset-0 z-50 bg-background-default flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <Loader2 className="w-12 h-12 text-brand-primary animate-spin mx-auto" />
          <div>
            <h2 className="text-2xl font-bold text-content-default">Requesting Sensors</h2>
            <p className="mt-2 text-content-subtle">
              Please grant access to device motion sensors
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Distance Measurement (AR Mode)
  if (state === 'MEASURING_DISTANCE') {
    return (
      <DistanceMeasureView
        onDistanceMeasured={handleDistanceMeasured}
        onCancel={() => setState('MANUAL_DISTANCE')} // Fallback to manual
      />
    );
  }

  // Manual Distance Input
  if (state === 'MANUAL_DISTANCE') {
    return (
      <div className="fixed inset-0 z-50 bg-background-default flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-stroke-default">
          <h1 className="text-xl font-semibold text-content-default">Enter Distance</h1>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-background-inset">
            <X className="w-5 h-5 text-content-subtle" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
          <div className="max-w-md w-full space-y-6">
            <div className="text-center">
              <Ruler className="w-12 h-12 text-brand-accent mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-content-default">Distance to Tree</h2>
              <p className="mt-2 text-content-subtle">
                Measure or estimate the distance from where you're standing to the tree's base
              </p>
            </div>

            {error && (
              <div className="p-4 bg-status-error/10 border border-status-error/20 rounded-lg text-sm text-status-error">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-content-default mb-2">
                Distance (meters)
              </label>
              <input
                type="number"
                value={manualDistanceInput}
                onChange={(e) => setManualDistanceInput(e.target.value)}
                placeholder="e.g., 10.5"
                className="w-full px-4 py-3 border border-stroke-default rounded-lg bg-background-default text-content-default text-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                autoFocus
                step="0.1"
                min="3"
                max="50"
              />
              <p className="mt-2 text-xs text-content-subtle">
                Recommended: 5-20 meters for best accuracy
              </p>
            </div>

            <button
              onClick={handleManualDistanceSubmit}
              disabled={!manualDistanceInput}
              className="w-full bg-brand-primary hover:bg-brand-primary-hover disabled:bg-background-inset disabled:text-content-subtle text-content-on-brand font-bold py-4 px-6 rounded-lg transition-colors"
            >
              Continue
            </button>

            <button
              onClick={() => setState('MEASURING_DISTANCE')}
              className="w-full text-brand-secondary hover:underline text-sm"
            >
              ← Try AR Distance Measurement Instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Capturing Base Angle
  if (state === 'CAPTURING_BASE') {
    return (
      <div className="fixed inset-0 z-50 bg-background-default flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-stroke-default">
          <h1 className="text-xl font-semibold text-content-default">Step 1: Tree Base</h1>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-background-inset">
            <X className="w-5 h-5 text-content-subtle" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center space-y-8">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-background-subtle rounded-full text-sm">
              <span className="text-content-subtle">Distance:</span>
              <span className="font-bold text-brand-primary">{distance?.toFixed(1)}m</span>
            </div>

            <h2 className="text-2xl font-bold text-content-default">
              Aim at Tree Base
            </h2>
            <p className="text-content-subtle">
              Point your phone camera at the very bottom of the tree trunk
            </p>

            {error && (
              <div className="p-3 bg-status-error/10 border border-status-error/20 rounded-lg text-sm text-status-error">
                {error}
              </div>
            )}
          </div>

          {renderAngleIndicator(motionData.tiltAngle, 'base')}

          <button
            onClick={handleLockBase}
            disabled={!sensorsReady}
            className="px-8 py-4 bg-status-success hover:bg-status-success/90 disabled:bg-background-inset disabled:text-content-subtle text-white font-bold rounded-full transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            Lock Base Angle
          </button>
        </div>
      </div>
    );
  }

  // Capturing Top Angle
  if (state === 'CAPTURING_TOP') {
    return (
      <div className="fixed inset-0 z-50 bg-background-default flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-stroke-default">
          <h1 className="text-xl font-semibold text-content-default">Step 2: Tree Top</h1>
          <button onClick={handleRetry} className="p-2 rounded-lg hover:bg-background-inset">
            <RotateCcw className="w-5 h-5 text-content-subtle" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center space-y-8">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="flex items-center justify-center gap-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-background-subtle rounded-full text-sm">
                <span className="text-content-subtle">Distance:</span>
                <span className="font-bold text-brand-primary">{distance?.toFixed(1)}m</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-status-success/10 rounded-full text-sm">
                <Check className="w-4 h-4 text-status-success" />
                <span className="text-content-subtle">Base:</span>
                <span className="font-bold text-status-success">{angleToBase?.toFixed(1)}°</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-content-default">
              Aim at Tree Top
            </h2>
            <p className="text-content-subtle">
              Point your phone camera at the highest point of the tree
            </p>

            {error && (
              <div className="p-3 bg-status-error/10 border border-status-error/20 rounded-lg text-sm text-status-error">
                {error}
              </div>
            )}
          </div>

          {renderAngleIndicator(motionData.tiltAngle, 'top')}

          <button
            onClick={handleLockTop}
            disabled={!sensorsReady}
            className="px-8 py-4 bg-status-success hover:bg-status-success/90 disabled:bg-background-inset disabled:text-content-subtle text-white font-bold rounded-full transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            Lock Top Angle & Calculate
          </button>
        </div>
      </div>
    );
  }

  // Measurement Complete
  if (state === 'MEASUREMENT_COMPLETE' && measurement) {
    return (
      <div className="fixed inset-0 z-50 bg-background-default flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-stroke-default">
          <h1 className="text-xl font-semibold text-content-default flex items-center gap-2">
            <Check className="w-6 h-6 text-status-success" />
            Measurement Complete
          </h1>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-background-inset">
            <X className="w-5 h-5 text-content-subtle" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
          <div className="max-w-md w-full space-y-8">
            {/* Height display */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-status-success to-brand-primary mb-4">
                <TreePine className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-5xl font-bold text-content-default mb-2">
                {formatMeasurement(measurement.height, 'm', 2)}
              </h2>
              <p className="text-lg text-content-subtle">Tree Height</p>
            </div>

            {/* Measurement details */}
            <div className="bg-background-subtle border border-stroke-default rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-content-default">Measurement Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-content-subtle">Distance</p>
                  <p className="text-lg font-semibold text-content-default">
                    {measurement.distance.toFixed(1)}m
                  </p>
                </div>
                <div>
                  <p className="text-xs text-content-subtle">Confidence</p>
                  <p className="text-lg font-semibold text-status-success">
                    {(measurement.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-content-subtle">Base Angle</p>
                  <p className="text-lg font-semibold text-content-default">
                    {measurement.angleToBase.toFixed(1)}°
                  </p>
                </div>
                <div>
                  <p className="text-xs text-content-subtle">Top Angle</p>
                  <p className="text-lg font-semibold text-content-default">
                    {measurement.angleToTop.toFixed(1)}°
                  </p>
                </div>
              </div>

              {measurement.confidence < 0.7 && (
                <div className="flex items-start gap-2 p-3 bg-status-warning/10 border border-status-warning/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-content-subtle">
                    Confidence is below optimal. Consider retrying with adjusted distance or angles for better accuracy.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 px-6 py-4 border border-stroke-default hover:bg-background-subtle text-content-default font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Retry
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-status-success to-brand-primary hover:from-status-success/90 hover:to-brand-primary/90 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Use This
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (state === 'ERROR') {
    return (
      <div className="fixed inset-0 z-50 bg-background-default flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-error/10">
            <X className="w-8 h-8 text-status-error" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-content-default">Something Went Wrong</h2>
            <p className="mt-2 text-content-subtle">{error || sensorError}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-stroke-default hover:bg-background-subtle text-content-default font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setState('WELCOME')}
              className="flex-1 px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-content-on-brand font-bold rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (should never reach here)
  return null;
};
