// src/components/ARMeasureView.tsx
// --- START: SURGICAL REPLACEMENT ---
import React from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { Check, X, RotateCcw, Move3d } from 'lucide-react';

interface ARMeasureViewProps {
  onDistanceMeasured: (distance: number) => void;
  onCancel: () => void;
}

export function ARMeasureView({ onDistanceMeasured, onCancel }: ARMeasureViewProps) {
  const [instruction, setInstruction] = React.useState("Point camera at the ground to find a surface.");
  const [distance, setDistance] = React.useState<number | null>(null);
  
  // Refs are used for mutable objects that need to persist across renders
  // and be accessible by the imperative Three.js render loop.
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pointsRef = React.useRef<THREE.Vector3[]>([]);
  const isMountedRef = React.useRef(false);
  const sceneRef = React.useRef<THREE.Scene | null>(null);

  // We keep a ref to the markers to update their visibility/position
  const markersRef = React.useRef<THREE.Mesh[]>([]);
  const lineRef = React.useRef<THREE.Line | null>(null);

  const handleReset = React.useCallback(() => {
    pointsRef.current = [];
    setDistance(null);
    markersRef.current.forEach(marker => marker.visible = false);
    if (lineRef.current) lineRef.current.visible = false;
    setInstruction("Tap to place a marker at the base of the tree.");
  }, []);

  React.useEffect(() => {
    if (isMountedRef.current) return;
    isMountedRef.current = true;

    // --- Core Three.js & WebXR Setup ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    
    containerRef.current?.appendChild(renderer.domElement);
    
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));
    
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.07, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    const markerGeometry = new THREE.SphereGeometry(0.025, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    markersRef.current = [new THREE.Mesh(markerGeometry, markerMaterial), new THREE.Mesh(markerGeometry, markerMaterial)];
    markersRef.current.forEach(marker => {
      marker.visible = false;
      scene.add(marker);
    });

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 });
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    lineRef.current = new THREE.Line(lineGeometry, lineMaterial);
    lineRef.current.visible = false;
    scene.add(lineRef.current);

    let hitTestSource: XRHitTestSource | null = null;
    let hitTestSourceRequested = false;

    const onSelect = () => {
      if (reticle.visible && pointsRef.current.length < 2) {
        const point = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
        pointsRef.current.push(point);

        const markerIndex = pointsRef.current.length - 1;
        markersRef.current[markerIndex].position.copy(point);
        markersRef.current[markerIndex].visible = true;

        if (pointsRef.current.length === 1) {
          setInstruction("Now, tap to place a marker at your feet.");
        } else if (pointsRef.current.length === 2) {
          const [p1, p2] = pointsRef.current;
          
          const p1Ground = p1.clone(); p1Ground.y = 0;
          const p2Ground = p2.clone(); p2Ground.y = 0;
          const calculatedDistance = p1Ground.distanceTo(p2Ground);
          setDistance(calculatedDistance);
          setInstruction("Measurement complete. Confirm to save.");

          const linePositions = lineRef.current!.geometry.attributes.position;
          linePositions.setXYZ(0, p1.x, p1.y, p1.z);
          linePositions.setXYZ(1, p2.x, p2.y, p2.z);
          linePositions.needsUpdate = true;
          lineRef.current!.visible = true;
        }
      }
    };

    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: containerRef.current?.querySelector('#ar-overlay')! }
    });
    
    arButton.addEventListener('click', () => {
        setInstruction("Point camera at the ground to find a surface.");
    });
    renderer.xr.addEventListener('sessionend', () => onCancel());

    if (containerRef.current) {
        containerRef.current.appendChild(arButton);
        arButton.id = 'ar-start-button';
        arButton.textContent = "Start AR Measurement";
        // Apply professional styling
        Object.assign(arButton.style, {
            position: 'absolute', bottom: '20px', left: '50%',
            transform: 'translateX(-50%)', padding: '12px 24px',
            backgroundColor: 'rgb(var(--brand-primary))', color: 'white',
            border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'
        });
    }

    function render(_: any, frame: XRFrame) {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!hitTestSourceRequested) {
          session?.requestReferenceSpace('viewer').then(viewerSpace => {
            session.requestHitTestSource?.({ space: viewerSpace })?.then(source => { hitTestSource = source; });
          });
          session?.addEventListener('end', () => { hitTestSourceRequested = false; hitTestSource = null; });
          hitTestSourceRequested = true;
        }

        if (hitTestSource) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            reticle.visible = true;
            reticle.matrix.fromArray(hit.getPose(referenceSpace!)!.transform.matrix);
            if (pointsRef.current.length === 0) {
                 setInstruction("Tap to place a marker at the base of the tree.");
            }
          } else {
            reticle.visible = false;
          }
        }
      }
      renderer.render(scene, camera);
    }
    
    renderer.setAnimationLoop(render);
    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onWindowResize);

    return () => {
      isMountedRef.current = false;
      renderer.setAnimationLoop(null);
      renderer.xr.getSession()?.end();
      controller.removeEventListener('select', onSelect);
      if (containerRef.current) {
        while (containerRef.current.firstChild) {
            containerRef.current.removeChild(containerRef.current.firstChild);
        }
      }
      window.removeEventListener('resize', onWindowResize);
      renderer.dispose();
    };
  }, [onCancel]);

  const handleConfirm = () => {
    if (distance !== null) {
      onDistanceMeasured(distance);
    }
  };

  const isMeasurementComplete = distance !== null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black">
      <div id="ar-overlay" className="absolute inset-0 pointer-events-none">
          <div className="w-full h-full flex flex-col justify-between p-4 pointer-events-auto">
            {/* Top instruction/result panel */}
            <div className="text-center bg-black/60 text-white p-3 rounded-lg backdrop-blur-md">
                <p className="font-semibold">{instruction}</p>
                {isMeasurementComplete && (
                    <div className="text-4xl font-bold mt-2">
                        {distance.toFixed(2)}m
                    </div>
                )}
            </div>

            {/* Bottom action buttons */}
            <div className="flex justify-center items-center gap-4">
               {!isMeasurementComplete ? (
                  <div className="flex items-center gap-2 text-white bg-black/60 p-3 rounded-lg backdrop-blur-md">
                    <Move3d className="w-6 h-6"/>
                    <span className="font-medium">Place two points to measure</span>
                  </div>
               ) : (
                <>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-6 py-4 bg-amber-600 text-white rounded-full font-bold shadow-lg"
                  >
                    <RotateCcw className="w-6 h-6"/>
                    Redo
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex items-center gap-2 px-6 py-4 bg-green-600 text-white rounded-full font-bold shadow-lg"
                  >
                    <Check className="w-6 h-6"/>
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
// --- END: SURGICAL REPLACEMENT ---