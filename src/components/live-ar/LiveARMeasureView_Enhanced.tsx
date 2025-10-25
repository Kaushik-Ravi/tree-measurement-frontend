// src/components/live-ar/LiveARMeasureView_Enhanced.tsx
/**
 * Live AR Tree Measurement - PHASE B: RESTRUCTURED WORKFLOW
 * 
 * RESTRUCTURED FLOW (matching Photo Method):
 * 1. AR distance measurement OR manual distance input
 * 2. TWO-FLOW CHOICE: Quick Save or Full Analysis
 * 3. Quick Path: Additional Details → Save → Hub
 * 4. Full Path: Camera Ready → Multi-point SAM → Species → CO2 → Additional Details → Save → Hub
 * 
 * KEY CHANGES:
 * - Choice screen appears AFTER distance (not after SAM)
 * - Quick Save skips SAM entirely (just captures photo + metadata)
 * - Full Analysis performs complete measurement workflow
 * - Additional Details form stays IN Live AR view (slide-up overlay)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import {
  Camera, Check, X, TreePine, Loader2, 
  AlertCircle, Sparkles, Target, Navigation, RotateCcw, Leaf,
  Zap, Users, Edit3, ArrowLeft
} from 'lucide-react';
import { 
  samAutoSegment, 
  identifySpecies, 
  calculateCO2, 
  quickCapture, 
  saveResult, 
  uploadImage, 
  getResults 
} from '../../apiService';
import type { Metrics, IdentificationResponse } from '../../apiService';
import { 
  loadSavedCalibration, 
  autoCalibrate,
  type CameraCalibration 
} from '../../utils/cameraCalibration';
import { useAuth } from '../../contexts/AuthContext';

interface LiveARMeasureViewProps {
  /** Callback when measurement is complete and saved to database */
  onMeasurementComplete: (result: {
    success: boolean;
    quickSave?: boolean;
    fullAnalysis?: boolean;
    shouldNavigateToHub: boolean;
    updatedResults?: any[];
    metrics?: Metrics;
    error?: string;
  }) => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Optional: Camera FOV ratio (from calibration) */
  fovRatio?: number | null;
  /** Optional: Focal length (from EXIF) */
  focalLength?: number | null;
}

