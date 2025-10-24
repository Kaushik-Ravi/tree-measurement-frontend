// src/components/live-ar/LiveARMeasureView_Enhanced.tsx
/**
 * Live AR Tree Measurement - ENHANCED WITH AR DISTANCE
 * 
 * NEW FEATURES:
 * 1. AR hit-test for automatic distance measurement (no manual input)
 * 2. Automatic species identification after SAM
 * 3. Professional UI/UX
 * 
 * Flow:
 * 1. Open WebXR AR session
 * 2. Use hit-test to place two markers (tree base + user position)
 * 3. Calculate distance automatically
 * 4. Switch to video capture mode
 * 5. Tap trunk → SAM processing
 * 6. Auto species ID via PlantNet
 * 7. Show results with species info
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import {
  Camera, Check, X, TreePine, Loader2, 
  AlertCircle, Sparkles, Target, Navigation, Crosshair
} from 'lucide-react';
import { samAutoSegment, identifySpecies } from '../../apiService';
import type { Metrics } from '../../apiService';

interface LiveARMeasureViewProps {
  /** Callback when measurement is complete */
  onMeasurementComplete: (
    metrics: Metrics,
    capturedImageFile: File,
    maskImageBase64: string,
    speciesName?: string
  ) => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Optional: Camera FOV ratio (from calibration) */
  fovRatio?: number | null;
  /** Optional: Focal length (from EXIF) */
  focalLength?: number | null;
}

type MeasurementState =
  | 'CHECKING_AR_SUPPORT'  // Checking if WebXR AR is available
  | 'AR_INIT'              // Starting WebXR
  | 'AR_SCANNING'          // Looking for surface
  | 'AR_PLACE_FIRST'       // Place marker at tree base
  | 'AR_PLACE_SECOND'      // Place marker at user position
  | 'AR_DISTANCE_COMPLETE' // Distance measured, transitioning to camera
  | 'DISTANCE_INPUT'       // Manual distance input (fallback)
  | 'CAMERA_READY'         // Live camera feed ready for tap
  | 'PROCESSING_SAM'       // SAM processing
  | 'IDENTIFYING_SPECIES'  // PlantNet API call
  | 'COMPLETE'             // Show results
  | 'ERROR';               // Error state

