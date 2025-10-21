// src/components/ARMeasureView.tsx
// --- START: SURGICAL REPLACEMENT ---
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Check, X, RotateCcw, ScanLine, AlertTriangle, Move, Loader2, Camera } from 'lucide-react';

// Props interface for communication with the parent component (App.tsx)
interface ARMeasureViewProps {
  onDistanceMeasured: (distance: number) => void;
  onCancel: () => void;
}

// State machine to manage the measurement process and UI feedback
// --- START: SURGICAL MODIFICATION ---
// Added 'AWAITING_USER_START' as the initial state to ensure user-initiated session.
type ARStatus = 'AWAITING_USER_START' | 'REQUESTING_SESSION' | 'SESSION_FAILED' | 'SEARCHING_SURFACE' | 'READY_TO_PLACE_START' | 'READY_TO_PLACE_END' | 'COMPLETE';
// --- END: SURGICAL MODIFICATION ---

type SessionErrorType = 'GENERIC_FAILURE' | 'OVERLAY_UNSUPPORTED';

export function ARMeasureView({ onDistanceMeasured, onCancel }: ARMeasureViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  // --- START: SURGICAL ADDITION ---
  // A ref to hold the session start function, making it accessible to our React button's onClick handler.
  const startSessionFunc = useRef<(() => Promise<void>) | null>(null);
  // --- END: SURGICAL ADDITION ---

  const [status, setStatus] = useState<ARStatus>('AWAITING_USER_START');
  const [sessionError, setSessionError] = useState<SessionErrorType | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  const startPointRef = useRef<THREE.Vector3 | null>(null);
  const endPointRef = useRef<THREE.Vector3 | null>(null);
  const measurementLineRef = useRef<THREE.Line | null>(null);
  const startMarkerRef = useRef<THREE.Mesh | null>(null);
  const endMarkerRef = useRef<THREE.Mesh | null>(null);


  // Memoize handlers to prevent re-creation on re-render
  const handleConfirm = useCallback(() => {
    if (distance !== null) {
      onDistanceMeasured(distance);
    }
  }, [distance, onDistanceMeasured]);

  const handleReset = useCallback(() => {
    startPointRef.current = null;
    endPointRef.current = null;
    if (startMarkerRef.current) startMarkerRef.current.visible = false;
    if (endMarkerRef.current) endMarkerRef.current.visible = false;
    if (measurementLineRef.current) measurementLineRef.current.visible = false;
    setDistance(null);
    setStatus('READY_TO_PLACE_START');
  }, []);

  // --- START: SURGICAL ADDITION ---
  // This handler is called by the user clicking our React "Start AR" button.
  const handleStartAR = useCallback(() => {
    if (startSessionFunc.current) {
      startSessionFunc.current();
    }
  }, []);
  // --- END: SURGICAL ADDITION ---

  useEffect(() => {
    if (cleanupRef.current) {
      return;
    }

    let isComponentMounted = true;
    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controller: THREE.Group;
    let reticle: THREE.Mesh;
    let hitTestSource: XRHitTestSource | null = null;

    const init = () => {
        if (!containerRef.current) return;
        
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;

        containerRef.current.appendChild(renderer.domElement);
        
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
        light.position.set(0.5, 1, 0.25);
        scene.add(light);
        
        reticle = new THREE.Mesh( new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial() );
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);

        const lineGeometry = new THREE.BufferGeometry();
        measurementLineRef.current = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
        scene.add(measurementLineRef.current);

        const markerGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.2, 16);
        markerGeometry.translate(0, 0.1, 0); 
        const markerMaterial = new THREE.MeshStandardMaterial({ color: 0x22c55e });
        startMarkerRef.current = new THREE.Mesh(markerGeometry, markerMaterial);
        endMarkerRef.current = new THREE.Mesh(markerGeometry, markerMaterial);
        scene.add(startMarkerRef.current, endMarkerRef.current);
        
        startMarkerRef.current.visible = false;
        endMarkerRef.current.visible = false;
        measurementLineRef.current.visible = false;
        
        controller = renderer.xr.getController(0);
        controller.addEventListener('select', onSelect);
        scene.add(controller);
        
        renderer.xr.addEventListener('sessionend', () => isComponentMounted && onCancel());
        window.addEventListener('resize', onWindowResize);
        renderer.setAnimationLoop(render);
    };

    const requestARSession = async () => {
      if (!navigator.xr) {
        setSessionError('GENERIC_FAILURE');
        setStatus('SESSION_FAILED');
        return;
      }
      try {
        setStatus('REQUESTING_SESSION');
        const session = await navigator.xr.requestSession('immersive-ar', { 
            requiredFeatures: ['hit-test'], 
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: containerRef.current?.querySelector('#ar-overlay')! }
        });
        
        if (!session.domOverlayState) {
          throw new Error('OVERLAY_UNSUPPORTED');
        }

        await renderer.xr.setSession(session);
        setStatus('SEARCHING_SURFACE');
      } catch (error: any) {
        console.error("Failed to start AR session:", error);
        if (error.message === 'OVERLAY_UNSUPPORTED') {
          setSessionError('OVERLAY_UNSUPPORTED');
        } else {
          setSessionError('GENERIC_FAILURE');
        }
        setStatus('SESSION_FAILED');
      }
    };

    // --- START: SURGICAL MODIFICATION ---
    // Assign the session request function to our ref so the button can call it.
    startSessionFunc.current = requestARSession;
    // --- END: SURGICAL MODIFICATION ---

    const onSelect = () => {
      if (!reticle.visible) return;

      const currentStatus = status; 
      if (currentStatus === 'READY_TO_PLACE_START') {
        startPointRef.current = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
        if(startMarkerRef.current) startMarkerRef.current.position.copy(startPointRef.current);
        setStatus('READY_TO_PLACE_END');
      } else if (currentStatus === 'READY_TO_PLACE_END') {
        endPointRef.current = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
        if(endMarkerRef.current) endMarkerRef.current.position.copy(endPointRef.current);
        
        const finalDistance = startPointRef.current!.distanceTo(endPointRef.current!);
        setDistance(finalDistance);
        
        if(measurementLineRef.current) measurementLineRef.current.geometry.setFromPoints([startPointRef.current!, endPointRef.current!]);
        setStatus('COMPLETE');
      }
    };
    
    const render = (timestamp: any, frame: XRFrame) => {
      if (!frame || !renderer.xr.isPresenting) return;
        
      const referenceSpace = renderer.xr.getReferenceSpace();
      if (!referenceSpace) return;
      const session = renderer.xr.getSession();

      if (!hitTestSource) {
        session?.requestReferenceSpace('viewer').then(viewerSpace => {
          session.requestHitTestSource?.({ space: viewerSpace })?.then(source => { hitTestSource = source; });
        });
      }

      if (hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
          const hit = hitTestResults[0];
          const pose = hit.getPose(referenceSpace);
          if (pose) {
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
            setStatus(currentStatus => currentStatus === 'SEARCHING_SURFACE' ? 'READY_TO_PLACE_START' : currentStatus);
          }
        } else {
          reticle.visible = false;
        }
      }
      
      const currentStatus = status; 
      if (startMarkerRef.current) startMarkerRef.current.visible = currentStatus === 'READY_TO_PLACE_END' || currentStatus === 'COMPLETE';
      if (endMarkerRef.current) endMarkerRef.current.visible = currentStatus === 'COMPLETE';
      if (measurementLineRef.current) measurementLineRef.current.visible = !!startMarkerRef.current?.visible;
      
      if (currentStatus === 'READY_TO_PLACE_END' && startPointRef.current && reticle.visible) {
          const currentEndPoint = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
          if (measurementLineRef.current) measurementLineRef.current.geometry.setFromPoints([startPointRef.current, currentEndPoint]);
          setDistance(startPointRef.current.distanceTo(currentEndPoint));
      }
      renderer.render(scene, camera);
    };

    const onWindowResize = () => {
      if (!isComponentMounted) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    cleanupRef.current = () => {
      isComponentMounted = false;
      window.removeEventListener('resize', onWindowResize);
      renderer.setAnimationLoop(null);
      controller?.removeEventListener('select', onSelect);
      const session = renderer?.xr.getSession();
      if (session) {
        session.end().catch(e => console.error("Error ending session on cleanup:", e));
      }
      if (containerRef.current && renderer?.domElement.parentElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer?.dispose();
    };

    init();

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [onCancel]);


  const getInstructionContent = () => {
    switch (status) {
      case 'REQUESTING_SESSION':
        return <><Loader2 className="w-6 h-6 mb-2 animate-spin" /> <p className="font-semibold text-lg">Starting AR Camera...</p></>;
      case 'SESSION_FAILED':
        if (sessionError === 'OVERLAY_UNSUPPORTED') {
          return <><AlertTriangle className="w-8 h-8 mb-2 text-red-400" /> <p className="font-semibold text-lg">AR Error</p><p className="text-sm">Your device or browser does not support the required AR interface overlay.</p></>;
        }
        return <><AlertTriangle className="w-8 h-8 mb-2 text-red-400" /> <p className="font-semibold text-lg">Could not start AR session.</p><p className="text-sm">Please ensure your browser has camera permissions and try again.</p></>;
      case 'SEARCHING_SURFACE':
        return <><ScanLine className="w-8 h-8 mb-2 animate-pulse text-cyan-300" /> <p className="font-semibold text-lg">Searching for a surface...</p><p className="text-sm">Slowly move your camera around.</p></>;
      case 'READY_TO_PLACE_START':
        return <><Move className="w-6 h-6 mb-2"/> <p className="font-semibold text-lg">Tap to place first point at tree base.</p></>;
      case 'READY_TO_PLACE_END':
      case 'COMPLETE':
        const text = status === 'COMPLETE' ? 'Measurement Complete' : 'Tap to place second point at your location.';
        return <><p className="font-semibold text-lg">{text}</p><div className="text-5xl font-bold mt-2 tracking-tight">{distance !== null ? `${distance.toFixed(2)}m` : '...'}</div></>;
      // --- START: SURGICAL MODIFICATION ---
      // AWAITING_USER_START state does not show the top instruction bubble.
      case 'AWAITING_USER_START':
        return null;
      // --- END: SURGICAL MODIFICATION ---
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black">
      <div id="ar-overlay" className="absolute inset-0 pointer-events-none">
        {/* --- START: SURGICAL REPLACEMENT --- */}
        {/* This entire block is now conditional. It only shows UI *after* the user starts the session. */}
        {status !== 'AWAITING_USER_START' ? (
          <div className="w-full h-full flex flex-col justify-between p-4 pointer-events-auto">
            <div className="text-center bg-black/60 text-white p-4 rounded-xl backdrop-blur-sm flex flex-col items-center">
              {getInstructionContent()}
            </div>
            
            <div className="flex justify-center items-center gap-4">
              {status === 'SESSION_FAILED' ? (
                <button onClick={onCancel} className="flex items-center gap-2 px-6 py-3 bg-gray-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm">Go Back</button>
              ) : (
                <>
                  <button onClick={onCancel} className="flex items-center gap-2 px-6 py-3 bg-red-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm">
                    <X className="w-6 h-6"/> Cancel
                  </button>
                  {(status === 'READY_TO_PLACE_END' || status === 'COMPLETE') && (
                    <button onClick={handleReset} className="flex items-center gap-2 px-6 py-3 bg-gray-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm">
                      <RotateCcw className="w-6 h-6"/> Reset
                    </button>
                  )}
                  {status === 'COMPLETE' && (
                    <button onClick={handleConfirm} className="flex items-center gap-2 px-6 py-3 bg-green-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm">
                      <Check className="w-6 h-6"/> Confirm
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          // This is the new "Start" screen, shown before the session begins.
          <div className="w-full h-full flex flex-col items-center justify-center p-4 pointer-events-auto text-white text-center">
              <div className="bg-black/60 p-6 rounded-xl backdrop-blur-sm max-w-sm">
                <Camera className="w-12 h-12 mx-auto text-cyan-300" />
                <h2 className="text-xl font-bold mt-4">AR Measurement</h2>
                <p className="text-sm text-white/80 mt-2">
                  You are about to enter an immersive experience. Please be aware of your surroundings.
                </p>
                <button
                  onClick={handleStartAR}
                  className="mt-6 w-full px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold shadow-lg hover:bg-cyan-700 transition-colors"
                >
                  Start AR Session
                </button>
                 <button
                    onClick={onCancel}
                    className="mt-3 w-full px-4 py-2 text-sm text-white/70 hover:text-white"
                  >
                    Cancel
                  </button>
              </div>
          </div>
        )}
        {/* --- END: SURGICAL REPLACEMENT --- */}
      </div>
    </div>
  );
}
// --- END: SURGICAL REPLACEMENT ---