type MeasurementState =
  // --- PHASE E.3 REBUILD: DELIBERATE USER FLOW ---
  | 'PRE_FLIGHT_CHECK'     // Initial check: AR available? Show user choice
  | 'USER_CHOICE'          // User chooses: "Use AR" or "Manual Distance"
  
  // --- AR PATH (user-initiated with ARButton) ---
  | 'AR_READY'             // ARButton created, waiting for user tap
  | 'AR_ACTIVE'            // AR session started (via ARButton)
  | 'AR_SCANNING'          // Looking for surface
  | 'AR_PLACE_FIRST'       // Place marker at tree base
  | 'AR_PLACE_SECOND'      // Place marker at user position
  | 'AR_COMPLETE'          // Distance measured, session ending
  
  // --- MANUAL PATH (user-initiated) ---
  | 'DISTANCE_INPUT'       // Manual distance input (user chose manual OR AR not available)
  
  // --- PHASE B: TWO-FLOW CHOICE (immediately after distance) ---
  | 'TWO_FLOW_CHOICE'      // Choose Quick Save or Full Analysis
  
  // --- QUICK SAVE PATH ---
  | 'QUICK_SAVE_DETAILS'   // Fill additional details for quick save
  
  // --- FULL ANALYSIS PATH ---
  | 'CAMERA_READY'         // Live camera feed ready for tap
  | 'POINT_SELECTION'      // User tapping multiple points (trunk + canopy)
  | 'PROCESSING_SAM'       // SAM processing
  | 'IDENTIFYING_SPECIES'  // PlantNet API call
  | 'FULL_ANALYSIS_COMPLETE' // Show SAM results
  | 'FULL_ANALYSIS_DETAILS'  // Fill additional details for full analysis
  
  // --- COMMON STATES ---
  | 'SAVING'               // Saving to database
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
  // --- AUTH CONTEXT (Phase F: Database Integration) ---
  const { session } = useAuth();
  
  // --- PHASE E.4: COPY PHOTO AR PATTERN - Use refs for AR state to prevent re-render cycles ---
  const arStateRef = useRef<'SCANNING' | 'READY_FIRST' | 'READY_SECOND' | 'COMPLETE'>('SCANNING');
  const distanceRef = useRef<number | null>(null);
  const isInitializingRef = useRef(false); // Prevent concurrent AR inits
  const isCleaningUpRef = useRef(false);   // Prevent concurrent cleanups
  const allowMarkerPlacement = useRef(true); // Control flag for marker placement (Photo AR pattern)
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const arButtonRef = useRef<HTMLElement | null>(null);
  const isMountedRef = useRef(false);
  
  // --- UI STATE (safe to cause re-renders) ---
  const [state, setState] = useState<MeasurementState>('PRE_FLIGHT_CHECK');
  const [uiDistance, setUiDistance] = useState<number | null>(null); // For display only
  const [showConfirmButtons, setShowConfirmButtons] = useState(false);
  const [showPlaceButton, setShowPlaceButton] = useState(false);
  const [showUndoButton, setShowUndoButton] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [arSessionActive, setArSessionActive] = useState(false);
  
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
  const [freezeFrameImage, setFreezeFrameImage] = useState<string | null>(null); // PHASE D.2: Freeze frame for point selection
  const [instruction, setInstruction] = useState<string>('Checking device capabilities...');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  
  // PHASE E.2: AR mask tracking REMOVED (user feedback: looked "artificial")
  // Simplified UI without device orientation tracking

  // PHASE E.4: AR capability check (removed xrSession state - ARButton handles it)
  const [isArAvailable, setIsArAvailable] = useState<boolean>(false);
  const [isCheckingAr, setIsCheckingAr] = useState<boolean>(true);

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
  const reticleRef = useRef<THREE.Mesh | THREE.Group | null>(null); // Can be Mesh or Group
  const markersRef = useRef<THREE.Group[]>([]);
  const lineRef = useRef<THREE.Line | null>(null);
  const pointsRef = useRef<THREE.Vector3[]>([]);

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

  // PHASE E.2: AR mask orientation tracking REMOVED (simplified UI)

  // --- PHASE E.3 REBUILD: PRE-FLIGHT CHECK (runs once on mount, NO resource acquisition) ---
  useEffect(() => {
    const checkArCapability = async () => {
      console.log('[LiveAR E.3] 🔍 Pre-flight check: Testing AR capability...');
      setIsCheckingAr(true);
      
      try {
        if (!navigator.xr) {
          console.log('[LiveAR E.3] ❌ WebXR not available on this device');
          setIsArAvailable(false);
          setState('USER_CHOICE'); // Let user choose manual mode
          setInstruction('AR not available - you can measure using manual distance');
          return;
        }

        const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
        
        if (isSupported) {
          console.log('[LiveAR E.3] ✅ AR is available! Offering user choice...');
          setIsArAvailable(true);
          setState('USER_CHOICE');
          setInstruction('Choose your measurement method');
        } else {
          console.log('[LiveAR E.3] ❌ AR not supported on this device');
          setIsArAvailable(false);
          setState('USER_CHOICE');
          setInstruction('AR not available - you can measure using manual distance');
        }
      } catch (err) {
        console.error('[LiveAR E.3] ❌ AR capability check error:', err);
        setIsArAvailable(false);
        setState('USER_CHOICE');
        setInstruction('AR check failed - you can measure using manual distance');
      } finally {
        setIsCheckingAr(false);
      }
    };

    checkArCapability();
  }, []); // Runs ONCE on mount, NO resource acquisition

  // --- PHASE E.4: SIMPLIFIED CLEANUP (Copy Photo AR Pattern) ---
  const cleanupResources = useCallback(() => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;
    
    console.log('[LiveAR E.4] Cleanup: Releasing resources');

    try {
      // Clear timers
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }

      // Dispose renderer (ARButton handles XR session)
      if (rendererRef.current) {
        console.log('[LiveAR E.4] Disposing renderer');
        rendererRef.current.dispose();
        if (rendererRef.current.domElement?.parentNode) {
          rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current = null;
      }

      // Stop camera stream
      if (streamRef.current) {
        console.log('[LiveAR E.4] Stopping camera');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Clean video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Remove AR button
      if (arButtonRef.current?.parentNode) {
        arButtonRef.current.parentNode.removeChild(arButtonRef.current);
        arButtonRef.current = null;
      }

      console.log('[LiveAR E.4] ✅ Cleanup complete');
    } catch (err) {
      console.error('[LiveAR E.4] Cleanup error:', err);
    } finally {
      isCleaningUpRef.current = false;
    }
  }, []);

  // --- COMPONENT UNMOUNT CLEANUP (Copy Photo AR Pattern) ---
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      console.log('[LiveAR E.4] Component unmounting');
      isMountedRef.current = false;
      cleanupResources();
    };
  }, [cleanupResources]);

  // --- PHASE E.4: COPY PHOTO AR UI INTERACTION PATTERN ---
  const handleUIButtonClick = useCallback((callback: () => void) => {
    // Disable marker placement during UI interaction
    allowMarkerPlacement.current = false;
    
    // Clear existing cooldown
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }
    
    // Execute callback
    callback();
    
    // Re-enable after cooldown
    cooldownTimerRef.current = setTimeout(() => {
      allowMarkerPlacement.current = true;
    }, 300); // 300ms cooldown (Photo AR pattern)
  }, []);

  // --- PHASE B: TRANSITION AFTER AR DISTANCE → TWO_FLOW_CHOICE ---
  const transitionToCamera = useCallback(async (dist: number) => {
    try {
      // Request camera for photo capture
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

        // Calculate scale factor inline
        const videoWidth = videoRef.current.videoWidth;
        const videoHeight = videoRef.current.videoHeight;
        
        let cameraConstant: number | null = null;
        if (focalLength) {
          cameraConstant = 36.0 / focalLength;
        } else if (fovRatio) {
          cameraConstant = fovRatio;
        }
        
        if (cameraConstant) {
          const distMM = dist * 1000;
          const horizontalPixels = Math.max(videoWidth, videoHeight);
          const sf = (distMM * cameraConstant) / horizontalPixels;
          
          distanceRef.current = dist; // Store in ref
          setUiDistance(dist); // Update UI
          setScaleFactor(sf);
          
          // PHASE B: Go to two-flow choice instead of camera ready
          setState('TWO_FLOW_CHOICE');
          setInstruction('Choose how you want to proceed');
        } else {
          throw new Error('Camera not calibrated');
        }
      }
    } catch (err: any) {
      console.error('[LiveAR] Camera error:', err);
      setError(err.message || 'Failed to access camera');
      setState('ERROR');
    }
  }, [focalLength, fovRatio]);

  // --- PHASE E.4: USER-TRIGGERED AR INITIALIZATION (Copy Photo AR ARButton Pattern) ---
  // This function is called ONLY when user taps "Use AR" button
  // Uses Three.js ARButton (battle-tested, handles session lifecycle automatically)
  const startArMeasurement = useCallback(() => {
    if (isInitializingRef.current) {
      console.log('[LiveAR E.4] AR initialization already in progress');
      return;
    }

    isInitializingRef.current = true;
    console.log('[LiveAR E.4] 🚀 User initiated AR measurement');
    setState('AR_READY');
    setInstruction('Initializing AR...');

    try {
      // Setup Three.js scene (COPY FROM PHOTO AR)
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.01,
        20
      );
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled = true;
      rendererRef.current = renderer;

      const currentContainer = containerRef.current;
      if (!currentContainer) {
        throw new Error('Container not available');
      }
      
      currentContainer.appendChild(renderer.domElement);

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(0, 10, 0);
      scene.add(directionalLight);

      // Create reticle (targeting circle) - PHOTO AR PATTERN
      const reticleGroup = new THREE.Group();
      
      const reticleRing = new THREE.Mesh(
        new THREE.RingGeometry(0.1, 0.12, 32),
        new THREE.MeshBasicMaterial({
          color: 0x22c55e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        })
      );
      reticleRing.rotation.x = -Math.PI / 2;
      
      const reticleCenter = new THREE.Mesh(
        new THREE.CircleGeometry(0.02, 32),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        })
      );
      reticleCenter.rotation.x = -Math.PI / 2;
      reticleCenter.position.y = 0.001;
      
      reticleGroup.add(reticleRing, reticleCenter);
      reticleGroup.matrixAutoUpdate = false;
      reticleGroup.visible = false;
      scene.add(reticleGroup);
      reticleRef.current = reticleGroup;

      // Create markers (for placed points) - PHOTO AR PATTERN
      markersRef.current = [];
      for (let i = 0; i < 2; i++) {
        const marker = new THREE.Group();
        const markerCylinder = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.01, 32),
          new THREE.MeshStandardMaterial({
            color: 0x22c55e,
            roughness: 0.3,
            metalness: 0.5,
          })
        );
        const markerPulse = new THREE.Mesh(
          new THREE.TorusGeometry(0.04, 0.005, 16, 100),
          new THREE.MeshBasicMaterial({
            color: 0x86efac,
            transparent: true,
            opacity: 0.8,
          })
        );
        markerPulse.rotation.x = Math.PI / 2;
        marker.add(markerCylinder, markerPulse);
        marker.visible = false;
        scene.add(marker);
        markersRef.current.push(marker);
      }

      // Create measurement line - PHOTO AR PATTERN
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x4ade80,
        linewidth: 4,
      });
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.visible = false;
      scene.add(line);
      lineRef.current = line;

      // --- THE CHIMERA AR BUTTON STRATEGY (COPY FROM PHOTO AR) ---
      // Create ARButton (handles session lifecycle automatically)
      console.log('[LiveAR E.4] Creating ARButton...');
      const arButton = ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: currentContainer }
      });

      // Style the button to match our UI
      Object.assign(arButton.style, {
        position: 'absolute',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '1rem 2rem',
        fontSize: '1.1rem',
        fontWeight: '600',
        backgroundColor: '#22c55e',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        zIndex: '1000',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      });

      arButton.textContent = 'Start AR';
      arButtonRef.current = arButton;
      currentContainer.appendChild(arButton);

      console.log('[LiveAR E.4] ✅ ARButton created');

      // Track AR session state (COPY FROM PHOTO AR)
      renderer.xr.addEventListener('sessionstart', () => {
        console.log('[LiveAR E.4] AR session started');
        setArSessionActive(true);
        setState('AR_ACTIVE');
        arStateRef.current = 'SCANNING';
        setIsScanning(true);
        setInstruction('Move your device to scan surfaces...');
        
        // Hide AR button during session
        if (arButtonRef.current) {
          arButtonRef.current.style.display = 'none';
        }
      });

      renderer.xr.addEventListener('sessionend', () => {
        console.log('[LiveAR E.4] AR session ended');
        setArSessionActive(false);
        isInitializingRef.current = false;
        
        // Transition to camera view with measured distance
        if (distanceRef.current !== null) {
          transitionToCamera(distanceRef.current);
        } else {
          // User cancelled AR
          setState('USER_CHOICE');
          setInstruction('Choose your measurement method');
        }
      });

      // Select handler (screen tap) - COPY FROM PHOTO AR PATTERN
      const onSelect = () => {
        // Check cooldown protection
        if (!allowMarkerPlacement.current) {
          console.log('[LiveAR E.4] Marker placement blocked - UI interaction in progress');
          return;
        }

        const reticle = reticleRef.current;
        if (!reticle || !reticle.visible) return;

        const point = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
        const markerIndex = pointsRef.current.length;

        if (markerIndex < 2) {
          pointsRef.current.push(point);
          markersRef.current[markerIndex].position.copy(point);
          markersRef.current[markerIndex].visible = true;

          if (markerIndex === 0) {
            // First point placed (tree base)
            arStateRef.current = 'READY_SECOND';
            setState('AR_PLACE_FIRST');
            setShowPlaceButton(false);
            setShowUndoButton(true);
            setInstruction('Now point at your feet and tap');
          } else {
            // Second point placed (user position)
            const [p1, p2] = pointsRef.current;
            const calculatedDistance = p1.distanceTo(p2);
            distanceRef.current = calculatedDistance;
            setUiDistance(calculatedDistance);

            // Draw line
            const line = lineRef.current;
            if (line) {
              const linePositions = line.geometry.attributes
                .position as THREE.BufferAttribute;
              linePositions.setXYZ(0, p1.x, p1.y, p1.z);
              linePositions.setXYZ(1, p2.x, p2.y, p2.z);
              linePositions.needsUpdate = true;
              line.visible = true;
            }

            arStateRef.current = 'COMPLETE';
            setState('AR_COMPLETE');
            setShowConfirmButtons(true);
            setShowUndoButton(false);
            setInstruction(`Distance: ${calculatedDistance.toFixed(2)}m - Tap Confirm to continue`);

            console.log('[LiveAR E.4] ✅ Distance measured:', calculatedDistance.toFixed(2), 'm');
          }
        }
      };

      const controller = renderer.xr.getController(0);
      controller.addEventListener('select', onSelect);
      scene.add(controller);

      // Setup hit-test - SIMPLIFIED (COPY FROM PHOTO AR)
      let hitTestSource: XRHitTestSource | null = null;
      let hitTestSourceRequested = false;
      let surfaceFound = false;
      const clockRef = new THREE.Clock();

      // Render loop - COPY FROM PHOTO AR PATTERN
      const render = (_: any, frame: XRFrame) => {
        if (!isMountedRef.current) return;
        
        if (frame) {
          const referenceSpace = renderer.xr.getReferenceSpace();
          const activeSession = renderer.xr.getSession();
          if (!activeSession) return;

          // Request hit-test source (PHOTO AR PATTERN - simplified)
          if (!hitTestSourceRequested) {
            activeSession.requestReferenceSpace('viewer').then(viewerSpace => {
              activeSession.requestHitTestSource?.({ space: viewerSpace })?.then(source => {
                hitTestSource = source;
                console.log('[LiveAR E.4] ✅ Hit-test source ready');
              }).catch((err: any) => {
                console.warn('[LiveAR E.4] Hit-test source failed:', err.message);
              });
            }).catch((err: any) => {
              console.warn('[LiveAR E.4] Reference space failed:', err.message);
            });

            activeSession.addEventListener('end', () => {
              hitTestSourceRequested = false;
              hitTestSource = null;
              surfaceFound = false;
            });
            
            hitTestSourceRequested = true;
          }

          // Process hit-test results
          if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            const reticle = reticleRef.current;

            if (hitTestResults.length > 0 && reticle) {
              const hit = hitTestResults[0];
              const pose = hit.getPose(referenceSpace!);
              if (pose) {
                reticle.visible = true;
                reticle.matrix.fromArray(pose.transform.matrix);

                if (!surfaceFound) {
                  surfaceFound = true;
                  if (arStateRef.current === 'SCANNING') {
                    arStateRef.current = 'READY_FIRST';
                    setState('AR_PLACE_FIRST');
                    setIsScanning(false);
                    setShowPlaceButton(true);
                    setInstruction("Point at tree's base, then tap screen");
                    console.log('[LiveAR E.4] ✅ Surface found');
                  }
                }

                // Reticle pulse animation (PHOTO AR)
                const reticleRing = reticle.children[0] as THREE.Mesh;
                if (reticleRing.material) {
                  (reticleRing.material as THREE.MeshBasicMaterial).opacity = 0.95;
                }
                
                const pulseScale = 1 + Math.sin(clockRef.getElapsedTime() * 3) * 0.05;
                reticle.children.forEach((child, index) => {
                  if (index < 2) {
                    child.scale.set(pulseScale, pulseScale, pulseScale);
                  }
                });
              }
            } else if (reticle) {
              reticle.visible = false;
              const reticleRing = reticle.children[0] as THREE.Mesh;
              if (reticleRing.material) {
                (reticleRing.material as THREE.MeshBasicMaterial).opacity = 0.5;
              }
            }
          }
        }

        // Marker pulse animation (PHOTO AR)
        markersRef.current.forEach(marker => {
          if (marker.visible) {
            const pulse = marker.children[1] as THREE.Mesh;
            pulse.scale.x = pulse.scale.y = 1 + Math.sin(clockRef.getElapsedTime() * 5) * 0.1;
          }
        });

        renderer.render(scene, camera);
      };

      renderer.setAnimationLoop(render);
      console.log('[LiveAR E.4] ✅ AR system ready - waiting for user to tap Start AR');

    } catch (err: any) {
      console.error('[LiveAR E.4] ❌ AR initialization failed:', err);
      isInitializingRef.current = false;
      setError(`AR failed: ${err.message}`);
      setState('ERROR');
    }
  }, [transitionToCamera]);

  // --- PHASE E.4: MANUAL MODE WITH CAMERA INITIALIZATION (FIX: was broken before) ---
  const startManualMeasurement = useCallback(async () => {
    console.log('[LiveAR E.4] 📏 User chose manual measurement');
    setState('DISTANCE_INPUT');
    setInstruction('Initializing camera...');

    try {
      // Start camera stream immediately (THIS WAS MISSING!)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        console.log('[LiveAR E.4] ✅ Camera ready for manual mode');
        setInstruction('Enter distance to tree base');
      }
    } catch (err: any) {
      console.error('[LiveAR E.4] ❌ Camera access error:', err);
      setError('Camera access denied. Please allow camera permission.');
      setState('ERROR');
    }
  }, []);

  // --- PHASE E.4: AR BUTTON HANDLERS (Copy Photo AR Pattern) ---
  const handleArConfirm = useCallback(() => {
    console.log('[LiveAR E.4] User confirmed AR distance');
    
    // End AR session
    if (rendererRef.current?.xr) {
      const session = rendererRef.current.xr.getSession();
      if (session) {
        session.end(); // This triggers sessionend event which calls transitionToCamera
      }
    }
  }, []);

  const handleArConfirmSafe = useCallback(() => {
    handleUIButtonClick(handleArConfirm);
  }, [handleArConfirm, handleUIButtonClick]);

  const handleArRedo = useCallback(() => {
    console.log('[LiveAR E.4] User requested redo');
    
    // Reset markers and distance
    pointsRef.current = [];
    distanceRef.current = null;
    arStateRef.current = 'READY_FIRST';
    
    // Update UI
    setUiDistance(null);
    setShowConfirmButtons(false);
    setShowPlaceButton(true);
    setShowUndoButton(false);
    setIsScanning(false);
    setState('AR_PLACE_FIRST');
    setInstruction("Point at tree's base, then tap screen");
    
    // Reset visual elements
    markersRef.current.forEach(marker => marker.visible = false);
    if (lineRef.current) lineRef.current.visible = false;
  }, []);

  const handleArRedoSafe = useCallback(() => {
    handleUIButtonClick(handleArRedo);
  }, [handleArRedo, handleUIButtonClick]);

  const handleArUndo = useCallback(() => {
    console.log('[LiveAR E.4] User undid last marker');
    
    if (arStateRef.current === 'READY_SECOND' && pointsRef.current.length === 1) {
      pointsRef.current.pop();
      markersRef.current[0].visible = false;
      
      arStateRef.current = 'READY_FIRST';
      setState('AR_SCANNING');
      setShowPlaceButton(true);
      setShowUndoButton(false);
      setInstruction("Point at tree's base, then tap screen");
    }
  }, []);

  const handleArUndoSafe = useCallback(() => {
    handleUIButtonClick(handleArUndo);
  }, [handleArUndo, handleUIButtonClick]);

  // --- HELPER: Get current distance (from ref or UI state) ---
  const getCurrentDistance = useCallback(() => {
    return distanceRef.current || uiDistance || null;
  }, [uiDistance]);

  // --- CALCULATE SCALE FACTOR ---
  const calculateScaleFactor = useCallback(
    (dist: number, imageWidth: number, imageHeight: number): number | null => {
      let cameraConstant: number | null = null;

      if (focalLength) {
        cameraConstant = 36.0 / focalLength;
        console.log('[Phase A.2] Using focal length:', focalLength, 'mm → camera constant:', cameraConstant);
      } else if (fovRatio) {
        cameraConstant = fovRatio;
        console.log('[Phase A.2] Using FOV ratio:', fovRatio);
      } else {
        setError('Camera not calibrated. Please calibrate first.');
        return null;
      }

      const distMM = dist * 1000;
      const horizontalPixels = Math.max(imageWidth, imageHeight);
      const finalScaleFactor = (distMM * cameraConstant) / horizontalPixels;
      
      // PHASE A.2: Debug logging for dimension accuracy
      console.log('[Phase A.2] Scale Factor Calculation:');
      console.log('  - Distance (m):', dist);
      console.log('  - Distance (mm):', distMM);
      console.log('  - Camera constant:', cameraConstant);
      console.log('  - Horizontal pixels:', horizontalPixels);
      console.log('  - Image dimensions:', imageWidth, 'x', imageHeight);
      console.log('  - Final scale factor:', finalScaleFactor);
      console.log('  - Expected DBH range (10cm):', (10 / finalScaleFactor), 'pixels');
      console.log('  - Expected DBH range (50cm):', (50 / finalScaleFactor), 'pixels');
      
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
  // --- PHASE B: HANDLE MANUAL DISTANCE INPUT → TWO_FLOW_CHOICE ---
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

    distanceRef.current = dist; // Store in ref
    setUiDistance(dist); // Update UI
    setScaleFactor(sf);
    setError(null);
    
    // PHASE B: Go to two-flow choice instead of camera ready
    setState('TWO_FLOW_CHOICE');
    setInstruction('Choose how you want to proceed');
  }, [manualDistanceInput, calculateScaleFactor]);

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

      // PHASE D.2: Freeze frame on first tap (prevents camera shake during point selection)
      if (tapPoints.length === 0 && !freezeFrameImage) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const frozenImage = canvas.toDataURL('image/jpeg', 0.95);
          setFreezeFrameImage(frozenImage);
          console.log('[PHASE D.2] Freeze frame captured on first tap');
        }
      }

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
    [state, tapPoints, freezeFrameImage]
  );

  // --- UNDO LAST POINT ---
  const handleUndoPoint = useCallback(() => {
    if (tapPoints.length === 0) return;
    
    const newPoints = tapPoints.slice(0, -1);
    setTapPoints(newPoints);
    
    if (newPoints.length === 0) {
      setState('CAMERA_READY');
      setInstruction('Tap on the tree trunk to start selection');
      // PHASE E.2: AR mask tracking removed (simplified)
      // PHASE D.2: Clear freeze frame
      setFreezeFrameImage(null);
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
    // PHASE E.2: AR mask tracking removed (simplified)
    // PHASE D.2: Clear freeze frame
    setFreezeFrameImage(null);
  }, []);

  // --- PHASE E.1: BACK BUTTON NAVIGATION ---
  const handleBack = useCallback(() => {
    switch (state) {
      case 'TWO_FLOW_CHOICE':
        // Go back to distance input (allows user to re-enter distance)
        setState('DISTANCE_INPUT');
        setInstruction('Enter distance to tree (optional if AR fails)');
        distanceRef.current = null;
        setUiDistance(null);
        setScaleFactor(null);
        break;

      case 'CAMERA_READY':
        // Go back to TWO_FLOW_CHOICE
        setState('TWO_FLOW_CHOICE');
        setInstruction('Choose your measurement path');
        // Keep distance and scaleFactor
        break;

      case 'POINT_SELECTION':
        // Go back to CAMERA_READY (clear all points)
        handleClearPoints();
        break;

      case 'QUICK_SAVE_DETAILS':
        // Go back to Two Flow Choice (to re-choose path)
        setState('TWO_FLOW_CHOICE');
        setInstruction('Choose your measurement path');
        break;

      case 'FULL_ANALYSIS_DETAILS':
        // Go back to FULL_ANALYSIS_COMPLETE (results screen)
        setState('FULL_ANALYSIS_COMPLETE');
        setInstruction('Analysis complete! Review or edit details');
        break;

      case 'FULL_ANALYSIS_COMPLETE':
        // Go back to CAMERA_READY (restart multi-point selection)
        setState('CAMERA_READY');
        setInstruction('Tap on the tree trunk to start selection');
        // Clear previous results
        setMetrics(null);
        setMaskImageBase64('');  // Empty string instead of null
        setCO2Sequestered(null);
        setSpeciesName(null);
        setSpeciesConfidence(0);
        setIdentificationResult(null);
        setTapPoints([]);
        setFreezeFrameImage(null);
        break;

      // Cannot go back during processing states
      case 'PROCESSING_SAM':
      case 'IDENTIFYING_SPECIES':
      case 'SAVING':
        console.warn('[Phase E.1] Cannot go back during processing');
        break;

      default:
        console.warn('[Phase E.1] Back navigation not defined for state:', state);
    }
  }, [state, handleClearPoints]);

  // --- PHASE C: EXIF-PRESERVING PHOTO CAPTURE ---
  const capturePhotoWithEXIF = useCallback(async (videoElement: HTMLVideoElement): Promise<File> => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    
    // Try ImageCapture API first (preserves EXIF metadata)
    if (videoTrack && typeof ImageCapture !== 'undefined') {
      try {
        // @ts-ignore - ImageCapture not in all type definitions
        const imageCapture = new ImageCapture(videoTrack);
        
        console.log('[Phase C] Attempting photo capture with EXIF preservation...');
        
        // Try takePhoto() first (best quality + EXIF)
        try {
          const blob = await imageCapture.takePhoto();
          console.log('[Phase C] ✅ Photo captured with EXIF metadata via takePhoto()');
          return new File([blob], `tree_${Date.now()}.jpg`, { type: 'image/jpeg' });
        } catch (takePhotoErr) {
          console.log('[Phase C] takePhoto() failed, falling back to canvas:', takePhotoErr);
          // Fall through to canvas fallback
        }
      } catch (err) {
        console.error('[Phase C] ImageCapture API failed:', err);
        // Fall through to canvas fallback
      }
    }
    
    // Fallback: Canvas-based capture (no EXIF, but works everywhere)
    console.log('[Phase C] Using canvas fallback (no EXIF preservation)');
    const canvas = canvasRef.current!;
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(videoElement, 0, 0);
    
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95);
    });
    
    return new File([blob], `tree_${Date.now()}.jpg`, { type: 'image/jpeg' });
  }, []);

  // --- PHASE B: HANDLE QUICK SAVE CHOICE ---
  const handleChooseQuickSave = useCallback(async () => {
    // Quick Save: Capture photo immediately (no SAM processing)
    if (!videoRef.current || !canvasRef.current) {
      setError('Camera not ready');
      return;
    }

    setState('SAVING');
    setInstruction("Capturing photo for quick save...");

    try {
      const video = videoRef.current;

      // Phase C: Capture photo with EXIF preservation
      const imageFile = await capturePhotoWithEXIF(video);
      setCapturedImageFile(imageFile);

      // Go to additional details for quick save
      setState('QUICK_SAVE_DETAILS');
      setInstruction('Add optional details before saving');

    } catch (err: any) {
      console.error('[Phase B] Quick save photo capture error:', err);
      setError(err.message || 'Failed to capture photo');
      setState('ERROR');
    }
  }, [capturePhotoWithEXIF]);

  // --- PHASE B: HANDLE FULL ANALYSIS CHOICE ---
  const handleChooseFullAnalysis = useCallback(() => {
    // Full Analysis: Go to camera tap mode for SAM processing
    setState('CAMERA_READY');
    setInstruction('Tap on the tree trunk to begin analysis');
  }, []);

  // --- PHASE F.1: QUICK SAVE DATABASE INTEGRATION ---
  const handleQuickSave = useCallback(async () => {
    const currentDistance = getCurrentDistance();
    if (!capturedImageFile || !currentDistance || !userLocation || !session?.access_token) {
      setError("Missing required data: image, distance, location, or not logged in.");
      setState('ERROR');
      return;
    }

    setState('PROCESSING_SAM');
    setInstruction("Submitting quick capture to database...");

    try {
      // Calculate scale factor if not already set
      let finalScaleFactor = scaleFactor;
      if (!finalScaleFactor && videoRef.current) {
        finalScaleFactor = calculateScaleFactor(
          currentDistance,
          videoRef.current.videoWidth,
          videoRef.current.videoHeight
        );
        if (!finalScaleFactor) {
          throw new Error('Failed to calculate scale factor');
        }
        setScaleFactor(finalScaleFactor);
      }

      console.log('[Phase F.1] Quick Save - calling API with:');
      console.log('  - Distance:', currentDistance, 'm');
      console.log('  - Scale Factor:', finalScaleFactor);
      console.log('  - Location:', userLocation);
      console.log('  - Compass:', compassHeading);

      // Call Quick Capture API (same as Photo Method)
      await quickCapture(
        capturedImageFile,
        currentDistance,
        finalScaleFactor!,
        compassHeading,
        userLocation.lat,
        userLocation.lng,
        session.access_token
      );

      console.log('[Phase F.1] Quick capture saved successfully');

      // Refresh history
      const updatedResults = await getResults(session.access_token);

      // Navigate back to Hub with success
      onMeasurementComplete({
        success: true,
        quickSave: true,
        shouldNavigateToHub: true,
        updatedResults
      });

    } catch (error: any) {
      console.error('[Phase F.1] Quick save failed:', error);
      setError(`Quick save failed: ${error.message}`);
      setState('ERROR');
      
      // Return error to parent
      onMeasurementComplete({
        success: false,
        quickSave: true,
        shouldNavigateToHub: false,
        error: error.message
      });
    }
  }, [capturedImageFile, getCurrentDistance, scaleFactor, userLocation, compassHeading, session, calculateScaleFactor, onMeasurementComplete]);

  // --- PHASE F.2: FULL ANALYSIS DATABASE INTEGRATION ---
  const handleFullAnalysisSave = useCallback(async () => {
    const currentDistance = getCurrentDistance();
    if (!capturedImageFile || !metrics || !session?.access_token || !scaleFactor) {
      setError("Cannot save: missing data or not logged in.");
      setState('ERROR');
      return;
    }

    setState('PROCESSING_SAM');
    setInstruction("Uploading image and saving full analysis to database...");

    try {
      console.log('[Phase F.2] Full Analysis Save - uploading image...');
      
      // 1. Upload image to Supabase Storage
      const uploadResponse = await uploadImage(capturedImageFile, session.access_token);
      const imageUrl = uploadResponse.image_url;
      console.log('[Phase F.2] Image uploaded:', imageUrl);

      // 2. Prepare result payload (same as Photo Method)
      const newResultPayload: any = {
        fileName: capturedImageFile.name,
        metrics: metrics,
        species: identificationResult?.bestMatch ?? undefined,
        woodDensity: identificationResult?.woodDensity ?? undefined,
        co2_sequestered_kg: co2Sequestered ?? undefined,
        latitude: userLocation?.lat,
        longitude: userLocation?.lng,
        heading: compassHeading,
        image_url: imageUrl,
        distance_m: currentDistance ?? undefined, // Convert null to undefined for API
        scale_factor: scaleFactor ?? undefined,
        measurement_method: 'live-ar', // Track measurement type
        ...additionalDetails, // condition, ownership, remarks
      };

      console.log('[Phase F.2] Saving to database:', newResultPayload);

      // 3. Save to database (same API as Photo Method)
      await saveResult(newResultPayload, session.access_token);
      console.log('[Phase F.2] Full analysis saved successfully');

      // 4. Refresh history
      const updatedResults = await getResults(session.access_token);

      // 5. Navigate back to Hub with success
      onMeasurementComplete({
        success: true,
        fullAnalysis: true,
        shouldNavigateToHub: true,
        updatedResults,
        metrics
      });

    } catch (error: any) {
      console.error('[Phase F.2] Full analysis save failed:', error);
      setError(`Failed to save result: ${error.message}`);
      setState('ERROR');
      
      // Return error to parent
      onMeasurementComplete({
        success: false,
        fullAnalysis: true,
        shouldNavigateToHub: false,
        error: error.message
      });
    }
  }, [capturedImageFile, metrics, identificationResult, co2Sequestered, userLocation, compassHeading, getCurrentDistance, scaleFactor, additionalDetails, session, onMeasurementComplete]);

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
        // Phase C: Capture photo with EXIF preservation
        const imageFile = await capturePhotoWithEXIF(video);
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

        const currentDistance = getCurrentDistance();
        if (!currentDistance) {
          throw new Error('Distance not available');
        }

        // PHASE A.2: Debug logging before SAM call
        console.log('[Phase A.2] Calling SAM with:');
        console.log('  - Distance:', currentDistance, 'm');
        console.log('  - Scale factor:', scaleFactor);
        console.log('  - Primary point:', primaryPoint);
        console.log('  - All points:', tapPoints);
        console.log('  - Image dimensions:', canvas.width, 'x', canvas.height);

        // Call SAM
        const response = await samAutoSegment(
          imageFile,
          currentDistance,
          scaleFactor!,
          { x: primaryPoint.x, y: primaryPoint.y }
        );

        if (response.status !== 'success') {
          throw new Error(response.message || 'Tree measurement failed');
        }

        // PHASE A.2: Debug logging after SAM response
        console.log('[Phase A.2] SAM Response:');
        console.log('  - Height (m):', response.metrics.height_m);
        console.log('  - Canopy (m):', response.metrics.canopy_m);
        console.log('  - DBH (cm):', response.metrics.dbh_cm);
        console.log('  - Scale factor returned:', response.scale_factor);
        
        if (response.metrics.dbh_cm === 0 || response.metrics.height_m === 0) {
          console.error('[Phase A.2] ⚠️ WARNING: Zero dimensions detected!');
          console.error('  - This indicates a scale factor or distance calculation error');
          console.error('  - Check the debug logs above for incorrect values');
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

            // PHASE A.1: Fix CO2 calculation - Match Photo Method exactly
            // Use backend wood density, fallback to 650 kg/m³ (0.65 g/cm³) - standard hardwood density
            const woodDensity = speciesResult.woodDensity?.value || 650; // kg/m³
            
            // Only call CO2 API if metrics are valid (prevent 400 Bad Request)
            if (response.metrics.height_m > 0 && response.metrics.dbh_cm > 0) {
              try {
                const co2Result = await calculateCO2(response.metrics, woodDensity);
                setCO2Sequestered(co2Result.co2_sequestered_kg);
                console.log('[LiveAR Phase A.1] CO2 calculated:', co2Result.co2_sequestered_kg, 'kg (density:', woodDensity, 'kg/m³)');
              } catch (co2Err) {
                console.error('[LiveAR Phase A.1] CO2 calculation error:', co2Err);
                // Non-fatal error - continue without CO2 data
              }
            } else {
              console.warn('[LiveAR Phase A.1] Invalid metrics - skipping CO2 calculation');
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

        // PHASE B: Full Analysis complete - go to results view
        setState('FULL_ANALYSIS_COMPLETE');
        setInstruction('Full analysis complete!');

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
    [tapPoints, getCurrentDistance, scaleFactor]
  );

  // --- RENDER ---

  // PHASE E.3 REBUILD: Pre-flight check screen
  if (state === 'PRE_FLIGHT_CHECK') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white max-w-md px-6">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-green-500" />
          <p className="text-xl font-bold mb-2">Checking Device Capabilities</p>
          <p className="text-sm text-gray-400">Detecting AR support...</p>
        </div>
      </div>
    );
  }

  // PHASE E.3 REBUILD: User choice screen - DELIBERATE CHOICE
  if (state === 'USER_CHOICE') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center z-50">
        <div className="max-w-lg w-full mx-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-4">
              <Camera className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Choose Measurement Method</h1>
            <p className="text-gray-400">
              Select how you'd like to measure the distance to the tree
            </p>
          </div>

          {/* Choice Cards */}
          <div className="space-y-4 mb-6">
            {/* AR Option */}
            {isArAvailable ? (
              <button
                onClick={startArMeasurement}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 p-6 rounded-2xl text-left transition-all transform hover:scale-105 active:scale-95 shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                      Use Augmented Reality
                      <span className="text-xs bg-yellow-400 text-black px-2 py-0.5 rounded-full font-semibold">
                        RECOMMENDED
                      </span>
                    </h3>
                    <p className="text-green-100 text-sm mb-2">
                      Most accurate - uses device AR to measure distance
                    </p>
                    <div className="flex items-center gap-2 text-xs text-green-200">
                      <Check className="w-4 h-4" />
                      <span>Point at tree base and your position</span>
                    </div>
                  </div>
                </div>
              </button>
            ) : (
              <div className="w-full bg-gray-800 border border-gray-700 p-6 rounded-2xl text-left opacity-60">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center">
                    <X className="w-6 h-6 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-400 mb-1">
                      Augmented Reality
                    </h3>
                    <p className="text-gray-500 text-sm">
                      Not available on this device
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Option */}
            <button
              onClick={startManualMeasurement}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 p-6 rounded-2xl text-left transition-all transform hover:scale-105 active:scale-95 shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">
                    Manual Distance Input
                  </h3>
                  <p className="text-blue-100 text-sm mb-2">
                    Quick and simple - enter distance manually
                  </p>
                  <div className="flex items-center gap-2 text-xs text-blue-200">
                    <Check className="w-4 h-4" />
                    <span>Good for known distances or when AR unavailable</span>
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Cancel button */}
          <button
            onClick={onCancel}
            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
          >
            Cancel
          </button>

          {/* Info note */}
          <p className="text-center text-xs text-gray-500 mt-4">
            💡 Both methods lead to full tree measurement and analysis
          </p>
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
                setState('USER_CHOICE');
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

  // AR Distance Measurement UI (PHASE E.4: Updated states)
  if (state === 'AR_READY' || state === 'AR_ACTIVE' || state === 'AR_SCANNING' || 
      state === 'AR_PLACE_FIRST' || state === 'AR_PLACE_SECOND' || 
      state === 'AR_COMPLETE') {
    return (
      <div ref={containerRef} className="fixed inset-0 z-50">
        {/* AR content renders here via Three.js */}
        
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

          {/* Instructions & UI Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent pointer-events-auto">
            <div className="max-w-md mx-auto text-center text-white">
              {(state === 'AR_READY' || state === 'AR_ACTIVE') && (
                <>
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-green-500" />
                  <p className="text-xl font-semibold">{instruction}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Tap "Start AR" button to begin
                  </p>
                </>
              )}
              {(state === 'AR_SCANNING' || isScanning) && (
                <>
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-green-500" />
                  <p className="text-xl font-semibold">{instruction}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Point your device at the ground to detect surfaces
                  </p>
                </>
              )}
              {state === 'AR_PLACE_FIRST' && showPlaceButton && (
                <>
                  <Target className="w-16 h-16 mx-auto mb-4 text-green-500 animate-pulse" />
                  <p className="text-xl font-semibold">{instruction}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Step 1 of 2: Position the reticle at the tree's base
                  </p>
                  {showUndoButton && (
                    <button
                      onClick={handleArUndoSafe}
                      className="mt-4 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium"
                    >
                      <RotateCcw className="w-5 h-5 inline mr-2" />
                      Undo
                    </button>
                  )}
                </>
              )}
              {state === 'AR_PLACE_SECOND' && (
                <>
                  <Target className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-pulse" />
                  <p className="text-xl font-semibold">{instruction}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Step 2 of 2: Position the reticle at your current position
                  </p>
                  {showUndoButton && (
                    <button
                      onClick={handleArUndoSafe}
                      className="mt-4 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium"
                    >
                      <RotateCcw className="w-5 h-5 inline mr-2" />
                      Undo
                    </button>
                  )}
                </>
              )}
              {state === 'AR_COMPLETE' && showConfirmButtons && (
                <>
                  <Check className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <p className="text-2xl font-bold">{instruction}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Distance: {uiDistance?.toFixed(2)}m
                  </p>
                  <div className="flex gap-4 mt-6 justify-center">
                    <button
                      onClick={handleArRedoSafe}
                      className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium"
                    >
                      <RotateCcw className="w-5 h-5 inline mr-2" />
                      Redo
                    </button>
                    <button
                      onClick={handleArConfirmSafe}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                    >
                      <Check className="w-5 h-5 inline mr-2" />
                      Confirm
                    </button>
                  </div>
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
        
        {/* PHASE D.2: Frozen frame overlay during point selection (prevents camera shake) */}
        {freezeFrameImage && state === 'POINT_SELECTION' && (
          <img
            src={freezeFrameImage}
            alt="Frozen frame"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ pointerEvents: 'none' }}
          />
        )}
        
        <canvas ref={canvasRef} className="hidden" />

        {/* PHASE D.3: Multi-point markers - 8px dots (matching Photo Method) */}
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
              {/* PHASE D.3: Small 8px dot marker */}
              <div
                className="w-2 h-2 rounded-full shadow-lg border-2 border-white"
                style={{
                  backgroundColor: point.color,
                  animation: state === 'POINT_SELECTION' ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
                }}
              />
              {/* Label - positioned below dot */}
              {state === 'POINT_SELECTION' && (
                <div
                  className="absolute top-3 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-semibold text-white shadow-lg whitespace-nowrap border border-white/30"
                  style={{ backgroundColor: `${point.color}cc` }}
                >
                  {index + 1}
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

        {/* PHASE E.2: Mask overlay - simplified (no orientation tracking) */}
        {state === 'FULL_ANALYSIS_COMPLETE' && maskImageBase64 && (
          <img
            src={`data:image/png;base64,${maskImageBase64}`}
            alt="Tree mask"
            className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen"
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
          <>
            {/* PHASE E.1: Back button */}
            <button
              onClick={handleBack}
              className="absolute top-4 left-4 z-20 bg-black/80 backdrop-blur-sm hover:bg-black/90 p-2 rounded-full transition-colors border border-white/20"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            {/* PHASE D.1: Minimal top instruction banner (floating pill) */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
              <div className="bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm max-w-xs text-center shadow-lg border border-white/20">
                Tap trunk for analysis
              </div>
            </div>

            {/* PHASE D.4: High-contrast species badge (only if species identified) */}
            {speciesName && speciesName !== 'Unknown species' && speciesName !== 'Species identification failed' && (
              <div className="absolute top-16 right-4 z-20 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg opacity-0 hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <div>
                    <div className="text-white font-semibold text-xs leading-tight">{speciesName}</div>
                    {speciesConfidence && <div className="text-gray-300 text-[10px]">{(speciesConfidence * 100).toFixed(0)}%</div>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {state === 'POINT_SELECTION' && (
          <>
            {/* PHASE E.1: Back button */}
            <button
              onClick={handleBack}
              className="absolute top-4 left-4 z-20 bg-black/80 backdrop-blur-sm hover:bg-black/90 p-2 rounded-full transition-colors border border-white/20"
              title="Back to Camera Ready"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            {/* PHASE D.1: Minimal top status banner */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
              <div className="bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs max-w-xs text-center shadow-lg border border-white/20">
                {tapPoints.length} point{tapPoints.length !== 1 ? 's' : ''} • {tapPoints.length < 2 ? 'Tap 2+ to analyze' : 'Ready to analyze'}
              </div>
            </div>

            {/* PHASE D.1: Minimal bottom controls (circular floating buttons) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
              <button
                onClick={handleUndoPoint}
                disabled={tapPoints.length === 0}
                className="bg-orange-600/90 backdrop-blur-sm text-white p-3 rounded-full shadow-xl hover:bg-orange-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-white/20"
                title="Undo"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              
              <button
                onClick={handleClearPoints}
                disabled={tapPoints.length === 0}
                className="bg-red-600/90 backdrop-blur-sm text-white p-3 rounded-full shadow-xl hover:bg-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-white/20"
                title="Clear"
              >
                <X className="w-5 h-5" />
              </button>
              
              <button
                onClick={handleSubmitPoints}
                disabled={tapPoints.length < 2}
                className="bg-green-600/90 backdrop-blur-sm text-white px-6 py-3 rounded-full font-semibold shadow-xl hover:bg-green-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-white/20"
              >
                <Check className="w-5 h-5 inline mr-1" />
                Analyze ({tapPoints.length})
              </button>
            </div>

            {/* PHASE D.4: High-contrast species badge (only if species identified) */}
            {speciesName && speciesName !== 'Unknown species' && speciesName !== 'Species identification failed' && (
              <div className="absolute top-16 right-4 z-20 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg opacity-0 hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <div>
                    <div className="text-white font-semibold text-xs leading-tight">{speciesName}</div>
                    {speciesConfidence && <div className="text-gray-300 text-[10px]">{(speciesConfidence * 100).toFixed(0)}%</div>}
                  </div>
                </div>
              </div>
            )}
          </>
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

        {state === 'FULL_ANALYSIS_COMPLETE' && metrics && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/90 to-transparent text-white">
            <div className="max-w-md mx-auto">
              {/* PHASE E.1: Back button */}
              <button
                onClick={handleBack}
                className="absolute top-4 left-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 p-2 rounded-full transition-colors z-20"
                title="Back to point selection"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

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
                onClick={() => setState('FULL_ANALYSIS_DETAILS')}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg font-bold text-lg hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Continue to Save
              </button>
            </div>
          </div>
        )}

        {/* PHASE B: Two-Flow Choice Screen (appears AFTER distance, BEFORE SAM) */}
        {state === 'TWO_FLOW_CHOICE' && (
          <div className="p-6 bg-gradient-to-t from-black/95 via-black/90 to-transparent text-white">
            <div className="max-w-md mx-auto">
              {/* PHASE E.1: Back button */}
              <button
                onClick={handleBack}
                className="absolute top-4 left-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 p-2 rounded-full transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-bold text-center mb-3">
                How would you like to proceed?
              </h2>
              <p className="text-center text-gray-300 text-sm mb-6">
                Choose your workflow based on your needs
              </p>

              {/* Quick Save Option */}
              <button
                onClick={handleChooseQuickSave}
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
                      <span>Photo • Distance • Location • Basic Details</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Full Analysis Option */}
              <button
                onClick={handleChooseFullAnalysis}
                className="w-full p-5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500 rounded-xl hover:from-green-500/30 hover:to-emerald-500/30 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-green-500 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                      Full Analysis
                      <span className="text-xs bg-green-500 px-2 py-0.5 rounded-full">Detailed</span>
                    </h3>
                    <p className="text-sm text-gray-300">
                      Complete measurement with AI analysis, species identification, and CO₂ calculation.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-green-300">
                      <Check className="w-4 h-4" />
                      <span>SAM Analysis • Species • CO₂ • Full Details</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Info */}
              <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <p className="text-xs text-gray-400 text-center">Distance: {uiDistance?.toFixed(2)}m</p>
              </div>
            </div>
          </div>
        )}

        {/* Phase 5: Save Choice Screen - REMOVED (moved to TWO_FLOW_CHOICE) */}

        {/* PHASE B: Additional Details Form for QUICK SAVE */}
        {state === 'QUICK_SAVE_DETAILS' && (
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

                  {/* PHASE E.1: Back button */}
                  <button
                    onClick={handleBack}
                    className="absolute top-6 left-6 bg-white/10 backdrop-blur-sm hover:bg-white/20 p-2 rounded-full transition-colors"
                    title="Back"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <h2 className="text-2xl font-bold mb-2">Quick Save - Additional Details</h2>
                  <p className="text-gray-400 text-sm mb-6">
                    Optional information to enrich the database
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
                      className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      placeholder="e.g., Leaning towards east, evidence of fungal growth on trunk..."
                      className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional - Any additional observations</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setState('TWO_FLOW_CHOICE')}
                      className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleQuickSave}
                      className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Save Quick Capture
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PHASE B: Additional Details Form for FULL ANALYSIS */}
        {state === 'FULL_ANALYSIS_DETAILS' && metrics && (
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

                  {/* PHASE E.1: Back button */}
                  <button
                    onClick={handleBack}
                    className="absolute top-6 left-6 bg-white/10 backdrop-blur-sm hover:bg-white/20 p-2 rounded-full transition-colors"
                    title="Back to results"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

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
                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setState('FULL_ANALYSIS_COMPLETE')}
                      className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleFullAnalysisSave}
                      className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Save Full Analysis
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