export const LiveARMeasureView: React.FC<LiveARMeasureViewProps> = ({
  onMeasurementComplete,
  onCancel,
  fovRatio,
  focalLength,
}) => {
  // --- STATE ---
  const [state, setState] = useState<MeasurementState>('CHECKING_AR_SUPPORT');
  const [distance, setDistance] = useState<number | null>(null);
  const [manualDistanceInput, setManualDistanceInput] = useState('');
  const [scaleFactor, setScaleFactor] = useState<number | null>(null);
  const [capturedImageFile, setCapturedImageFile] = useState<File | null>(null);
  const [maskImageBase64, setMaskImageBase64] = useState<string>('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [speciesName, setSpeciesName] = useState<string | null>(null);
  const [speciesConfidence, setSpeciesConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tapPoint, setTapPoint] = useState<{ x: number; y: number } | null>(null);
  const [instruction, setInstruction] = useState<string>('Checking AR support...');

  // --- REFS ---
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // WebXR refs
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  const markersRef = useRef<THREE.Group[]>([]);
  const lineRef = useRef<THREE.Line | null>(null);
  const pointsRef = useRef<THREE.Vector3[]>([]);
  const distanceRef = useRef<number | null>(null);

  // --- WEBXR SETUP (with fallback to manual distance) ---
  useEffect(() => {
    let isMounted = true;
    let renderer: THREE.WebGLRenderer | null = null;
    let hitTestSource: XRHitTestSource | null = null;
    let hitTestSourceRequested = false;

    const checkARSupportAndInit = async () => {
      try {
        // Check if WebXR is available
        if (!navigator.xr) {
          console.log('[LiveAR] WebXR not available - falling back to manual distance');
          await startCameraForManualMode();
          return;
        }

        const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (!isSupported) {
          console.log('[LiveAR] AR not supported - falling back to manual distance');
          await startCameraForManualMode();
          return;
        }

        // WebXR is supported, try to start AR session
        await initWebXR();
        
      } catch (err: any) {
        console.error('[LiveAR] AR initialization error:', err);
        console.log('[LiveAR] Falling back to manual distance input');
        await startCameraForManualMode();
      }
    };

    const startCameraForManualMode = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        
        streamRef.current = stream;
        setState('DISTANCE_INPUT');
        setInstruction('Enter distance to tree');
      } catch (err: any) {
        console.error('[LiveAR] Camera error:', err);
        setError('Failed to access camera');
        setState('ERROR');
      }
    };

    const initWebXR = async () => {
      try {
        setState('AR_INIT');

        // Double-check navigator.xr exists (TypeScript safety)
        if (!navigator.xr) {
          throw new Error('WebXR not available');
        }

        // Setup Three.js scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
        cameraRef.current = camera;

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        rendererRef.current = renderer;

        if (containerRef.current) {
          containerRef.current.appendChild(renderer.domElement);
        }

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 10, 0);
        scene.add(directionalLight);

        // Create reticle (targeting circle)
        const reticleGeometry = new THREE.RingGeometry(0.10, 0.12, 32);
        const reticleMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x22c55e, 
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8
        });
        const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);
        reticleRef.current = reticle;

        // Create markers (for placed points)
        for (let i = 0; i < 2; i++) {
          const marker = new THREE.Group();
          const markerCylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 0.01, 32),
            new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.3, metalness: 0.5 })
          );
          const markerPulse = new THREE.Mesh(
            new THREE.TorusGeometry(0.04, 0.005, 16, 100),
            new THREE.MeshBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.8 })
          );
          markerPulse.rotation.x = Math.PI / 2;
          marker.add(markerCylinder, markerPulse);
          marker.visible = false;
          scene.add(marker);
          markersRef.current.push(marker);
        }

        // Create measurement line
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x4ade80, linewidth: 4 });
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(), 
          new THREE.Vector3()
        ]);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.visible = false;
        scene.add(line);
        lineRef.current = line;

        // Start AR session - make hit-test OPTIONAL to support more devices
        const session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: [], // No required features
          optionalFeatures: ['hit-test', 'dom-overlay'],
          domOverlay: { root: document.body }
        });

        await renderer.xr.setSession(session);

        // Handle session end
        session.addEventListener('end', () => {
          if (isMounted) {
            setState('ERROR');
            setError('AR session ended');
          }
        });

        // Select handler (screen tap)
        const onSelect = () => {
          if (!reticle.visible) return;

          const point = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
          const markerIndex = pointsRef.current.length;

          if (markerIndex < 2) {
            pointsRef.current.push(point);
            markersRef.current[markerIndex].position.copy(point);
            markersRef.current[markerIndex].visible = true;

            if (markerIndex === 0) {
              // First point placed (tree base)
              setState('AR_PLACE_SECOND');
              setInstruction('Now point at your feet and tap');
            } else {
              // Second point placed (user position)
              const [p1, p2] = pointsRef.current;
              const calculatedDistance = p1.distanceTo(p2);
              distanceRef.current = calculatedDistance;
              setDistance(calculatedDistance);

              // Draw line
              const line = lineRef.current;
              if (line) {
                const linePositions = line.geometry.attributes.position as THREE.BufferAttribute;
                linePositions.setXYZ(0, p1.x, p1.y, p1.z);
                linePositions.setXYZ(1, p2.x, p2.y, p2.z);
                linePositions.needsUpdate = true;
                line.visible = true;
              }

              setState('AR_DISTANCE_COMPLETE');
              setInstruction(`Distance: ${calculatedDistance.toFixed(2)}m`);

              // End AR session after 2 seconds
              setTimeout(() => {
                session.end();
                transitionToCamera(calculatedDistance);
              }, 2000);
            }
          }
        };

        const controller = renderer.xr.getController(0);
        controller.addEventListener('select', onSelect);
        scene.add(controller);

        // Render loop with hit-test
        const render = (_: any, frame: XRFrame) => {
          if (!renderer || !frame) return;
          
          if (frame) {
            const referenceSpace = renderer.xr.getReferenceSpace();
            const session = renderer.xr.getSession();
            if (!session) return;

            // Request hit-test source
            if (!hitTestSourceRequested) {
              session.requestReferenceSpace('viewer').then(viewerSpace => {
                session.requestHitTestSource?.({ space: viewerSpace })?.then(source => {
                  hitTestSource = source;
                });
              });
              session.addEventListener('end', () => {
                hitTestSourceRequested = false;
                hitTestSource = null;
              });
              hitTestSourceRequested = true;
            }

            // Process hit-test results
            if (hitTestSource) {
              const hitTestResults = frame.getHitTestResults(hitTestSource);
              if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(referenceSpace!);
                if (pose) {
                  reticle.visible = true;
                  reticle.matrix.fromArray(pose.transform.matrix);

                  // Update state when surface found
                  if (state === 'AR_SCANNING') {
                    setState('AR_PLACE_FIRST');
                    setInstruction('Point at the base of the tree and tap');
                  }
                }
              } else {
                reticle.visible = false;
                if (state === 'AR_PLACE_FIRST') {
                  setState('AR_SCANNING');
                  setInstruction('Move your device to scan surfaces...');
                }
              }
            }
          }

          renderer.render(scene, camera);
        };

        renderer.setAnimationLoop(render);
        setState('AR_SCANNING');
        setInstruction('Move your device to scan surfaces...');

      } catch (err: any) {
        console.error('[LiveAR] WebXR session error:', err);
        throw err; // Will be caught by checkARSupportAndInit
      }
    };

    checkARSupportAndInit();

    return () => {
      isMounted = false;
      if (renderer) {
        renderer.setAnimationLoop(null);
        renderer.dispose();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // --- CALCULATE SCALE FACTOR ---
  const calculateScaleFactor = useCallback(
    (dist: number, imageWidth: number, imageHeight: number): number | null => {
      let cameraConstant: number | null = null;

      if (focalLength) {
        cameraConstant = 36.0 / focalLength;
      } else if (fovRatio) {
        cameraConstant = fovRatio;
      } else {
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

  // --- ATTACH VIDEO STREAM (for manual distance mode) ---
  useEffect(() => {
    const attachStream = async () => {
      if (streamRef.current && videoRef.current && state === 'DISTANCE_INPUT') {
        try {
          videoRef.current.srcObject = streamRef.current;
          await videoRef.current.play();
        } catch (err) {
          console.error('[LiveAR] Video play error:', err);
        }
      }
    };
    
    attachStream();
  }, [state]);

  // --- HANDLE MANUAL DISTANCE INPUT ---
  const handleManualDistanceSubmit = useCallback(() => {
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
    setState('CAMERA_READY');
    setInstruction('Tap on the tree trunk');
  }, [manualDistanceInput, calculateScaleFactor]);

  // --- TRANSITION TO CAMERA MODE (after AR distance) ---
  const transitionToCamera = useCallback(async (dist: number) => {
    try {
      // Request camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Wait for video element and attach stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Calculate scale factor
        const videoWidth = videoRef.current.videoWidth;
        const videoHeight = videoRef.current.videoHeight;
        const sf = calculateScaleFactor(dist, videoWidth, videoHeight);
        
        if (sf) {
          setScaleFactor(sf);
          setState('CAMERA_READY');
          setInstruction('Tap on the tree trunk');
        }
      }
    } catch (err: any) {
      console.error('[LiveAR] Camera error:', err);
      setError(err.message || 'Failed to access camera');
      setState('ERROR');
    }
  }, [calculateScaleFactor]);

  // --- HANDLE TAP ON VIDEO ---
  const handleVideoTap = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      if (state !== 'CAMERA_READY' || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const rect = video.getBoundingClientRect();

      // Get tap position
      const tapX = event.clientX - rect.left;
      const tapY = event.clientY - rect.top;

      // Convert to video coordinates
      const scaleX = video.videoWidth / rect.width;
      const scaleY = video.videoHeight / rect.height;
      const videoX = Math.round(tapX * scaleX);
      const videoY = Math.round(tapY * scaleY);

      setTapPoint({ x: videoX, y: videoY });
      setState('PROCESSING_SAM');
      setInstruction('Processing with SAM...');

      try {
        // Capture video frame
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context failed');

        ctx.drawImage(video, 0, 0);

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.95)
        );
        if (!blob) throw new Error('Failed to capture image');

        const imageFile = new File([blob], `tree_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });

        setCapturedImageFile(imageFile);

        // Call SAM
        const response = await samAutoSegment(
          imageFile,
          distance!,
          scaleFactor!,
          { x: videoX, y: videoY }
        );

        if (response.status !== 'success') {
          throw new Error(response.message || 'SAM segmentation failed');
        }

        setMetrics(response.metrics);
        setMaskImageBase64(response.result_image_base64);

        // Auto species identification
        setState('IDENTIFYING_SPECIES');
        setInstruction('Identifying species...');

        try {
          const speciesResult = await identifySpecies(imageFile, 'auto'); // 'auto' for leaf/flower/bark detection
          if (speciesResult.bestMatch) {
            setSpeciesName(speciesResult.bestMatch.scientificName);
            setSpeciesConfidence(speciesResult.bestMatch.score);
          } else {
            setSpeciesName('Unknown species');
            setSpeciesConfidence(0);
          }
        } catch (speciesErr) {
          console.error('[LiveAR] Species ID error:', speciesErr);
          setSpeciesName('Species identification failed');
          setSpeciesConfidence(0);
        }

        setState('COMPLETE');
        setInstruction('Measurement complete!');

      } catch (err: any) {
        console.error('[LiveAR] Processing error:', err);
        setError(err.message || 'Failed to process measurement');
        setState('ERROR');
      }
    },
    [state, distance, scaleFactor]
  );

  // --- RENDER ---

  if (state === 'CHECKING_AR_SUPPORT') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white max-w-md px-6">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-green-500" />
          <p className="text-xl font-bold mb-2">Checking AR Capabilities</p>
          <p className="text-sm text-gray-400">Detecting device features...</p>
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
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // AR Distance Measurement UI
  if (state === 'AR_INIT' || state === 'AR_SCANNING' || 
      state === 'AR_PLACE_FIRST' || state === 'AR_PLACE_SECOND' || 
      state === 'AR_DISTANCE_COMPLETE') {
    return (
      <div ref={containerRef} className="fixed inset-0 z-50">
        {/* AR content renders here */}
        
        {/* Overlay UI */}
        <div className="fixed inset-0 pointer-events-none z-50">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-white">
                <Navigation className="w-6 h-6" />
                <h1 className="text-lg font-semibold">AR Distance Measurement</h1>
              </div>
              <button
                onClick={onCancel}
                className="pointer-events-auto p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Instruction */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent">
            <div className="max-w-md mx-auto text-center text-white">
              {state === 'AR_SCANNING' && (
                <>
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-green-500" />
                  <p className="text-xl font-semibold">{instruction}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Point your device at the ground to detect surfaces
                  </p>
                </>
              )}
              {state === 'AR_PLACE_FIRST' && (
                <>
                  <Target className="w-16 h-16 mx-auto mb-4 text-green-500 animate-pulse" />
                  <p className="text-xl font-semibold">{instruction}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Step 1 of 2: Position the reticle at the tree's base
                  </p>
                </>
              )}
              {state === 'AR_PLACE_SECOND' && (
                <>
                  <Target className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-pulse" />
                  <p className="text-xl font-semibold">{instruction}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Step 2 of 2: Position the reticle at your current position
                  </p>
                </>
              )}
              {state === 'AR_DISTANCE_COMPLETE' && (
                <>
                  <Check className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <p className="text-2xl font-bold">{instruction}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Switching to camera mode...
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Camera Capture UI
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Camera feed */}
      <div
        className="relative flex-1 overflow-hidden"
        onClick={state === 'CAMERA_READY' ? handleVideoTap : undefined}
        style={{ cursor: state === 'CAMERA_READY' ? 'crosshair' : 'default' }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Tap indicator */}
        {tapPoint && (state === 'PROCESSING_SAM' || state === 'IDENTIFYING_SPECIES') && (
          <div
            className="absolute w-8 h-8 border-4 border-green-500 rounded-full animate-ping"
            style={{
              left: `${(tapPoint.x / (videoRef.current?.videoWidth || 1)) * 100}%`,
              top: `${(tapPoint.y / (videoRef.current?.videoHeight || 1)) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}

        {/* Mask overlay */}
        {state === 'COMPLETE' && maskImageBase64 && (
          <img
            src={`data:image/png;base64,${maskImageBase64}`}
            alt="Tree mask"
            className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen"
          />
        )}

        <div className="absolute inset-0 bg-black/20 z-10"></div>
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-6 h-6" />
          <h1 className="text-lg font-semibold">Live Measurement</h1>
        </div>
        <button
          onClick={onCancel}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom UI */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        {state === 'DISTANCE_INPUT' && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/90 to-transparent text-white">
            <div className="max-w-md mx-auto">
              <div className="bg-green-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Navigation className="w-8 h-8" />
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
                  onClick={handleManualDistanceSubmit}
                  disabled={!manualDistanceInput}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg font-bold text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {state === 'CAMERA_READY' && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent text-white">
            <div className="max-w-md mx-auto text-center">
              <Crosshair className="w-20 h-20 mx-auto mb-4 text-green-500 animate-pulse" />
              <h2 className="text-2xl font-bold mb-2">{instruction}</h2>
              <p className="text-gray-300 mb-4">
                Tap anywhere on the main trunk to measure
              </p>
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-sm text-gray-400">Distance: {distance?.toFixed(2)}m</p>
              </div>
            </div>
          </div>
        )}

        {(state === 'PROCESSING_SAM' || state === 'IDENTIFYING_SPECIES') && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/90 to-transparent text-white">
            <div className="max-w-md mx-auto text-center">
              <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-green-500" />
              <h2 className="text-2xl font-bold mb-2">{instruction}</h2>
              <p className="text-gray-300 text-sm">
                {state === 'PROCESSING_SAM' 
                  ? 'Analyzing tree structure...'
                  : 'Searching plant database...'}
              </p>
            </div>
          </div>
        )}

        {state === 'COMPLETE' && metrics && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/90 to-transparent text-white">
            <div className="max-w-md mx-auto">
              {/* Species badge */}
              {speciesName && (
                <div className="mb-4 p-4 bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TreePine className="w-5 h-5 text-green-400" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-400">Species</p>
                      <p className="font-semibold text-green-300">{speciesName}</p>
                    </div>
                    {speciesConfidence && speciesConfidence > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Confidence</p>
                        <p className="text-sm font-mono text-green-400">
                          {(speciesConfidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-br from-green-500 to-blue-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-4">
                Measurement Complete!
              </h2>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                  <p className="text-3xl font-mono font-bold text-green-400">
                    {metrics.height_m.toFixed(2)}m
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Height</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                  <p className="text-3xl font-mono font-bold text-blue-400">
                    {metrics.canopy_m.toFixed(2)}m
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Canopy</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                  <p className="text-3xl font-mono font-bold text-purple-400">
                    {metrics.dbh_cm.toFixed(1)}cm
                  </p>
                  <p className="text-xs text-gray-400 mt-1">DBH</p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (capturedImageFile && maskImageBase64 && metrics) {
                    onMeasurementComplete(
                      metrics, 
                      capturedImageFile, 
                      maskImageBase64,
                      speciesName || undefined
                    );
                  }
                }}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg font-bold text-lg hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Save Measurement
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
