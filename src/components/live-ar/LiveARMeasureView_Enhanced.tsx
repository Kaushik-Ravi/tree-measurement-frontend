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
  AlertCircle, Sparkles, Target, Navigation, Crosshair, RotateCcw, Leaf,
  Zap, Users, Edit3
} from 'lucide-react';
import { samAutoSegment, identifySpecies, calculateCO2 } from '../../apiService';
import type { Metrics, IdentificationResponse } from '../../apiService';
import { 
  loadSavedCalibration, 
  autoCalibrate,
  type CameraCalibration 
} from '../../utils/cameraCalibration';

interface LiveARMeasureViewProps {
  /** Callback when measurement is complete */
  onMeasurementComplete: (
    metrics: Metrics,
    capturedImageFile: File,
    maskImageBase64: string,
    speciesName?: string,
    speciesConfidence?: number,
    identificationResult?: IdentificationResponse | null,
    co2Sequestered?: number | null,
    userLocation?: { lat: number; lng: number } | null,
    compassHeading?: number | null
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
  | 'POINT_SELECTION'      // User tapping multiple points (trunk + canopy)
  | 'PROCESSING_SAM'       // SAM processing
  | 'IDENTIFYING_SPECIES'  // PlantNet API call
  | 'COMPLETE'             // Show results
  | 'SAVE_CHOICE'          // Phase 5: Choose Quick Save or Community Analysis
  | 'ADDITIONAL_DETAILS'   // Phase 5: Fill additional details form
  | 'ERROR';               // Error state

interface TapPoint {
  x: number;
  y: number;
  label: string;
  color: string;
}

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
  const [co2Sequestered, setCO2Sequestered] = useState<number | null>(null);
  const [identificationResult, setIdentificationResult] = useState<IdentificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tapPoint, setTapPoint] = useState<{ x: number; y: number } | null>(null);
  const [tapPoints, setTapPoints] = useState<TapPoint[]>([]); // Multiple points for better SAM
  const [instruction, setInstruction] = useState<string>('Checking AR support...');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  
  // Phase 4: AR-anchored mask orientation tracking
  const [baseOrientation, setBaseOrientation] = useState<{ alpha: number; beta: number; gamma: number } | null>(null);
  const [maskTransform, setMaskTransform] = useState<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 1 });

  // Phase 5: Two-flow + Additional Details
  const [additionalDetails, setAdditionalDetails] = useState<{
    condition: string;
    ownership: string;
    remarks: string;
  }>({ condition: '', ownership: '', remarks: '' });

  // Phase 6: Camera Calibration
  const [cameraCalibration, setCameraCalibration] = useState<CameraCalibration | null>(null);

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

  // --- PHASE 6: LOAD SAVED CALIBRATION ---
  useEffect(() => {
    const savedCalibration = loadSavedCalibration();
    if (savedCalibration) {
      setCameraCalibration(savedCalibration);
      console.log('[Phase 6] Loaded saved calibration:', savedCalibration.calibrationMethod);
    } else {
      console.log('[Phase 6] No saved calibration found - will auto-calibrate on camera start');
    }
  }, []);

  // --- GET LOCATION & COMPASS ---
  useEffect(() => {
    // Request location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          console.log('[LiveAR] Location acquired:', position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('[LiveAR] Location error:', error);
        }
      );
    }

    // Request compass
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientationabsolute', handleOrientation);
          }
        })
        .catch(console.error);
    } else {
      window.addEventListener('deviceorientationabsolute', handleOrientation);
    }

    function handleOrientation(event: DeviceOrientationEvent) {
      if (event.alpha !== null) {
        setCompassHeading(event.alpha);
      }
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
    };
  }, []);

  // --- PHASE 4: AR-ANCHORED MASK ORIENTATION TRACKING ---
  useEffect(() => {
    if (state !== 'COMPLETE' || !maskImageBase64) {
      return; // Only track when mask is displayed
    }

    // Capture base orientation when mask first appears
    if (!baseOrientation) {
      const captureBaseOrientation = (event: DeviceOrientationEvent) => {
        if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
          setBaseOrientation({
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma
          });
          console.log('[LiveAR Phase 4] Base orientation captured:', event.alpha, event.beta, event.gamma);
          window.removeEventListener('deviceorientation', captureBaseOrientation);
        }
      };
      
      window.addEventListener('deviceorientation', captureBaseOrientation);
      return () => window.removeEventListener('deviceorientation', captureBaseOrientation);
    }

    // Track orientation changes and update mask transform
    const handleOrientationChange = (event: DeviceOrientationEvent) => {
      if (event.alpha === null || event.beta === null || event.gamma === null) return;
      if (!baseOrientation) return;

      // Calculate deltas from base orientation
      let deltaAlpha = event.alpha - baseOrientation.alpha;
      let deltaBeta = event.beta - baseOrientation.beta;
      let deltaGamma = event.gamma - baseOrientation.gamma;

      // Normalize alpha to -180 to 180 range
      if (deltaAlpha > 180) deltaAlpha -= 360;
      if (deltaAlpha < -180) deltaAlpha += 360;

      // Convert orientation to screen transform
      // Beta (tilt forward/back): affects Y position
      // Gamma (tilt left/right): affects X position
      // Alpha (compass): affects rotation (minimal for mask stability)
      
      // Scale factors: adjust these to tune sensitivity
      const xSensitivity = 3.5; // pixels per degree
      const ySensitivity = 3.5; // pixels per degree
      const scaleSensitivity = 0.003; // scale change per degree

      const x = deltaGamma * xSensitivity;
      const y = deltaBeta * ySensitivity;
      
      // Slight scale adjustment for depth perception when tilting
      const avgTilt = (Math.abs(deltaBeta) + Math.abs(deltaGamma)) / 2;
      const scale = 1 + (avgTilt * scaleSensitivity);

      setMaskTransform({ x, y, scale });
    };

    window.addEventListener('deviceorientation', handleOrientationChange);
    console.log('[LiveAR Phase 4] Orientation tracking active');

    return () => {
      window.removeEventListener('deviceorientation', handleOrientationChange);
    };
  }, [state, maskImageBase64, baseOrientation]);

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
        
        // Phase 6: Auto-calibrate camera if not already calibrated
        if (!cameraCalibration || cameraCalibration.calibrationMethod === 'none') {
          console.log('[Phase 6] Auto-calibrating camera...');
          const newCalibration = await autoCalibrate(undefined, stream);
          setCameraCalibration(newCalibration);
          console.log('[Phase 6] Auto-calibration complete:', newCalibration.calibrationMethod);
        }
        
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

            // Request hit-test source with proper reference space
            if (!hitTestSourceRequested) {
              // CRITICAL FIX: Use 'local-floor' instead of 'viewer' for better device compatibility
              session.requestReferenceSpace('local-floor').then(localSpace => {
                session.requestHitTestSource?.({ space: localSpace })?.then(source => {
                  hitTestSource = source;
                }).catch(err => {
                  console.warn('[LiveAR] Hit-test source failed, trying viewer space:', err);
                  // Fallback to viewer space if local-floor fails
                  session.requestReferenceSpace('viewer').then(viewerSpace => {
                    session.requestHitTestSource?.({ space: viewerSpace })?.then(source => {
                      hitTestSource = source;
                    });
                  }).catch(err2 => {
                    console.error('[LiveAR] All reference spaces failed:', err2);
                  });
                });
              }).catch(err => {
                console.error('[LiveAR] local-floor reference space failed:', err);
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

  // --- HANDLE TAP ON VIDEO (Multi-Point Selection) ---
  const handleVideoTap = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if ((state !== 'CAMERA_READY' && state !== 'POINT_SELECTION') || !videoRef.current) return;

      const video = videoRef.current;
      const rect = video.getBoundingClientRect();

      // Get tap position
      const tapX = event.clientX - rect.left;
      const tapY = event.clientY - rect.top;

      // Convert to video coordinates
      const scaleX = video.videoWidth / rect.width;
      const scaleY = video.videoHeight / rect.height;
      const videoX = Math.round(tapX * scaleX);
      const videoY = Math.round(tapY * scaleY);

      // Add point to collection
      const pointNumber = tapPoints.length + 1;
      let label = '';
      let color = '';
      
      if (pointNumber === 1) {
        label = 'Trunk Point 1';
        color = '#22c55e'; // Green
      } else if (pointNumber === 2) {
        label = 'Trunk Point 2';
        color = '#10b981'; // Emerald
      } else if (pointNumber === 3) {
        label = 'Canopy Point';
        color = '#3b82f6'; // Blue
      } else {
        label = `Point ${pointNumber}`;
        color = '#8b5cf6'; // Purple
      }

      const newPoint: TapPoint = {
        x: videoX,
        y: videoY,
        label,
        color
      };

      setTapPoints([...tapPoints, newPoint]);
      setState('POINT_SELECTION');
      
      // Update instruction based on number of points
      if (pointNumber === 1) {
        setInstruction('Good! Tap another point on the trunk');
      } else if (pointNumber === 2) {
        setInstruction('Great! Now tap a point on the canopy');
      } else {
        setInstruction(`${pointNumber} points selected. Tap "Analyze" when ready`);
      }
    },
    [state, tapPoints]
  );

  // --- UNDO LAST POINT ---
  const handleUndoPoint = useCallback(() => {
    if (tapPoints.length === 0) return;
    
    const newPoints = tapPoints.slice(0, -1);
    setTapPoints(newPoints);
    
    if (newPoints.length === 0) {
      setState('CAMERA_READY');
      setInstruction('Tap on the tree trunk to start selection');
      // Phase 4: Reset orientation tracking for next measurement
      setBaseOrientation(null);
      setMaskTransform({ x: 0, y: 0, scale: 1 });
    } else if (newPoints.length === 1) {
      setInstruction('Good! Tap another point on the trunk');
    } else if (newPoints.length === 2) {
      setInstruction('Great! Now tap a point on the canopy');
    }
  }, [tapPoints]);

  // --- CLEAR ALL POINTS ---
  const handleClearPoints = useCallback(() => {
    setTapPoints([]);
    setState('CAMERA_READY');
    setInstruction('Tap on the tree trunk to start selection');
    // Phase 4: Reset orientation tracking for next measurement
    setBaseOrientation(null);
    setMaskTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  // --- SUBMIT POINTS FOR SAM ANALYSIS ---
  const handleSubmitPoints = useCallback(
    async () => {
      if (tapPoints.length < 2 || !videoRef.current || !canvasRef.current) {
        setError('Please select at least 2 points');
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      setState('PROCESSING_SAM');
      setInstruction('Analyzing tree structure...');

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

        // Phase 6: Try Tier 1 calibration (EXIF extraction) from captured image
        if (!cameraCalibration || cameraCalibration.calibrationMethod === 'none' || cameraCalibration.calibrationMethod === 'api') {
          console.log('[Phase 6] Attempting Tier 1 calibration from captured image...');
          const exifCalibration = await autoCalibrate(imageFile, undefined);
          if (exifCalibration.calibrationMethod === 'exif') {
            setCameraCalibration(exifCalibration);
            console.log('[Phase 6] Upgraded to EXIF calibration');
          }
        }

        // Use the first point for SAM (or could send all points to backend if supported)
        const primaryPoint = tapPoints[0];
        setTapPoint({ x: primaryPoint.x, y: primaryPoint.y });

        // Call SAM
        const response = await samAutoSegment(
          imageFile,
          distance!,
          scaleFactor!,
          { x: primaryPoint.x, y: primaryPoint.y }
        );

        if (response.status !== 'success') {
          throw new Error(response.message || 'Tree measurement failed');
        }

        setMetrics(response.metrics);
        setMaskImageBase64(response.result_image_base64);

        // Auto species identification
        setState('IDENTIFYING_SPECIES');
        setInstruction('Identifying species...');

        try {
          const speciesResult = await identifySpecies(imageFile, 'auto');
          if (speciesResult.bestMatch) {
            setSpeciesName(speciesResult.bestMatch.scientificName);
            setSpeciesConfidence(speciesResult.bestMatch.score);
            setIdentificationResult(speciesResult);

            // Calculate CO2 sequestration
            const woodDensity = speciesResult.woodDensity?.value || 500; // Default 500 kg/m³
            try {
              const co2Result = await calculateCO2(response.metrics, woodDensity);
              setCO2Sequestered(co2Result.co2_sequestered_kg);
              console.log('[LiveAR] CO2 calculated:', co2Result.co2_sequestered_kg, 'kg');
            } catch (co2Err) {
              console.error('[LiveAR] CO2 calculation error:', co2Err);
            }
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
        let errorMessage = err.message || 'Failed to process measurement';
        
        // Better network error detection
        if (err.message?.includes('fetch') || err.message?.includes('network') || err.name === 'NetworkError') {
          errorMessage = 'Network error - please check your connection and try again';
        } else if (err.message?.includes('timeout')) {
          errorMessage = 'Request timed out - the server may be busy, please try again';
        }
        
        setError(errorMessage);
        setState('ERROR');
      }
    },
    [tapPoints, distance, scaleFactor]
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
          <h2 className="text-xl font-bold text-white mb-2">Something Went Wrong</h2>
          <p className="text-red-200 mb-2">{error}</p>
          
          {/* Helpful suggestions based on error type */}
          {error?.toLowerCase().includes('camera') && (
            <p className="text-sm text-gray-400 mb-4">
              💡 Make sure camera permissions are enabled in your browser settings
            </p>
          )}
          {error?.toLowerCase().includes('network') && (
            <p className="text-sm text-gray-400 mb-4">
              💡 Check your internet connection and try again
            </p>
          )}
          {!error?.toLowerCase().includes('camera') && !error?.toLowerCase().includes('network') && (
            <p className="text-sm text-gray-400 mb-4">
              💡 Try closing and reopening the measurement tool
            </p>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
            >
              Close
            </button>
            <button
              onClick={() => {
                setError(null);
                setState('CHECKING_AR_SUPPORT');
              }}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-semibold"
            >
              Retry
            </button>
          </div>
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
        onClick={(state === 'CAMERA_READY' || state === 'POINT_SELECTION') ? handleVideoTap : undefined}
        style={{ cursor: (state === 'CAMERA_READY' || state === 'POINT_SELECTION') ? 'crosshair' : 'default' }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Multi-point markers */}
        {(state === 'POINT_SELECTION' || state === 'PROCESSING_SAM' || state === 'IDENTIFYING_SPECIES') && 
          tapPoints.map((point, index) => (
            <div
              key={index}
              className="absolute"
              style={{
                left: `${(point.x / (videoRef.current?.videoWidth || 1)) * 100}%`,
                top: `${(point.y / (videoRef.current?.videoHeight || 1)) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Point marker */}
              <div
                className="w-10 h-10 rounded-full border-4 flex items-center justify-center font-bold text-white shadow-lg"
                style={{
                  borderColor: point.color,
                  backgroundColor: `${point.color}80`, // 50% opacity
                  animation: state === 'POINT_SELECTION' ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
                }}
              >
                {index + 1}
              </div>
              {/* Label */}
              {state === 'POINT_SELECTION' && (
                <div
                  className="absolute top-12 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-lg whitespace-nowrap"
                  style={{ backgroundColor: point.color }}
                >
                  {point.label}
                </div>
              )}
            </div>
          ))
        }

        {/* Single tap indicator (legacy, for processing) */}
        {tapPoint && (state === 'PROCESSING_SAM' || state === 'IDENTIFYING_SPECIES') && tapPoints.length === 0 && (
          <div
            className="absolute w-8 h-8 border-4 border-green-500 rounded-full animate-ping"
            style={{
              left: `${(tapPoint.x / (videoRef.current?.videoWidth || 1)) * 100}%`,
              top: `${(tapPoint.y / (videoRef.current?.videoHeight || 1)) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}

        {/* Mask overlay - Phase 4: AR-anchored with orientation tracking */}
        {state === 'COMPLETE' && maskImageBase64 && (
          <img
            src={`data:image/png;base64,${maskImageBase64}`}
            alt="Tree mask"
            className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen"
            style={{
              transform: `translate(${maskTransform.x}px, ${maskTransform.y}px) scale(${maskTransform.scale})`,
              transition: 'transform 0.05s ease-out', // Smooth 50ms transition for natural tracking
              willChange: 'transform' // Performance optimization
            }}
          />
        )}

        <div className="absolute inset-0 bg-black/20 z-10"></div>
      </div>

      {/* Header */}
      <div 
        className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-6 h-6" />
          <h1 className="text-lg font-semibold">Live Measurement</h1>
        </div>
        <button
          onClick={onCancel}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Close live measurement"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom UI */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        {state === 'DISTANCE_INPUT' && (
          <div className="p-4 pb-6 bg-gradient-to-t from-black/98 via-black/95 to-transparent text-white"
               style={{ 
                 paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
                 maxHeight: '85vh',
                 overflowY: 'auto'
               }}>
            <div className="max-w-md mx-auto">
              {/* Visual Guide - Distance Illustration */}
              <div className="mb-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center mb-1">
                      <span className="text-2xl">🧍</span>
                    </div>
                    <p className="text-xs text-blue-300">You</p>
                  </div>
                  
                  <div className="flex-1 mx-3 flex items-center">
                    <div className="flex-1 border-t-2 border-dashed border-green-400 relative">
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap font-semibold">
                          Distance
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 border-2 border-green-400 flex items-center justify-center mb-1">
                      <TreePine className="w-6 h-6 text-green-400" />
                    </div>
                    <p className="text-xs text-green-300">Tree Base</p>
                  </div>
                </div>
                <p className="text-xs text-center text-gray-400 mt-2">
                  Measure from your position to the base of the tree trunk
                </p>
              </div>

              {/* Important Instructions */}
              <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-amber-200 text-sm font-semibold flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  Stand still during measurement
                </p>
                <p className="text-amber-100/70 text-xs mt-1">
                  Keep your camera steady and remain in the same position throughout the entire process
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/30 backdrop-blur-sm rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-green-500 w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      Distance to Tree Base
                    </h2>
                    <p className="text-sm text-gray-300">
                      Enter distance in meters
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={manualDistanceInput}
                    onChange={(e) => setManualDistanceInput(e.target.value)}
                    placeholder="e.g., 10.5"
                    className="w-full px-4 py-4 bg-black/30 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 text-center text-3xl font-mono focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    autoFocus
                  />
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                    <span className="bg-white/10 px-3 py-1 rounded-full">Recommended: 5-20m</span>
                  </div>

                  {error && (
                    <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-sm text-red-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    onClick={handleManualDistanceSubmit}
                    disabled={!manualDistanceInput}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl font-bold text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
                  >
                    Continue to Measurement
                  </button>
                </div>
              </div>

              {/* Tips */}
              <div className="text-center text-xs text-gray-500 space-y-1">
                <p>💡 Tip: Use a measuring tape or estimate by counting steps</p>
                <p>(1 step ≈ 0.8 meters)</p>
              </div>
            </div>
          </div>
        )}

        {state === 'CAMERA_READY' && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent text-white">
            <div className="max-w-md mx-auto text-center">
              {/* Stand Still Warning */}
              <div className="mb-4 bg-amber-500/20 border border-amber-500 rounded-lg p-3">
                <p className="text-amber-200 text-sm font-bold flex items-center justify-center gap-2">
                  <span className="text-xl">⚠️</span>
                  Keep camera steady and stay in position
                </p>
              </div>

              <Crosshair className="w-20 h-20 mx-auto mb-4 text-green-500 animate-pulse" />
              <h2 className="text-2xl font-bold mb-2">Tap on Tree Trunk</h2>
              <p className="text-gray-300 mb-4">
                Tap multiple points on the trunk and canopy for better accuracy
              </p>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <p className="text-sm text-gray-400">Distance: {distance?.toFixed(2)}m</p>
              </div>
            </div>
          </div>
        )}

        {state === 'POINT_SELECTION' && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent text-white">
            <div className="max-w-md mx-auto">
              {/* Stand Still Warning */}
              <div className="mb-4 bg-amber-500/20 border border-amber-500 rounded-lg p-3">
                <p className="text-amber-200 text-sm font-bold flex items-center justify-center gap-2">
                  <span className="text-xl">⚠️</span>
                  Keep camera steady - don't move yet!
                </p>
              </div>

              {/* Instruction */}
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold mb-2">{instruction}</h2>
                <p className="text-sm text-gray-400">{tapPoints.length} point{tapPoints.length !== 1 ? 's' : ''} selected</p>
              </div>

              {/* Points List */}
              <div className="mb-4 space-y-2">
                {tapPoints.map((point, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-lg p-3 border"
                    style={{ borderColor: point.color }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                      style={{ backgroundColor: point.color }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{point.label}</p>
                      <p className="text-xs text-gray-400">X: {point.x}, Y: {point.y}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Control Buttons */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <button
                  onClick={handleUndoPoint}
                  disabled={tapPoints.length === 0}
                  className="flex flex-col items-center justify-center gap-1 p-3 bg-orange-500/20 border border-orange-500 rounded-lg hover:bg-orange-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="text-xs font-semibold">Undo</span>
                </button>
                
                <button
                  onClick={handleClearPoints}
                  disabled={tapPoints.length === 0}
                  className="flex flex-col items-center justify-center gap-1 p-3 bg-red-500/20 border border-red-500 rounded-lg hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <X className="w-5 h-5" />
                  <span className="text-xs font-semibold">Clear</span>
                </button>
                
                <button
                  onClick={handleSubmitPoints}
                  disabled={tapPoints.length < 2}
                  className="flex flex-col items-center justify-center gap-1 p-3 bg-green-500/20 border border-green-500 rounded-lg hover:bg-green-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Check className="w-5 h-5" />
                  <span className="text-xs font-semibold">Analyze</span>
                </button>
              </div>

              {/* Requirement Notice */}
              {tapPoints.length < 2 && (
                <div className="text-center text-sm text-yellow-300 bg-yellow-500/10 rounded-lg p-2 border border-yellow-500/30">
                  ⓘ At least 2 points required for analysis
                </div>
              )}

              {tapPoints.length >= 2 && (
                <div className="text-center text-sm text-green-300 bg-green-500/10 rounded-lg p-2 border border-green-500/30">
                  ✓ Ready to analyze! Tap "Analyze" button
                </div>
              )}

              {/* Distance Info */}
              <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <p className="text-xs text-gray-400 text-center">Distance: {distance?.toFixed(2)}m</p>
              </div>
            </div>
          </div>
        )}

        {(state === 'PROCESSING_SAM' || state === 'IDENTIFYING_SPECIES') && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/90 to-transparent text-white">
            <div className="max-w-md mx-auto text-center">
              <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-green-500" />
              <h2 className="text-2xl font-bold mb-2">
                {state === 'PROCESSING_SAM' ? 'Analyzing Tree Structure...' : 'Identifying Species...'}
              </h2>
              <p className="text-gray-300 text-sm mb-3">
                {state === 'PROCESSING_SAM' 
                  ? 'Measuring dimensions and detecting tree features'
                  : 'Searching our plant database for a match'}
              </p>
              
              {/* Progress steps */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className={`w-3 h-3 rounded-full ${state === 'PROCESSING_SAM' ? 'bg-green-500 animate-pulse' : 'bg-green-500'}`}></div>
                <div className="w-8 h-0.5 bg-green-500/30"></div>
                <div className={`w-3 h-3 rounded-full ${state === 'IDENTIFYING_SPECIES' ? 'bg-green-500 animate-pulse' : state === 'PROCESSING_SAM' ? 'bg-gray-600' : 'bg-green-500'}`}></div>
                <div className="w-8 h-0.5 bg-green-500/30"></div>
                <div className="w-3 h-3 rounded-full bg-gray-600"></div>
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                {state === 'PROCESSING_SAM' ? 'This may take 10-20 seconds...' : 'Almost done...'}
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
                    <TreePine className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-400">Species</p>
                      <p className="font-semibold text-green-300 truncate" title={speciesName}>
                        {speciesName}
                      </p>
                    </div>
                    {speciesConfidence && speciesConfidence > 0 && (
                      <div className="text-right flex-shrink-0">
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

              {/* CO2 Sequestration Card */}
              {co2Sequestered && co2Sequestered > 0 && (
                <div className="mb-4 p-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/50 rounded-lg backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
                      <Leaf className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-400">Carbon Sequestration</p>
                      <p className="text-2xl font-mono font-bold text-emerald-300">
                        {co2Sequestered.toFixed(2)} kg CO₂
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Estimated total lifetime sequestration
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setState('SAVE_CHOICE')}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg font-bold text-lg hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Phase 5: Save Choice Screen */}
        {state === 'SAVE_CHOICE' && metrics && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/90 to-transparent text-white">
            <div className="max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-center mb-3">
                How would you like to save?
              </h2>
              <p className="text-center text-gray-300 text-sm mb-6">
                Choose your workflow based on your needs
              </p>

              {/* Quick Save Option */}
              <button
                onClick={() => {
                  // Direct save without additional details
                  if (capturedImageFile && maskImageBase64 && metrics) {
                    onMeasurementComplete(
                      metrics, 
                      capturedImageFile, 
                      maskImageBase64,
                      speciesName || undefined,
                      speciesConfidence || undefined,
                      identificationResult,
                      co2Sequestered,
                      userLocation,
                      compassHeading
                    );
                  }
                }}
                className="w-full mb-4 p-5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-2 border-blue-500 rounded-xl hover:from-blue-500/30 hover:to-cyan-500/30 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                      Quick Save
                      <span className="text-xs bg-blue-500 px-2 py-0.5 rounded-full">Fast</span>
                    </h3>
                    <p className="text-sm text-gray-300">
                      Save measurement instantly with basic details. Perfect for quick surveys.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-blue-300">
                      <Check className="w-4 h-4" />
                      <span>Measurements • Species • CO₂ • Location</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Community Analysis Option */}
              <button
                onClick={() => setState('ADDITIONAL_DETAILS')}
                className="w-full p-5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500 rounded-xl hover:from-green-500/30 hover:to-emerald-500/30 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-green-500 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                      Community Analysis
                      <span className="text-xs bg-green-500 px-2 py-0.5 rounded-full">Detailed</span>
                    </h3>
                    <p className="text-sm text-gray-300">
                      Add tree health, notes, and additional photos for comprehensive tracking.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-green-300">
                      <Check className="w-4 h-4" />
                      <span>Everything in Quick + Health • Notes • Photos</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Back button */}
              <button
                onClick={() => setState('COMPLETE')}
                className="w-full mt-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-all"
              >
                Back to Results
              </button>
            </div>
          </div>
        )}

        {/* Phase 5: Additional Details Form */}
        {state === 'ADDITIONAL_DETAILS' && metrics && (
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30 overflow-y-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="min-h-full flex items-end">
              {/* Slide-up panel */}
              <div className="w-full bg-gradient-to-b from-gray-900 to-black rounded-t-3xl p-6 text-white animate-slide-up">
                <div className="max-w-md mx-auto">
                  {/* Handle bar */}
                  <div className="w-12 h-1.5 bg-gray-600 rounded-full mx-auto mb-6"></div>

                  <h2 className="text-2xl font-bold mb-2">Additional Details</h2>
                  <p className="text-gray-400 text-sm mb-6">
                    Help us build a comprehensive tree database
                  </p>

                  {/* Condition */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                      <TreePine className="w-4 h-4 text-green-400" />
                      Tree Condition
                    </label>
                    <select
                      value={additionalDetails.condition}
                      onChange={(e) => setAdditionalDetails({ ...additionalDetails, condition: e.target.value })}
                      className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="" className="bg-gray-900">Select condition...</option>
                      <option value="Healthy" className="bg-gray-900">🌳 Healthy - Thriving and vigorous</option>
                      <option value="Average" className="bg-gray-900">🌿 Average - Normal growth</option>
                      <option value="Poor" className="bg-gray-900">🍂 Poor - Stressed or damaged</option>
                      <option value="Dead" className="bg-gray-900">💀 Dead - No signs of life</option>
                    </select>
                  </div>

                  {/* Ownership */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-blue-400" />
                      Location Type / Ownership
                    </label>
                    <select
                      value={additionalDetails.ownership}
                      onChange={(e) => setAdditionalDetails({ ...additionalDetails, ownership: e.target.value })}
                      className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="" className="bg-gray-900">Select type...</option>
                      <option value="Private" className="bg-gray-900">🏠 Private Property</option>
                      <option value="Public" className="bg-gray-900">🏛️ Public Space</option>
                      <option value="Government" className="bg-gray-900">🏢 Government Land</option>
                      <option value="Semi Government" className="bg-gray-900">🏛️ Semi Government</option>
                      <option value="Avenues" className="bg-gray-900">🛣️ Avenues</option>
                      <option value="Garden" className="bg-gray-900">🌺 Garden</option>
                      <option value="On Road" className="bg-gray-900">🚗 On Road</option>
                      <option value="On Divider" className="bg-gray-900">🚦 On Divider</option>
                      <option value="On Foot Path" className="bg-gray-900">🚶 On Foot Path</option>
                      <option value="On Bridge" className="bg-gray-900">🌉 On Bridge</option>
                      <option value="On Wall" className="bg-gray-900">🧱 On Wall</option>
                      <option value="In Well" className="bg-gray-900">🕳️ In Well</option>
                      <option value="Industrial" className="bg-gray-900">🏭 Industrial Area</option>
                    </select>
                  </div>

                  {/* Remarks */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-purple-400" />
                      Notes & Observations
                    </label>
                    <textarea
                      value={additionalDetails.remarks}
                      onChange={(e) => setAdditionalDetails({ ...additionalDetails, remarks: e.target.value })}
                      rows={4}
                      placeholder="e.g., Leaning towards east, evidence of fungal growth on trunk, nest visible in upper canopy..."
                      className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional - Any additional observations</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setState('SAVE_CHOICE')}
                      className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        if (capturedImageFile && maskImageBase64 && metrics) {
                          // TODO: Pass additional details to parent
                          // For now, just save with the basic data
                          onMeasurementComplete(
                            metrics, 
                            capturedImageFile, 
                            maskImageBase64,
                            speciesName || undefined,
                            speciesConfidence || undefined,
                            identificationResult,
                            co2Sequestered,
                            userLocation,
                            compassHeading
                          );
                        }
                      }}
                      className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Save All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
