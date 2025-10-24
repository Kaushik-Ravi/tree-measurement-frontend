// src/components/live-ar/LiveARMeasureView_CORRECT.tsx
/**
 * Live AR Tree Measurement - CORRECT IMPLEMENTATION
 * 
 * Uses EXISTING SAM pipeline (no manual angle measurement!)
 * 
 * Flow:
 * 1. User opens live camera
 * 2. User enters distance (AR or manual)
 * 3. User taps on tree trunk → Capture frame
 * 4. Send to /api/sam_auto_segment (existing endpoint)
 * 5. Show mask overlay + results
 * 6. Species ID via PlantNet
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera, Check, X, Ruler, TreePine, Loader2, 
  AlertCircle, Sparkles, Target
} from 'lucide-react';
import { samAutoSegment } from '../../apiService';
import type { Metrics } from '../../apiService';

interface LiveARMeasureViewProps {
  /** Callback when measurement is complete */
  onMeasurementComplete: (
    metrics: Metrics,
    capturedImageFile: File,
    maskImageBase64: string
  ) => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Optional: Camera FOV ratio (from calibration) */
  fovRatio?: number | null;
  /** Optional: Focal length (from EXIF) */
  focalLength?: number | null;
}

type MeasurementState =
  | 'CAMERA_INIT'          // Starting camera
  | 'DISTANCE_INPUT'       // Get distance
  | 'READY_TO_TAP'         // Show live feed, wait for tap
  | 'PROCESSING'           // SAM processing
  | 'COMPLETE'             // Show results
  | 'ERROR';              // Error state

