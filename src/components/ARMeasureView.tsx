// src/components/ARMeasureView.tsx
// --- START: SURGICAL REPLACEMENT ---
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { Check, X, RotateCcw, ScanLine, AlertTriangle, Move, Loader2 } from 'lucide-react';

interface ARMeasureViewProps {
  onDistanceMeasured: (distance: number) => void;
  onCancel: () => void;
}

// This state machine now ONLY manages the workflow *inside* an active AR session.
type InSessionStatus = 'SEARCHING_SURFACE' | 'READY_TO_PLACE_START' | 'READY_TO_PLACE_END' | 'COMPLETE';

export function ARMeasureView({ onDistanceMeasured, onCancel }: ARMeasureViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  
  // This is the primary state. Is the AR session running or not?
  const [sessionActive, setSessionActive] = useState(false);
  const [status, setStatus] = useState<InSessionStatus>('SEARCHING_SURFACE');
  const [distance, setDistance] = useState<number | null>(null);

  // Refs for THREE objects to avoid re-renders and stale state issues
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
    setStatus('READY_TO_PLACE_START');
  }, []);

  useEffect(() => {
    if (cleanupRef.current) return; // Prevent re-initialization

    let isComponentMounted = true;
    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controller: THREE.Group;
    let reticle: THREE.Mesh;
    let hitTestSource: XRHitTestSource | null = null;
    let arButton: HTMLElement;

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

        // --- Core Change: Use ARButton for session management ---
        arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
        
        // Style the button to match our application's theme.
        arButton.style.position = 'absolute';
        arButton.style.bottom = '50%';
        arButton.style.left = '50%';
        arButton.style.transform = 'translate(-50%, -50%)';
        arButton.style.padding = '12px 24px';
        arButton.style.backgroundColor = 'rgb(var(--brand-secondary))';
        arButton.style.color = 'white';
        arButton.style.border = 'none';
        arButton.style.borderRadius = '8px';
        arButton.style.fontWeight = 'bold';
        arButton.style.cursor = 'pointer';
        arButton.textContent = "Start AR Measurement";
        
        containerRef.current.appendChild(arButton);
        
        renderer.xr.addEventListener('sessionstart', () => {
            if(isComponentMounted) setSessionActive(true);
        });
        renderer.xr.addEventListener('sessionend', () => {
            if(isComponentMounted) {
                setSessionActive(false);
                onCancel();
            }
        });
        
        window.addEventListener('resize', onWindowResize);
        renderer.setAnimationLoop(render);
    };

    const onSelect = () => {
      if (!reticle.visible) return;

      if (status === 'READY_TO_PLACE_START') {
        startPointRef.current = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
        if(startMarkerRef.current) startMarkerRef.current.position.copy(startPointRef.current);
        setStatus('READY_TO_PLACE_END');
      } else if (status === 'READY_TO_PLACE_END') {
        const endPoint = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
        if(endMarkerRef.current) endMarkerRef.current.position.copy(endPoint);
        
        const finalDistance = startPointRef.current!.distanceTo(endPoint);
        setDistance(finalDistance);
        
        if(measurementLineRef.current) measurementLineRef.current.geometry.setFromPoints([startPointRef.current!, endPoint]);
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
            if(isComponentMounted) setStatus(current => current === 'SEARCHING_SURFACE' ? 'READY_TO_PLACE_START' : current);
          }
        } else {
          reticle.visible = false;
        }
      }
      
      if (startMarkerRef.current) startMarkerRef.current.visible = status === 'READY_TO_PLACE_END' || status === 'COMPLETE';
      if (endMarkerRef.current) endMarkerRef.current.visible = status === 'COMPLETE';
      if (measurementLineRef.current) measurementLineRef.current.visible = !!startMarkerRef.current?.visible;
      
      if (status === 'READY_TO_PLACE_END' && startPointRef.current && reticle.visible) {
          const currentEndPoint = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
          if (measurementLineRef.current) measurementLineRef.current.geometry.setFromPoints([startPointRef.current, currentEndPoint]);
          if(isComponentMounted) setDistance(startPointRef.current.distanceTo(currentEndPoint));
      }
      renderer.render(scene, camera);
    };

    const onWindowResize = () => {
      if (!isComponentMounted) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    init();

    cleanupRef.current = () => {
      isComponentMounted = false;
      window.removeEventListener('resize', onWindowResize);
      renderer.setAnimationLoop(null);
      renderer.xr.getSession()?.end().catch(e => console.error("Error ending session on cleanup:", e));
      if (containerRef.current && arButton?.parentElement) {
        containerRef.current.removeChild(arButton);
      }
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
    switch (status) {
      case 'SEARCHING_SURFACE':
        return <><ScanLine className="w-8 h-8 mb-2 animate-pulse text-cyan-300" /> <p className="font-semibold text-lg">Searching for a surface...</p><p className="text-sm">Slowly move your camera around.</p></>;
      case 'READY_TO_PLACE_START':
        return <><Move className="w-6 h-6 mb-2"/> <p className="font-semibold text-lg">Tap to place first point at tree base.</p></>;
      case 'READY_TO_PLACE_END':
      case 'COMPLETE':
        const text = status === 'COMPLETE' ? 'Measurement Complete' : 'Tap to place second point.';
        return <><p className="font-semibold text-lg">{text}</p><div className="text-5xl font-bold mt-2 tracking-tight">{distance !== null ? `${distance.toFixed(2)}m` : '...'}</div></>;
      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black">
      <div id="ar-overlay" className="absolute inset-0 pointer-events-none">
        {sessionActive && (
          <div className="w-full h-full flex flex-col justify-between p-4 pointer-events-auto">
            <div className="text-center bg-black/60 text-white p-4 rounded-xl backdrop-blur-sm flex flex-col items-center">
              {getInstructionContent()}
            </div>
            
            <div className="flex justify-center items-center gap-4">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// --- END: SURGICAL REPLACEMENT ---