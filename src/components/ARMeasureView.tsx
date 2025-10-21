// src/components/ARMeasureView.tsx
// --- START: SURGICAL REPLACEMENT ---
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Check, X, RotateCcw, Scan, Move } from 'lucide-react';

// Props interface for communication with the parent component (App.tsx)
interface ARMeasureViewProps {
  startSession: boolean;
  onDistanceMeasured: (distance: number) => void;
  onCancel: () => void;
}

// State machine to manage the measurement process
type ARState = 'INITIALIZING' | 'READY_TO_PLACE_START' | 'READY_TO_PLACE_END' | 'COMPLETE';

export function ARMeasureView({ startSession, onDistanceMeasured, onCancel }: ARMeasureViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const arButtonRef = useRef<HTMLButtonElement | null>(null);
  const isMountedRef = useRef(false);

  const [arState, setArState] = useState<ARState>('INITIALIZING');
  const [distance, setDistance] = useState<number | null>(null);

  // Memoize handlers to prevent re-creation on re-render
  const handleConfirm = useCallback(() => {
    if (distance !== null) {
      onDistanceMeasured(distance);
    }
  }, [distance, onDistanceMeasured]);

  const handleReset = useCallback(() => {
    setDistance(null);
    setArState('READY_TO_PLACE_START');
  }, []);

  useEffect(() => {
    if (isMountedRef.current) return;
    isMountedRef.current = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    if (!containerRef.current) return;
    containerRef.current.appendChild(renderer.domElement);
    
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);
    
    // --- Visual Elements ---
    // Reticle (the target on the ground)
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Measurement Line
    const lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const measurementLine = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(measurementLine);

    // Markers for start/end points
    const markerGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.2, 16);
    markerGeometry.translate(0, 0.1, 0); // Position pivot at the base
    const markerMaterial = new THREE.MeshStandardMaterial({ color: 0x22c55e });
    const startMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    const endMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    scene.add(startMarker, endMarker);
    
    let startPoint: THREE.Vector3 | null = null;
    let endPoint: THREE.Vector3 | null = null;
    startMarker.visible = false;
    endMarker.visible = false;
    measurementLine.visible = false;

    let hitTestSource: XRHitTestSource | null = null;

    // --- State-driven UI Logic ---
    const updateUIState = (newState: ARState) => {
      startMarker.visible = newState === 'READY_TO_PLACE_END' || newState === 'COMPLETE';
      endMarker.visible = newState === 'COMPLETE';
      measurementLine.visible = startMarker.visible;
      if (newState === 'READY_TO_PLACE_START') {
        startPoint = null;
        endPoint = null;
        startMarker.visible = false;
        endMarker.visible = false;
        measurementLine.visible = false;
        setDistance(null);
      }
      setArState(newState);
    };
    
    const onSelect = () => {
      if (!reticle.visible) return;

      if (arState === 'READY_TO_PLACE_START') {
        startPoint = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
        startMarker.position.copy(startPoint);
        updateUIState('READY_TO_PLACE_END');
      } else if (arState === 'READY_TO_PLACE_END') {
        endPoint = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
        endMarker.position.copy(endPoint);
        
        const finalDistance = startPoint!.distanceTo(endPoint!);
        setDistance(finalDistance);
        
        measurementLine.geometry.setFromPoints([startPoint!, endPoint!]);
        updateUIState('COMPLETE');
      }
    };

    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // --- AR Session Management (No visible button) ---
    const arButton = document.createElement('button');
    arButton.id = "ar-button";
    arButton.style.display = 'none'; // Keep the button hidden
    arButtonRef.current = arButton;
    document.body.appendChild(arButton);
    
    // This is the Three.js helper that wires up the WebXR API
    const sessionInit = { requiredFeatures: ['hit-test', 'dom-overlay'], domOverlay: { root: containerRef.current?.querySelector('#ar-overlay')! } };
    arButton.onclick = () => {
        renderer.xr.getSession()?.end();
        navigator.xr?.requestSession('immersive-ar', sessionInit).then((session) => {
            renderer.xr.setSession(session);
        });
    };

    renderer.xr.addEventListener('sessionstart', () => {
      updateUIState('INITIALIZING');
    });

    renderer.xr.addEventListener('sessionend', () => {
      onCancel();
    });

    // --- Render Loop ---
    const render = (timestamp: any, frame: XRFrame) => {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        if (!referenceSpace) return;
        const session = renderer.xr.getSession();

        if (!hitTestSource) {
          session?.requestReferenceSpace('viewer').then(viewerSpace => {
            session.requestHitTestSource?.({ space: viewerSpace })?.then(source => {
              hitTestSource = source;
            });
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
              if (arState === 'INITIALIZING') {
                updateUIState('READY_TO_PLACE_START');
              }
            }
          } else {
            reticle.visible = false;
          }
        }
        
        if (arState === 'READY_TO_PLACE_END' && startPoint && reticle.visible) {
            const currentEndPoint = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
            measurementLine.geometry.setFromPoints([startPoint, currentEndPoint]);
            setDistance(startPoint.distanceTo(currentEndPoint));
        }
      }
      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(render);

    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onWindowResize);

    return () => {
      renderer.setAnimationLoop(null);
      renderer.xr.getSession()?.end();
      if (arButtonRef.current) document.body.removeChild(arButtonRef.current);
      if (containerRef.current && renderer.domElement.parentElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      window.removeEventListener('resize', onWindowResize);
      controller.removeEventListener('select', onSelect);
      renderer.dispose();
      isMountedRef.current = false;
    };
  }, [onCancel]); // Dependencies intentionally minimal to prevent re-setup

  // Effect to programmatically start the AR session
  useEffect(() => {
    if (startSession && arButtonRef.current) {
      arButtonRef.current.click();
    }
  }, [startSession]);

  const getInstructionText = () => {
    switch (arState) {
      case 'INITIALIZING': return "Searching for a surface... Slowly move your camera around.";
      case 'READY_TO_PLACE_START': return "Tap to place the first point at the tree's base.";
      case 'READY_TO_PLACE_END': return "Tap to place the second point at your location.";
      case 'COMPLETE': return "Measurement Complete";
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black">
      <div id="ar-overlay" className="absolute inset-0 pointer-events-none">
          <div className="w-full h-full flex flex-col justify-between p-4 pointer-events-auto">
            <div className="text-center bg-black/60 text-white p-4 rounded-xl backdrop-blur-sm flex flex-col items-center">
              {arState === 'INITIALIZING' && <Scan className="w-6 h-6 mb-2 animate-pulse text-cyan-300" />}
              <p className="font-semibold text-lg">{getInstructionText()}</p>
              {(arState === 'READY_TO_PLACE_END' || arState === 'COMPLETE') && (
                <div className="text-5xl font-bold mt-2 tracking-tight">
                    {distance !== null ? `${distance.toFixed(2)}m` : '...'}
                </div>
              )}
            </div>

            <div className="flex justify-center items-center gap-4">
              <button onClick={onCancel} className="flex items-center gap-2 px-6 py-3 bg-red-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm">
                <X className="w-6 h-6"/> Cancel
              </button>
              {(arState === 'READY_TO_PLACE_END' || arState === 'COMPLETE') && (
                <button onClick={handleReset} className="flex items-center gap-2 px-6 py-3 bg-gray-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm">
                  <RotateCcw className="w-6 h-6"/> Reset
                </button>
              )}
              {arState === 'COMPLETE' && (
                <button onClick={handleConfirm} className="flex items-center gap-2 px-6 py-3 bg-green-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm">
                  <Check className="w-6 h-6"/> Confirm
                </button>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}
// --- END: SURGICAL REPLACEMENT ---