export const LiveARMeasureView: React.FC<LiveARMeasureViewProps> = ({
  onMeasurementComplete,
  onCancel,
  fovRatio,
  focalLength,
}) => {
  // --- STATE ---
  const [state, setState] = useState<MeasurementState>('CAMERA_INIT');
  const [distance, setDistance] = useState<number | null>(null);
  const [manualDistanceInput, setManualDistanceInput] = useState('');
  const [scaleFactor, setScaleFactor] = useState<number | null>(null);
  const [capturedImageFile, setCapturedImageFile] = useState<File | null>(null);
  const [maskImageBase64, setMaskImageBase64] = useState<string>('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tapPoint, setTapPoint] = useState<{ x: number; y: number } | null>(null);

  // --- REFS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingStreamRef = useRef<MediaStream | null>(null); // CRITICAL FIX: Hold stream until video element exists

  // --- CAMERA SETUP ---
  // CRITICAL FIX: Remove startCamera from useEffect to prevent infinite loop
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const initCamera = async () => {
      try {
        console.log('[LiveAR] Requesting camera access...');
        console.log('[LiveAR] Protocol:', window.location.protocol);
        console.log('[LiveAR] Host:', window.location.host);
        console.log('[LiveAR] Checking navigator.mediaDevices:', !!navigator.mediaDevices);
        console.log('[LiveAR] Checking getUserMedia:', !!navigator.mediaDevices?.getUserMedia);
        
        // CRITICAL CHECK: getUserMedia requires HTTPS (or localhost)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API not available. Please ensure you are using HTTPS.');
        }
        
        // CRITICAL FIX: Add 10-second timeout for getUserMedia
        const streamPromise = navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Camera access timeout after 10 seconds'));
          }, 10000);
        });
        
        console.log('[LiveAR] Waiting for getUserMedia response...');
        const stream = await Promise.race([streamPromise, timeoutPromise]);
        clearTimeout(timeoutId);
        
        console.log('[LiveAR] Camera access granted! Stream:', stream);
        console.log('[LiveAR] Stream active:', stream.active);
        console.log('[LiveAR] Video tracks:', stream.getVideoTracks().length);

        // CRITICAL FIX: Store stream and change state - video element will appear
        // Then a separate useEffect will attach the stream to the video element
        if (isMounted) {
          console.log('[LiveAR] Storing stream in pendingStreamRef...');
          pendingStreamRef.current = stream;
          streamRef.current = stream;
          console.log('[LiveAR] Changing state to DISTANCE_INPUT...');
          setState('DISTANCE_INPUT');
          console.log('[LiveAR] State changed - video element should now render');
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.error('[LiveAR] Camera initialization error:', err);
        console.error('[LiveAR] Error name:', err.name);
        console.error('[LiveAR] Error message:', err.message);
        console.error('[LiveAR] Error stack:', err.stack);
        
        if (isMounted) {
          setError(
            err.message?.includes('timeout')
              ? 'Camera access timeout. Please refresh and try again.'
              : err.name === 'NotAllowedError'
              ? 'Camera permission denied. Please enable camera access in browser settings.'
              : err.name === 'NotFoundError'
              ? 'No camera found on device.'
              : err.name === 'NotReadableError'
              ? 'Camera is already in use by another application.'
              : `Could not access camera: ${err.message || 'Unknown error'}`
          );
          setState('ERROR');
        }
      }
    };

    initCamera();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      if (streamRef.current) {
        console.log('[LiveAR] Stopping camera stream...');
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (pendingStreamRef.current) {
        console.log('[LiveAR] Stopping pending stream...');
        pendingStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []); // Empty deps - run once on mount

  // CRITICAL FIX: Attach stream to video element once it exists
  useEffect(() => {
    const attachStream = async () => {
      if (pendingStreamRef.current && videoRef.current && state === 'DISTANCE_INPUT') {
        console.log('[LiveAR] Video element now exists - attaching stream...');
        const stream = pendingStreamRef.current;
        videoRef.current.srcObject = stream;
        
        // Wait for metadata
        try {
          await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Metadata timeout')), 5000);
            videoRef.current!.onloadedmetadata = () => {
              clearTimeout(timeoutId);
              console.log('[LiveAR] Video metadata loaded');
              resolve();
            };
          });
          
          // Try to play
          console.log('[LiveAR] Calling video.play()...');
          await videoRef.current.play();
          console.log('[LiveAR] Video playing successfully!');
          
          // Clear pending stream
          pendingStreamRef.current = null;
        } catch (err) {
          console.error('[LiveAR] Video setup error:', err);
          // Continue anyway - video might work without explicit play()
        }
      }
    };
    
    attachStream();
  }, [state]); // Re-run when state changes to DISTANCE_INPUT

  // --- CALCULATE SCALE FACTOR ---
  /**
   * Same logic as App.tsx prepareMeasurementSession()
   * scale_factor = (distance_mm * camera_constant) / horizontal_pixels
   */
  const calculateScaleFactor = useCallback(
    (dist: number, imageWidth: number, imageHeight: number): number | null => {
      let cameraConstant: number | null = null;

      if (focalLength) {
        cameraConstant = 36.0 / focalLength;
      } else if (fovRatio) {
        cameraConstant = fovRatio;
      } else {
        // Need calibration
        setError('Camera not calibrated. Please calibrate first.');
        return null;
      }

      const distMM = dist * 1000;
      const horizontalPixels = Math.max(imageWidth, imageHeight);
      const finalScaleFactor = (distMM * cameraConstant) / horizontalPixels;
      
      return finalScaleFactor;
    },
    [focalLength, fovRatio]
  );

  // --- HANDLE DISTANCE INPUT ---
  const handleDistanceSubmit = useCallback(() => {
    const dist = parseFloat(manualDistanceInput);
    if (isNaN(dist) || dist <= 0) {
      setError('Please enter a valid distance greater than 0');
      return;
    }

    if (!videoRef.current || videoRef.current.videoWidth === 0) {
      setError('Camera not ready. Please wait...');
      return;
    }

    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;

    const sf = calculateScaleFactor(dist, videoWidth, videoHeight);
    if (!sf) return; // Error already set

    setDistance(dist);
    setScaleFactor(sf);
    setError(null);
    setState('READY_TO_TAP');
  }, [manualDistanceInput, calculateScaleFactor]);

  // --- HANDLE TAP ON VIDEO ---
  /**
   * User taps on video to mark tree trunk
   * Capture frame + coordinates → Send to SAM
   */
  const handleVideoTap = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      if (state !== 'READY_TO_TAP' || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const rect = video.getBoundingClientRect();

      // Get tap position relative to video element
      const tapX = event.clientX - rect.left;
      const tapY = event.clientY - rect.top;

      // Convert to video coordinates
      const scaleX = video.videoWidth / rect.width;
      const scaleY = video.videoHeight / rect.height;
      const videoX = Math.round(tapX * scaleX);
      const videoY = Math.round(tapY * scaleY);

      setTapPoint({ x: videoX, y: videoY });
      setState('PROCESSING');

      try {
        // Capture current video frame
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context failed');

        ctx.drawImage(video, 0, 0);

        // Convert canvas to Blob then File
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.95)
        );
        if (!blob) throw new Error('Failed to capture image');

        const imageFile = new File([blob], `tree_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });

        setCapturedImageFile(imageFile);

        // Call existing SAM endpoint
        const response = await samAutoSegment(
          imageFile,
          distance!,
          scaleFactor!,
          { x: videoX, y: videoY }
        );

        if (response.status !== 'success') {
          throw new Error(response.message || 'SAM segmentation failed');
        }

        // Store results
        setMetrics(response.metrics);
        setMaskImageBase64(response.result_image_base64);
        setState('COMPLETE');
      } catch (err: any) {
        console.error('Processing error:', err);
        setError(err.message || 'Failed to process measurement');
        setState('ERROR');
      }
    },
    [state, distance, scaleFactor]
  );

  // --- RENDER STATES ---

  if (state === 'CAMERA_INIT') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white max-w-md px-6">
          <Camera className="w-20 h-20 mx-auto mb-6 text-green-500 animate-pulse" />
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-2xl font-bold mb-3">Requesting Camera Access</p>
          <p className="text-gray-400 text-sm mb-6">
            Please allow camera access when prompted by your browser
          </p>
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 text-left text-sm">
            <p className="font-semibold text-yellow-400 mb-2">📸 Camera Permission Required</p>
            <p className="text-gray-300">
              If you don't see a permission prompt, check your browser settings and ensure camera access is allowed for this site.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

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
                setState('DISTANCE_INPUT');
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
      {/* --- CAMERA FEED --- */}
      <div
        className="relative flex-1 overflow-hidden"
        onClick={state === 'READY_TO_TAP' ? handleVideoTap : undefined}
        style={{ cursor: state === 'READY_TO_TAP' ? 'crosshair' : 'default' }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            /* CRITICAL FIX: Ensure video fills container properly */
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onPlay={() => console.log('[LiveAR] Video started playing')}
          onError={(e) => console.error('[LiveAR] Video error:', e)}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Tap indicator */}
        {tapPoint && state === 'PROCESSING' && (
          <div
            className="absolute w-8 h-8 border-4 border-green-500 rounded-full animate-ping"
            style={{
              left: `${(tapPoint.x / (videoRef.current?.videoWidth || 1)) * 100}%`,
              top: `${(tapPoint.y / (videoRef.current?.videoHeight || 1)) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}

        {/* Mask overlay (when complete) */}
        {state === 'COMPLETE' && maskImageBase64 && (
          <img
            src={`data:image/png;base64,${maskImageBase64}`}
            alt="Tree mask"
            className="absolute inset-0 w-full h-full object-cover opacity-70 mix-blend-screen"
          />
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/20 z-10"></div>
      </div>

      {/* --- HEADER --- */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent">
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

      {/* --- UI OVERLAYS --- */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        {/* DISTANCE INPUT */}
        {state === 'DISTANCE_INPUT' && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/90 to-transparent text-white">
            <div className="max-w-md mx-auto">
              <div className="bg-green-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ruler className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-2">
                Distance to Tree
              </h2>
              <p className="text-center text-gray-300 mb-4 text-sm">
                Position yourself to see the full tree, then enter distance to base
              </p>

              <div className="space-y-4">
                <input
                  type="number"
                  step="0.1"
                  value={manualDistanceInput}
                  onChange={(e) => setManualDistanceInput(e.target.value)}
                  placeholder="e.g., 10.5"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-center text-2xl font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
                <p className="text-xs text-gray-400 text-center">
                  Recommended: 5-20 meters
                </p>

                {error && (
                  <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleDistanceSubmit}
                  disabled={!manualDistanceInput}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg font-bold text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* READY TO TAP */}
        {state === 'READY_TO_TAP' && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent text-white">
            <div className="max-w-md mx-auto text-center">
              <div className="bg-gradient-to-br from-green-500 to-blue-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Target className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Tap on Tree Trunk</h2>
              <p className="text-gray-300 mb-4">
                Tap anywhere on the main trunk. The system will automatically segment and
                measure the tree.
              </p>
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-sm text-gray-400">Distance: {distance?.toFixed(1)}m</p>
              </div>
            </div>
          </div>
        )}

        {/* PROCESSING */}
        {state === 'PROCESSING' && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/90 to-transparent text-white">
            <div className="max-w-md mx-auto text-center">
              <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-green-500" />
              <h2 className="text-2xl font-bold mb-2">Processing...</h2>
              <p className="text-gray-300">
                Running SAM segmentation and calculating dimensions
              </p>
            </div>
          </div>
        )}

        {/* COMPLETE */}
        {state === 'COMPLETE' && metrics && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/90 to-transparent text-white">
            <div className="max-w-md mx-auto">
              <div className="bg-gradient-to-br from-green-500 to-blue-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-4">
                Measurement Complete!
              </h2>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white/10 rounded-lg p-3 text-center">
                  <p className="text-3xl font-mono font-bold">
                    {metrics.height_m.toFixed(2)}m
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Height</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3 text-center">
                  <p className="text-3xl font-mono font-bold">
                    {metrics.canopy_m.toFixed(2)}m
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Canopy</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3 text-center">
                  <p className="text-3xl font-mono font-bold">
                    {metrics.dbh_cm.toFixed(1)}cm
                  </p>
                  <p className="text-xs text-gray-400 mt-1">DBH</p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (capturedImageFile && maskImageBase64 && metrics) {
                    onMeasurementComplete(metrics, capturedImageFile, maskImageBase64);
                  }
                }}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg font-bold text-lg hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Use This Measurement
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
