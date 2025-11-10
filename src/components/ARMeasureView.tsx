// src/components/ARMeasureView.tsx
import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { Check, RotateCcw, Move, X, Scan } from 'lucide-react';

interface ARMeasureViewProps {
  onDistanceMeasured: (distance: number) => void;
  onCancel: () => void;
}

type ARState = 'SCANNING' | 'READY_TO_PLACE_FIRST' | 'READY_TO_PLACE_SECOND' | 'COMPLETE';

export function ARMeasureView({ onDistanceMeasured, onCancel }: ARMeasureViewProps) {
  console.log('📐 ========================================');
  console.log('📐 WebXR AR Ruler Component Mounted');
  console.log('📐 THIS USES OLD WEBXR (±15-30cm accuracy)');
  console.log('📐 NOT ARKit or ARCore!');
  console.log('📐 ========================================');
  
  // --- CRITICAL FIX: Use refs for AR state to prevent re-render cycles ---
  const arStateRef = useRef<ARState>('SCANNING');
  const distanceRef = useRef<number | null>(null);
  const measurementCompletedRef = useRef(false); // CRITICAL: Track if measurement was successful
  
  // UI state (safe to cause re-renders)
  const [instruction, setInstruction] = useState("Scan the ground to detect surface.");
  const [uiDistance, setUiDistance] = useState<number | null>(null);
  const [showConfirmButtons, setShowConfirmButtons] = useState(false);
  const [showPlaceButton, setShowPlaceButton] = useState(false);
  const [showUndoButton, setShowUndoButton] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [arSessionActive, setArSessionActive] = useState(false);
  const arButtonRef = useRef<HTMLElement | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);
  
  // Refs for Three.js objects to persist them across renders
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef(new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20));
  const reticleRef = useRef<THREE.Group | null>(null);
  const markersRef = useRef<THREE.Group[]>([]);
  const lineRef = useRef<THREE.Line | null>(null);
  const pointsRef = useRef<THREE.Vector3[]>([]);
  const clockRef = useRef(new THREE.Clock());
  const onSelectRef = useRef<(() => void) | null>(null);
  const allowMarkerPlacement = useRef(true); // Control flag for marker placement
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Wrapper function to prevent marker placement during UI button interactions
  const handleUIButtonClick = useCallback((callback: () => void) => {
    // Disable marker placement
    allowMarkerPlacement.current = false;
    
    // Clear any existing cooldown timer
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }
    
    // Execute the button's actual function
    callback();
    
    // Re-enable marker placement after cooldown
    cooldownTimerRef.current = setTimeout(() => {
      allowMarkerPlacement.current = true;
    }, 300); // 300ms cooldown to prevent accidental placement
  }, []);

  // --- Core Action Handlers ---
  const handleConfirm = useCallback(() => {
    if (distanceRef.current !== null) {
      measurementCompletedRef.current = true; // Mark measurement as successful
      onDistanceMeasured(distanceRef.current);
    }
  }, [onDistanceMeasured]);

  // Wrapped version for UI button (prevents marker placement)
  const handleConfirmSafe = useCallback(() => {
    handleUIButtonClick(handleConfirm);
  }, [handleConfirm, handleUIButtonClick]);

  const handleRedo = useCallback(() => {
    pointsRef.current = [];
    distanceRef.current = null;
    arStateRef.current = 'READY_TO_PLACE_FIRST'; // Skip scanning, go straight to placement
    
    // Update UI state
    setUiDistance(null);
    setShowConfirmButtons(false);
    setShowPlaceButton(true); // Immediately show place button
    setShowUndoButton(false);
    setIsScanning(false); // Don't show scanning state
    setInstruction("Point at tree's base, then tap screen");
    
    // Reset visual elements
    markersRef.current.forEach(marker => marker.visible = false);
    if (lineRef.current) lineRef.current.visible = false;
  }, []);
  
  // Wrapped version for UI button (prevents marker placement)
  const handleRedoSafe = useCallback(() => {
    handleUIButtonClick(handleRedo);
  }, [handleRedo, handleUIButtonClick]);
  
  const handleUndo = useCallback(() => {
    if (arStateRef.current === 'READY_TO_PLACE_SECOND' && pointsRef.current.length === 1) {
        pointsRef.current.pop();
        markersRef.current[0].visible = false;
        arStateRef.current = 'READY_TO_PLACE_FIRST';
        
        // Update UI state
        setShowUndoButton(false);
        setInstruction("Point at tree's base, then tap screen");
    }
  }, []);
  
  // Wrapped version for UI button (prevents marker placement)
  const handleUndoSafe = useCallback(() => {
    handleUIButtonClick(handleUndo);
  }, [handleUndo, handleUIButtonClick]);

  // Wrapped version of onCancel for UI button (prevents marker placement)
  const handleCancelSafe = useCallback(() => {
    handleUIButtonClick(onCancel);
  }, [onCancel, handleUIButtonClick]);

  // --- Main useEffect for AR Setup and Lifecycle ---
  useEffect(() => {
    if (isMountedRef.current) return;
    isMountedRef.current = true;
    
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    // --- 1. Core Three.js & WebXR Setup ---
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    
    // --- START: CRITICAL FIX - WebXR Canvas Styling for Mobile Viewport ---
    // Industry-standard pattern from Google WebXR, 8thWall, Meta Immersive Web
    // Prevents viewport shift when mobile browser UI (address bar) retracts during AR session
    Object.assign(renderer.domElement.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',              // Full viewport width (fallback)
      maxWidth: '100dvw',          // Dynamic viewport width (mobile browser adaptation)
      height: '100vh',             // Full viewport height (fallback)
      maxHeight: '100dvh',         // Dynamic viewport height (crucial for mobile AR)
      display: 'block',
      touchAction: 'none',         // Prevent touch gestures from interfering with AR
      zIndex: '1',                 // Behind UI overlay
      // iOS-specific fixes
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none'
    });
    // --- END: CRITICAL FIX ---
    
    currentContainer.appendChild(renderer.domElement);
    
    // --- 2. Scene Lighting & Objects ---
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.5));
    
    // A. High-Visibility Reticle (Magenta, 2.5x larger for forest visibility)
    const reticle = new THREE.Group();
    
    // Outer ring (primary indicator) - MAGENTA, 2.5x larger
    const reticleRing = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.17, 64).rotateX(-Math.PI / 2), // 15-17cm diameter
        new THREE.MeshBasicMaterial({ 
            color: 0xFF00FF, // Bright Magenta - maximum visibility
            opacity: 0.95, 
            transparent: true,
            side: THREE.DoubleSide
        })
    );
    
    // Inner ring (secondary feedback) - MAGENTA
    const reticleInnerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.07, 0.08, 64).rotateX(-Math.PI / 2), // 7-8cm diameter
        new THREE.MeshBasicMaterial({ 
            color: 0xFF00FF, // Magenta
            opacity: 0.7, 
            transparent: true,
            side: THREE.DoubleSide
        })
    );
    
    // Center dot - White for maximum contrast
    const reticleDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.025, 32).rotateX(-Math.PI / 2), // Larger dot
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    
    // Crosshair lines for precision - MAGENTA, thicker
    const crosshairMaterial = new THREE.LineBasicMaterial({ 
        color: 0xFF00FF, // Magenta
        transparent: true, 
        opacity: 0.8,
        linewidth: 3 // Thicker lines
    });
    
    // Longer crosshairs for better visibility
    const crosshairGeometry1 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.22, 0.001, 0),
        new THREE.Vector3(-0.18, 0.001, 0)
    ]);
    const crosshairGeometry2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.18, 0.001, 0),
        new THREE.Vector3(0.22, 0.001, 0)
    ]);
    const crosshairGeometry3 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.001, -0.22),
        new THREE.Vector3(0, 0.001, -0.18)
    ]);
    const crosshairGeometry4 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.001, 0.18),
        new THREE.Vector3(0, 0.001, 0.22)
    ]);
    
    const crosshair1 = new THREE.Line(crosshairGeometry1, crosshairMaterial);
    const crosshair2 = new THREE.Line(crosshairGeometry2, crosshairMaterial);
    const crosshair3 = new THREE.Line(crosshairGeometry3, crosshairMaterial);
    const crosshair4 = new THREE.Line(crosshairGeometry4, crosshairMaterial);
    
    reticle.add(reticleRing, reticleInnerRing, reticleDot, crosshair1, crosshair2, crosshair3, crosshair4);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    reticleRef.current = reticle;

    // B. Professional Markers (for placed points)
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

    // C. Measurement Line
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x4ade80, linewidth: 4 });
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.visible = false;
    scene.add(line);
    lineRef.current = line;

    // --- 3. WebXR Hit-Test & Controller Logic ---
    let hitTestSource: XRHitTestSource | null = null;
    let hitTestSourceRequested = false;

    // This is the core logic function for placing a point
    const onSelect = () => {
        // CRITICAL: Check if marker placement is allowed (prevents UI button interference)
        if (!allowMarkerPlacement.current) {
            console.log('[AR] Marker placement blocked - UI button interaction in progress');
            return;
        }
        
        if (!reticle.visible) return;

        const currentState = arStateRef.current;
        if (currentState === 'READY_TO_PLACE_FIRST' || currentState === 'READY_TO_PLACE_SECOND') {
            const point = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
            const markerIndex = pointsRef.current.length;

            if (markerIndex < 2) {
                pointsRef.current.push(point);
                markersRef.current[markerIndex].position.copy(point);
                markersRef.current[markerIndex].visible = true;

                if (markerIndex === 0) { // First point placed
                    arStateRef.current = 'READY_TO_PLACE_SECOND';
                    setShowUndoButton(true);
                    setInstruction("Point at your feet, then tap screen");
                } else { // Second point placed
                    const [p1, p2] = pointsRef.current;
                    const calculatedDistance = p1.distanceTo(p2);
                    distanceRef.current = calculatedDistance;
                    
                    // Update UI state
                    setUiDistance(calculatedDistance);
                    setShowPlaceButton(false);
                    setShowUndoButton(false);
                    setShowConfirmButtons(true);

                    const linePositions = line.geometry.attributes.position as THREE.BufferAttribute;
                    linePositions.setXYZ(0, p1.x, p1.y, p1.z);
                    linePositions.setXYZ(1, p2.x, p2.y, p2.z);
                    linePositions.needsUpdate = true;
                    line.visible = true;

                    arStateRef.current = 'COMPLETE';
                    setInstruction("Measurement Complete");
                }
            }
        }
    };
    
    // --- START: SURGICAL CORRECTION ---
    // Assign the function to the ref so the JSX button can call it.
    onSelectRef.current = onSelect;
    // The controller still listens for the 'select' event for accessibility (e.g., screen tap),
    // but our primary UI will use the ref.
    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);
    // --- END: SURGICAL CORRECTION ---

    // --- 4. The Chimera AR Button Strategy ---
    // We hide the Three.js ARButton behind our custom UI but keep it functional
    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: currentContainer.querySelector('#ar-overlay')! }
    });
    
    // Style the button to be invisible but still functional
    Object.assign(arButton.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: '0',
        pointerEvents: 'auto',
        width: '200px',
        height: '60px',
        zIndex: '100'
    });
    
    arButtonRef.current = arButton;
    currentContainer.appendChild(arButton);
    
    // Track AR session state
    renderer.xr.addEventListener('sessionstart', () => {
        setArSessionActive(true);
    });
    
    renderer.xr.addEventListener('sessionend', () => {
        setArSessionActive(false);
        // CRITICAL FIX: Only call onCancel if measurement wasn't completed successfully
        if (!measurementCompletedRef.current) {
          onCancel();
        }
    });

    // --- 5. Render Loop ---
    let surfaceFound = false;
    const render = (_: any, frame: XRFrame) => {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();
        if (!session) return;

        if (!hitTestSourceRequested) {
          session.requestReferenceSpace('viewer').then(viewerSpace => {
            session.requestHitTestSource?.({ space: viewerSpace })?.then(source => { hitTestSource = source; });
          });
          session.addEventListener('end', () => { hitTestSourceRequested = false; hitTestSource = null; });
          hitTestSourceRequested = true;
        }

        if (hitTestSource) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(referenceSpace!);
            if (pose) {
                reticle.visible = true;
                reticle.matrix.fromArray(pose.transform.matrix);
                
                if (!surfaceFound) {
                    surfaceFound = true;
                    if (arStateRef.current === 'SCANNING') {
                        arStateRef.current = 'READY_TO_PLACE_FIRST';
                        setIsScanning(false);
                        setShowPlaceButton(true);
                        setInstruction("Point at tree's base, then tap screen");
                    }
                }
                // Enhanced reticle feedback: full opacity when surface locked
                (reticleRing.material as THREE.MeshBasicMaterial).opacity = 0.95;
                
                // Subtle pulse animation for the reticle
                const pulseScale = 1 + Math.sin(clockRef.current.getElapsedTime() * 3) * 0.05;
                reticle.children.forEach((child, index) => {
                    if (index < 2) { // Only pulse the rings
                        child.scale.set(pulseScale, pulseScale, pulseScale);
                    }
                });
            }
          } else {
            reticle.visible = false;
            (reticleRing.material as THREE.MeshBasicMaterial).opacity = 0.5;
          }
        }
      }

      // Pulse animation for markers
      markersRef.current.forEach(marker => {
        if(marker.visible) {
            const pulse = marker.children[1] as THREE.Mesh;
            pulse.scale.x = pulse.scale.y = 1 + Math.sin(clockRef.current.getElapsedTime() * 5) * 0.1;
        }
      });

      renderer.render(scene, camera);
    };
    
    renderer.setAnimationLoop(render);

    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        
        // CRITICAL FIX: Only resize if not in active XR session
        // This prevents the "Can't change size while VR device is presenting" error
        const xrSession = renderer.xr.getSession();
        if (!xrSession || !renderer.xr.isPresenting) {
          renderer.setSize(window.innerWidth, window.innerHeight);
        }
    };
    window.addEventListener('resize', onWindowResize);

    // --- START: VISUAL VIEWPORT API INTEGRATION (Mobile Browser Adaptation) ---
    // Handles dynamic mobile browser UI changes (address bar show/hide)
    // Reference: https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API
    let visualViewportHandler: (() => void) | null = null;

    if ('visualViewport' in window && window.visualViewport) {
      const vv = window.visualViewport;
      
      visualViewportHandler = () => {
        // Only adjust when NOT in XR session (XR manages its own sizing)
        const currentSession = renderer.xr.getSession();
        if (!currentSession || !renderer.xr.isPresenting) {
          camera.aspect = vv.width / vv.height;
          camera.updateProjectionMatrix();
          renderer.setSize(vv.width, vv.height, false); // false = don't update style
          
          console.log('[AR Viewport] Adjusted to visual viewport:', vv.width, 'x', vv.height);
        }
      };
      
      vv.addEventListener('resize', visualViewportHandler);
      vv.addEventListener('scroll', visualViewportHandler);
      
      console.log('[AR Viewport] Visual Viewport API active - mobile browser UI adaptation enabled');
    }
    // --- END: VISUAL VIEWPORT API INTEGRATION ---

    // --- 6. Cleanup Logic ---
    return () => {
      isMountedRef.current = false;
      renderer.setAnimationLoop(null);
      
      // --- START: SURGICAL ENHANCEMENT (WebGL Context Leak Fix) ---
      // End XR session gracefully
      const currentSession = renderer.xr.getSession();
      if (currentSession) {
        currentSession.end().catch((err) => console.warn('XR session end error:', err));
      }
      
      // Remove event listeners
      controller.removeEventListener('select', onSelect);
      window.removeEventListener('resize', onWindowResize);

      // Clean up Visual Viewport API listeners
      if (visualViewportHandler && 'visualViewport' in window && window.visualViewport) {
        const vv = window.visualViewport;
        vv.removeEventListener('resize', visualViewportHandler);
        vv.removeEventListener('scroll', visualViewportHandler);
      }

      // Clear cooldown timer
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }

      // Comprehensive Three.js cleanup to prevent WebGL context leaks
      scene.traverse(object => {
          if (object instanceof THREE.Mesh) {
              // Dispose geometry
              if (object.geometry) {
                object.geometry.dispose();
              }
              
              // Dispose material(s)
              if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                      if (material.map) material.map.dispose();
                      if (material.lightMap) material.lightMap.dispose();
                      if (material.bumpMap) material.bumpMap.dispose();
                      if (material.normalMap) material.normalMap.dispose();
                      if (material.specularMap) material.specularMap.dispose();
                      if (material.envMap) material.envMap.dispose();
                      material.dispose();
                    });
                } else {
                    if (object.material.map) object.material.map.dispose();
                    if (object.material.lightMap) object.material.lightMap.dispose();
                    if (object.material.bumpMap) object.material.bumpMap.dispose();
                    if (object.material.normalMap) object.material.normalMap.dispose();
                    if (object.material.specularMap) object.material.specularMap.dispose();
                    if (object.material.envMap) object.material.envMap.dispose();
                    object.material.dispose();
                }
              }
          } else if (object instanceof THREE.Line) {
              // Dispose line geometry and material
              if (object.geometry) object.geometry.dispose();
              if (object.material) {
                if (Array.isArray(object.material)) {
                  object.material.forEach(mat => mat.dispose());
                } else {
                  object.material.dispose();
                }
              }
          }
      });

      // Clear scene
      while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
      }

      // Dispose renderer and force WebGL context loss (CRITICAL for Chrome)
      if (rendererRef.current) {
        const gl = rendererRef.current.getContext();
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        
        // Extra cleanup for WebGL context
        if (gl) {
          const loseContextExt = gl.getExtension('WEBGL_lose_context');
          if (loseContextExt) {
            loseContextExt.loseContext();
          }
        }
        
        rendererRef.current = null;
      }

      // Clear all refs
      reticleRef.current = null;
      markersRef.current = [];
      lineRef.current = null;
      pointsRef.current = [];
      onSelectRef.current = null;
      
      // Remove DOM elements
      if (currentContainer) {
        while (currentContainer.firstChild) {
            currentContainer.removeChild(currentContainer.firstChild);
        }
      }
      // --- END: SURGICAL ENHANCEMENT ---
    };
  }, [onCancel]); // CRITICAL FIX: Removed arState from dependencies

  // Handler to trigger the hidden AR button
  const handleStartAR = useCallback(() => {
    arButtonRef.current?.click();
  }, []);

  return (
    <div ref={containerRef} className="ar-fullscreen z-50">
      {/* AR Entry Screen - Only shown before AR session starts */}
      {!arSessionActive && (
        <div className="absolute inset-0 z-50 bg-gradient-to-br from-background-default via-background-subtle to-background-inset dark:from-background-default dark:via-background-subtle dark:to-background-inset flex flex-col items-center justify-center p-6">
          {/* Exit Button */}
          <button
            onClick={handleCancelSafe}
            className="absolute top-4 right-4 p-3 rounded-full bg-background-subtle hover:bg-background-inset border border-stroke-default transition-all duration-200 group"
            aria-label="Cancel AR Measurement"
          >
            <X className="w-5 h-5 text-content-subtle group-hover:text-content-default" />
          </button>

          {/* Main Content */}
          <div className="max-w-md w-full space-y-8 text-center">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-brand-primary/20 rounded-full blur-2xl animate-pulse" />
                <div className="relative bg-gradient-to-br from-brand-primary to-brand-secondary p-6 rounded-full">
                  <Move className="w-16 h-16 text-content-on-brand" />
                </div>
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-content-default">
                AR Distance Measurement
              </h1>
              <p className="text-content-subtle text-lg leading-relaxed">
                Measure the distance from the tree's base to your position using augmented reality
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-background-subtle border border-stroke-default rounded-2xl p-6 space-y-4 text-left">
              <h2 className="font-semibold text-content-default flex items-center gap-2">
                <Scan className="w-5 h-5 text-brand-accent" />
                How it works:
              </h2>
              <ol className="space-y-3 text-sm text-content-subtle">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-content-on-brand flex items-center justify-center text-xs font-bold">1</span>
                  <span>Stand at your measurement position and scan the ground</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-content-on-brand flex items-center justify-center text-xs font-bold">2</span>
                  <span>Point your camera at the tree's base and tap the screen</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-content-on-brand flex items-center justify-center text-xs font-bold">3</span>
                  <span>Point your camera at your feet and tap the screen again</span>
                </li>
              </ol>
            </div>

            {/* Start Button - Positioned over the hidden AR button */}
            <div className="relative">
              <button
                onClick={handleStartAR}
                className="w-full bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary-hover text-content-on-brand font-bold py-5 px-8 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3 group"
              >
                <Move className="w-6 h-6 group-hover:animate-pulse" />
                <span className="text-lg">Start AR Measurement</span>
              </button>
            </div>

            {/* Help Text */}
            <p className="text-xs text-content-subtle">
              Make sure you're in a well-lit area with enough space to move around
            </p>
          </div>
        </div>
      )}

      {/* AR Session Overlay - Only shown during active AR session */}
      <div id="ar-overlay" className="absolute inset-0 pointer-events-none" style={{
        /* CRITICAL FIX: Safe-area insets prevent content from overlapping with iOS notch and home indicator */
        position: 'fixed',
        top: 'env(safe-area-inset-top, 0)',
        left: 'env(safe-area-inset-left, 0)',
        right: 'env(safe-area-inset-right, 0)',
        bottom: 'env(safe-area-inset-bottom, 0)',
        zIndex: 10,
      }}>
        <div className="w-full h-full flex flex-col justify-between p-4 md:p-6">
          
          {/* Top Bar: Instructions & Distance Display */}
          <div 
            className="flex items-start justify-between gap-4 pointer-events-auto"
            style={{
              /* Extra padding for devices with notch */
              paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))',
            }}
          >
            {/* Instruction Panel - NON-INTERACTIVE (visual only) */}
            <div className="flex-1 max-w-md bg-background-default/90 dark:bg-background-subtle/90 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-stroke-default pointer-events-none">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {isScanning && <Move className="w-6 h-6 text-brand-accent animate-pulse" />}
                  {showPlaceButton && <Move className="w-6 h-6 text-brand-primary animate-pulse" />}
                  {showConfirmButtons && <Check className="w-6 h-6 text-status-success" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-content-default">{instruction}</p>
                  {showConfirmButtons && uiDistance !== null && (
                    <div className="mt-2 text-3xl font-bold text-brand-primary">
                      {uiDistance.toFixed(2)} m
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Exit Button - INTERACTIVE */}
            <button
              onClick={handleCancelSafe}
              className="flex-shrink-0 p-3 bg-status-error/90 hover:bg-status-error text-white rounded-full backdrop-blur-md shadow-lg transition-all duration-200 pointer-events-auto"
              aria-label="Exit AR"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Controls: Context-Aware Action Buttons */}
          <div 
            className="flex justify-center items-end pointer-events-auto"
            style={{
              /* Ensures controls are visible above iOS home indicator */
              paddingBottom: `max(1.5rem, env(safe-area-inset-bottom, 1.5rem))`,
            }}
          >
            
            {/* Scanning State */}
            {isScanning && (
              <div className="bg-background-default/90 dark:bg-background-subtle/90 backdrop-blur-md rounded-2xl px-6 py-4 shadow-lg border border-stroke-default pointer-events-none">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-brand-accent/30 rounded-full blur-md animate-pulse" />
                    <Move className="relative w-6 h-6 text-brand-accent animate-pulse" />
                  </div>
                  <span className="font-medium text-content-default">Scanning surface...</span>
                </div>
              </div>
            )}

            {/* Placement State - TAP ANYWHERE TO PLACE */}
            {showPlaceButton && (
              <div className="flex items-center gap-4">
                {/* Undo Button - INTERACTIVE */}
                <button
                  onClick={handleUndoSafe}
                  disabled={!showUndoButton}
                  className="p-4 bg-background-default/90 dark:bg-background-subtle/90 backdrop-blur-md rounded-full border border-stroke-default shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-background-inset transition-all duration-200 group pointer-events-auto"
                  aria-label="Undo last point"
                >
                  <RotateCcw className="w-6 h-6 text-content-subtle group-hover:text-content-default transition-colors" />
                </button>
              </div>
            )}

            {/* Complete State */}
            {showConfirmButtons && (
              <div className="flex gap-3">
                {/* Redo Button - INTERACTIVE */}
                <button
                  onClick={handleRedoSafe}
                  className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-brand-accent to-brand-accent-hover hover:from-brand-accent-hover hover:to-brand-accent text-content-on-brand font-bold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-200 pointer-events-auto"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Redo</span>
                </button>

                {/* Confirm Button - INTERACTIVE */}
                <button
                  onClick={handleConfirmSafe}
                  className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-status-success to-brand-primary hover:from-status-success/90 hover:to-brand-primary/90 text-white font-bold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-200 pointer-events-auto"
                >
                  <Check className="w-5 h-5" />
                  <span>Confirm</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}