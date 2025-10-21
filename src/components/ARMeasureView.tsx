// src/components/ARMeasureView.tsx
// --- START: SURGICAL REPLACEMENT ---
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Check, X, RotateCcw, ScanLine, AlertTriangle, Move, Loader2, XCircle } from 'lucide-react';

interface ARMeasureViewProps {
  onDistanceMeasured: (distance: number) => void;
  onCancel: () => void;
}

type InSessionStatus = 'SEARCHING_SURFACE' | 'READY_TO_PLACE_START' | 'READY_TO_PLACE_END' | 'COMPLETE';
type ARStatus = 'INITIALIZING' | 'SUPPORTED' | 'NOT_SUPPORTED' | 'SESSION_ACTIVE' | 'ERROR';

export function ARMeasureView({ onDistanceMeasured, onCancel }: ARMeasureViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [arStatus, setArStatus] = useState<ARStatus>('INITIALIZING');
  const [inSessionStatus, setInSessionStatus] = useState<InSessionStatus>('SEARCHING_SURFACE');
  const [distance, setDistance] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startPointRef = useRef<THREE.Vector3 | null>(null);
  const measurementLineRef = useRef<THREE.Line | null>(null);
  const startMarkerRef = useRef<THREE.Mesh | null>(null);
  const endMarkerRef = useRef<THREE.Mesh | null>(null);

  const handleConfirm = useCallback(() => {
    if (distance !== null) {
      onDistanceMeasured(distance);
    }
  }, [distance, onDistanceMeasured]);

  const handleReset = useCallback(() => {
    startPointRef.current = null;
    if (startMarkerRef.current) startMarkerRef.current.visible = false;
    if (endMarkerRef.current) endMarkerRef.current.visible = false;
    if (measurementLineRef.current) measurementLineRef.current.visible = false;
    setDistance(null);
    setInSessionStatus('READY_TO_PLACE_START');
  }, []);

  useEffect(() => {
    if (cleanupRef.current) return;

    let isComponentMounted = true;
    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controller: THREE.Group;
    let reticle: THREE.Mesh;
    let hitTestSource: XRHitTestSource | null = null;
    let currentSession: XRSession | null = null;

    const init = async () => {
        if (!containerRef.current || !isComponentMounted) return;

        // 1. Check for WebXR and required features support
        if (!navigator.xr) {
            setErrorMessage("WebXR is not available on this browser. Please try Chrome on a compatible Android device.");
            setArStatus('NOT_SUPPORTED');
            return;
        }

        // --- START: SURGICAL MODIFICATION ---
        try {
            // Corrected API call: isSessionSupported only takes one argument.
            const supported = await navigator.xr.isSessionSupported('immersive-ar');
            if (!supported) {
                setErrorMessage("Immersive AR is not supported on this device. Try updating your browser or OS.");
                setArStatus('NOT_SUPPORTED');
                return;
            }
        } catch (e) {
            setErrorMessage("An error occurred while checking for AR support.");
            setArStatus('ERROR');
            return;
        }
        // --- END: SURGICAL MODIFICATION ---

        // --- If supported, proceed with Three.js setup ---
        setArStatus('SUPPORTED');

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
        
        reticle = new THREE.Mesh( new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.8, transparent: true }) );
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);

        measurementLineRef.current = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 }));
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
        
        // --- Programmatic Session Start ---
        try {
            const session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'] });
            currentSession = session;
            await renderer.xr.setSession(session);
        } catch (e: any) {
            console.error("Session request failed:", e.message);
            // --- START: SURGICAL MODIFICATION ---
            setErrorMessage("Could not start AR session. Permission may have been denied, or required features (like plane detection) are not supported on this device.");
            // --- END: SURGICAL MODIFICATION ---
            setArStatus('ERROR');
            return;
        }

        renderer.xr.addEventListener('sessionstart', () => {
            if(isComponentMounted) setArStatus('SESSION_ACTIVE');
        });

        renderer.xr.addEventListener('sessionend', () => {
            if(isComponentMounted) {
                setArStatus('SUPPORTED'); // Reset status but don't close component
                onCancel(); // Inform parent component
            }
        });
        
        window.addEventListener('resize', onWindowResize);
        renderer.setAnimationLoop(render);
    };

    const onSelect = () => {
      if (!reticle.visible) return;

      const currentPoint = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);

      if (inSessionStatus === 'READY_TO_PLACE_START') {
        startPointRef.current = currentPoint;
        if(startMarkerRef.current) startMarkerRef.current.position.copy(currentPoint);
        setInSessionStatus('READY_TO_PLACE_END');
      } else if (inSessionStatus === 'READY_TO_PLACE_END') {
        if(endMarkerRef.current) endMarkerRef.current.position.copy(currentPoint);
        const finalDistance = startPointRef.current!.distanceTo(currentPoint);
        setDistance(finalDistance);
        if(measurementLineRef.current) measurementLineRef.current.geometry.setFromPoints([startPointRef.current!, currentPoint]);
        setInSessionStatus('COMPLETE');
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
            if(isComponentMounted && inSessionStatus === 'SEARCHING_SURFACE') setInSessionStatus('READY_TO_PLACE_START');
          }
        } else {
          reticle.visible = false;
        }
      }
      
      if (startMarkerRef.current) startMarkerRef.current.visible = inSessionStatus === 'READY_TO_PLACE_END' || inSessionStatus === 'COMPLETE';
      if (endMarkerRef.current) endMarkerRef.current.visible = inSessionStatus === 'COMPLETE';
      if (measurementLineRef.current) measurementLineRef.current.visible = !!startMarkerRef.current?.visible;
      
      if (inSessionStatus === 'READY_TO_PLACE_END' && startPointRef.current && reticle.visible) {
          const currentEndPoint = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
          if (measurementLineRef.current) measurementLineRef.current.geometry.setFromPoints([startPointRef.current, currentEndPoint]);
          if(isComponentMounted) setDistance(startPointRef.current.distanceTo(currentEndPoint));
      }
      renderer.render(scene, camera);
    };

    const onWindowResize = () => {
      if (!isComponentMounted || renderer.xr.isPresenting) return; // Guard against resizing during AR session
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    init();

    cleanupRef.current = () => {
      isComponentMounted = false;
      window.removeEventListener('resize', onWindowResize);
      renderer.setAnimationLoop(null);
      currentSession?.end().catch(e => console.error("Error ending session on cleanup:", e));
      if (containerRef.current && renderer?.domElement.parentElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer?.dispose();
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [onCancel]);


  const getInstructionContent = () => {
    switch (inSessionStatus) {
      case 'SEARCHING_SURFACE':
        return <><ScanLine className="w-8 h-8 mb-2 animate-pulse text-cyan-300" /> <p className="font-semibold text-lg">Searching for a surface...</p><p className="text-sm">Slowly move your camera around.</p></>;
      case 'READY_TO_PLACE_START':
        return <><Move className="w-6 h-6 mb-2"/> <p className="font-semibold text-lg">Tap to place first point at tree base.</p></>;
      case 'READY_TO_PLACE_END':
      case 'COMPLETE':
        const text = inSessionStatus === 'COMPLETE' ? 'Measurement Complete' : 'Tap to place second point.';
        return <><p className="font-semibold text-lg">{text}</p><div className="text-5xl font-bold mt-2 tracking-tight">{distance !== null ? `${distance.toFixed(2)}m` : '...'}</div></>;
      default:
        return null;
    }
  };

  const renderContent = () => {
    switch(arStatus) {
      case 'SESSION_ACTIVE':
        return (
          <div className="w-full h-full flex flex-col justify-between p-4 pointer-events-auto">
            <div className="text-center bg-black/60 text-white p-4 rounded-xl backdrop-blur-sm flex flex-col items-center">
              {getInstructionContent()}
            </div>
            <div className="flex justify-center items-center gap-4">
                <button onClick={onCancel} className="flex items-center gap-2 px-6 py-3 bg-red-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm">
                  <X className="w-6 h-6"/> Cancel
                </button>
                {(inSessionStatus === 'READY_TO_PLACE_END' || inSessionStatus === 'COMPLETE') && (
                  <button onClick={handleReset} className="flex items-center gap-2 px-6 py-3 bg-gray-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm">
                    <RotateCcw className="w-6 h-6"/> Reset
                  </button>
                )}
                {inSessionStatus === 'COMPLETE' && (
                  <button onClick={handleConfirm} className="flex items-center gap-2 px-6 py-3 bg-green-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm">
                    <Check className="w-6 h-6"/> Confirm
                  </button>
                )}
            </div>
          </div>
        );

      case 'NOT_SUPPORTED':
      case 'ERROR':
        return (
          <div className="absolute inset-0 bg-background-default flex flex-col items-center justify-center text-center p-4">
            <XCircle className="w-12 h-12 text-status-error mb-4" />
            <h2 className="text-xl font-bold text-content-default">AR Measurement Unavailable</h2>
            <p className="max-w-md mt-2 text-content-subtle">{errorMessage}</p>
            <button onClick={onCancel} className="mt-8 px-6 py-3 bg-brand-primary text-content-on-brand font-semibold rounded-lg hover:bg-brand-primary-hover">
              Return to Manual Entry
            </button>
          </div>
        );
      
      case 'INITIALIZING':
      case 'SUPPORTED':
      default:
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="ml-4 text-white font-semibold">Starting AR session...</p>
          </div>
        );
    }
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black">
      <div id="ar-overlay" className="absolute inset-0 pointer-events-none">
        {renderContent()}
      </div>
    </div>
  );
}
// --- END: SURGICAL REPLACEMENT ---