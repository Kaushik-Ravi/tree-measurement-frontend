// src/components/ARMeasureView.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { Check, RotateCcw, X, Move, Plus } from 'lucide-react';

interface ARMeasureViewProps {
  onDistanceMeasured: (distance: number) => void;
  onCancel: () => void;
}

type ARState = 'SCANNING' | 'READY_TO_PLACE_FIRST' | 'READY_TO_PLACE_SECOND' | 'COMPLETE';

export function ARMeasureView({ onDistanceMeasured, onCancel }: ARMeasureViewProps) {
  const [arState, setArState] = useState<ARState>('SCANNING');
  const [distance, setDistance] = useState<number | null>(null);

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
  
  // --- START: SURGICAL CORRECTION ---
  // Ref to hold the onSelect function, making it accessible to the JSX.
  const onSelectRef = useRef<(() => void) | null>(null);
  // --- END: SURGICAL CORRECTION ---
  
  // --- UI Text State ---
  const [instruction, setInstruction] = useState("Move your phone to scan the ground.");

  // --- Core Action Handlers ---
  const handleConfirm = useCallback(() => {
    if (distance !== null) {
      onDistanceMeasured(distance);
    }
  }, [distance, onDistanceMeasured]);

  const handleRedo = useCallback(() => {
    pointsRef.current = [];
    setDistance(null);
    markersRef.current.forEach(marker => marker.visible = false);
    if (lineRef.current) lineRef.current.visible = false;
    setArState('SCANNING');
    setInstruction("Move your phone to scan the ground.");
  }, []);
  
  const handleUndo = useCallback(() => {
    if (arState === 'READY_TO_PLACE_SECOND' && pointsRef.current.length === 1) {
        pointsRef.current.pop();
        markersRef.current[0].visible = false;
        setArState('READY_TO_PLACE_FIRST');
        setInstruction("Tap '+' to place a marker at the tree's base.");
    }
  }, [arState]);

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
    currentContainer.appendChild(renderer.domElement);
    
    // --- 2. Scene Lighting & Objects ---
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.5));
    
    // A. Advanced Reticle (for surface detection feedback)
    const reticle = new THREE.Group();
    const reticleRing = new THREE.Mesh(
        new THREE.RingGeometry(0.06, 0.07, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true })
    );
    const reticleDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.01, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    reticle.add(reticleRing, reticleDot);
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
        if (!reticle.visible) return;

        if (arState === 'READY_TO_PLACE_FIRST' || arState === 'READY_TO_PLACE_SECOND') {
            const point = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
            const markerIndex = pointsRef.current.length;

            if (markerIndex < 2) {
                pointsRef.current.push(point);
                markersRef.current[markerIndex].position.copy(point);
                markersRef.current[markerIndex].visible = true;

                if (markerIndex === 0) { // First point placed
                    setArState('READY_TO_PLACE_SECOND');
                    setInstruction("Now, tap '+' to place a marker at your feet.");
                } else { // Second point placed
                    const [p1, p2] = pointsRef.current;
                    const calculatedDistance = p1.distanceTo(p2);
                    setDistance(calculatedDistance);

                    const linePositions = line.geometry.attributes.position as THREE.BufferAttribute;
                    linePositions.setXYZ(0, p1.x, p1.y, p1.z);
                    linePositions.setXYZ(1, p2.x, p2.y, p2.z);
                    linePositions.needsUpdate = true;
                    line.visible = true;

                    setArState('COMPLETE');
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

    // --- 4. The Chimera AR Button Solution ---
    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: currentContainer.querySelector('#ar-overlay')! }
    });
    
    arButton.textContent = "Start AR Measurement";
    Object.assign(arButton.style, {
        position: 'absolute', bottom: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', padding: '16px 32px',
        backgroundColor: 'rgb(var(--brand-primary))', color: 'white',
        border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer',
        fontSize: '18px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', transition: 'transform 0.2s'
    });
    arButton.onmouseenter = () => arButton.style.transform = 'translate(-50%, -50%) scale(1.05)';
    arButton.onmouseleave = () => arButton.style.transform = 'translate(-50%, -50%) scale(1)';
    
    currentContainer.appendChild(arButton);
    renderer.xr.addEventListener('sessionend', onCancel);

    // --- 5. Render Loop ---
    let surfaceFound = false;
    const render = (_: any, frame: XRFrame) => {
      const delta = clockRef.current.getDelta();

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
                    if (arState === 'SCANNING') {
                        setArState('READY_TO_PLACE_FIRST');
                        setInstruction("Tap '+' to place a marker at the tree's base.");
                    }
                }
                (reticleRing.material as THREE.MeshBasicMaterial).opacity = 1;
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
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onWindowResize);

    // --- 6. Cleanup Logic ---
    return () => {
      isMountedRef.current = false;
      renderer.setAnimationLoop(null);
      renderer.xr.getSession()?.end();
      controller.removeEventListener('select', onSelect);

      // Dispose of Three.js objects to prevent memory leaks
      scene.traverse(object => {
          if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              if (Array.isArray(object.material)) {
                  object.material.forEach(material => material.dispose());
              } else {
                  object.material.dispose();
              }
          }
      });

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      if (currentContainer) {
        while (currentContainer.firstChild) {
            currentContainer.removeChild(currentContainer.firstChild);
        }
      }
      window.removeEventListener('resize', onWindowResize);
    };
  }, [onCancel, arState]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black">
      <div id="ar-overlay" className="absolute inset-0 pointer-events-none">
        <div className="w-full h-full flex flex-col justify-between p-4 pointer-events-auto">
          {/* Top instruction/result panel */}
          <div className="w-full max-w-md mx-auto text-center bg-black/60 p-3 rounded-lg backdrop-blur-md">
            <p className="font-semibold text-white">{instruction}</p>
            {arState === 'COMPLETE' && (
              <div className="text-4xl font-bold mt-1 text-white">
                {distance?.toFixed(2)}m
              </div>
            )}
          </div>

          {/* Bottom action buttons */}
          <div className="flex justify-center items-center gap-4">
            {arState === 'SCANNING' && (
              <div className="flex items-center gap-2 text-white bg-black/60 p-3 rounded-lg backdrop-blur-md">
                <Move className="w-6 h-6 animate-pulse" />
                <span className="font-medium">Scanning for a surface...</span>
              </div>
            )}

            {(arState === 'READY_TO_PLACE_FIRST' || arState === 'READY_TO_PLACE_SECOND') && (
              <div className="flex items-center gap-6">
                <button
                    onClick={handleUndo}
                    disabled={arState !== 'READY_TO_PLACE_SECOND'}
                    className="p-4 bg-white/20 text-white rounded-full backdrop-blur-md disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                    <RotateCcw className="w-6 h-6" />
                </button>
                <button
                    // --- START: SURGICAL CORRECTION ---
                    // Directly invoke the function from the ref.
                    onClick={() => onSelectRef.current?.()}
                    // --- END: SURGICAL CORRECTION ---
                    className="p-6 bg-white text-black rounded-full shadow-lg"
                >
                    <Plus className="w-8 h-8" />
                </button>
                <div className="w-[64px]" />
              </div>
            )}

            {arState === 'COMPLETE' && (
              <>
                <button
                  onClick={handleRedo}
                  className="flex items-center gap-2 px-8 py-4 bg-amber-500 text-white rounded-full font-bold shadow-lg"
                >
                  <RotateCcw className="w-6 h-6" />
                  Redo
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex items-center gap-2 px-8 py-4 bg-green-600 text-white rounded-full font-bold shadow-lg"
                >
                  <Check className="w-6 h-6" />
                  Confirm
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}