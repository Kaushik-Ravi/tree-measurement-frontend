// src/components/ARMeasureView.tsx
// --- START: SURGICAL REPLACEMENT ---
import React from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { Check, X, RotateCcw, Loader2, XCircle } from 'lucide-react';

interface ARMeasureViewProps {
  onDistanceMeasured: (distance: number) => void;
  onCancel: () => void;
}

export function ARMeasureView({ onDistanceMeasured, onCancel }: ARMeasureViewProps) {
  const [sessionActive, setSessionActive] = React.useState(false);
  const [distance, setDistance] = React.useState<number | null>(null);
  const [startPoint, setStartPoint] = React.useState<THREE.Vector3 | null>(null);
  const [instruction, setInstruction] = React.useState("Initializing AR Session...");
  const [error, setError] = React.useState<string | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    let isComponentMounted = true;
    let renderer: THREE.WebGLRenderer;
    let arButton: HTMLElement;

    const init = () => {
        if (!containerRef.current) return;

        // --- Upfront Support Check ---
        if (!navigator.xr) {
            setError("AR is not supported on this browser. Please use a compatible browser like Chrome on Android.");
            return;
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
        
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        
        containerRef.current.appendChild(renderer.domElement);
        
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        light.position.set(0.5, 1, 0.25);
        scene.add(light);
        
        const reticle = new THREE.Mesh(
          new THREE.RingGeometry(0.05, 0.07, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);

        const measurementLine = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 3 })
        );
        measurementLine.visible = false;
        scene.add(measurementLine);

        const startMarker = new THREE.Mesh(
            new THREE.SphereGeometry(0.02, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0x22c55e })
        );
        startMarker.visible = false;
        scene.add(startMarker);

        let localStartPoint: THREE.Vector3 | null = null;
        
        const onSelect = () => {
          if (reticle.visible) {
            const point = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
            localStartPoint = point; // Use local variable for render loop
            startMarker.position.copy(point);
            startMarker.visible = true;
            measurementLine.visible = true;
            if (isComponentMounted) setStartPoint(point); // Update React state
          }
        };

        const controller = renderer.xr.getController(0);
        controller.addEventListener('select', onSelect);
        scene.add(controller);

        arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
        arButton.textContent = 'Start AR';
        
        arButton.style.position = 'absolute';
        arButton.style.bottom = '50%';
        arButton.style.left = '50%';
        arButton.style.transform = 'translate(-50%, 50%)';
        arButton.style.padding = '12px 24px';
        arButton.style.backgroundColor = 'rgb(var(--brand-secondary))';
        arButton.style.color = 'white';
        arButton.style.border = 'none';
        arButton.style.borderRadius = '8px';
        arButton.style.fontWeight = 'bold';
        
        containerRef.current.appendChild(arButton);
        
        renderer.xr.addEventListener('sessionstart', () => {
            if(isComponentMounted) {
                setSessionActive(true);
                arButton.style.display = 'none';
            }
        });
        
        renderer.xr.addEventListener('sessionend', () => {
            if(isComponentMounted) {
                setSessionActive(false);
                arButton.style.display = 'block';
                onCancel();
            }
        });

        let hitTestSource: XRHitTestSource | null = null;

        function render(_: any, frame: XRFrame) {
          if (frame) {
            const referenceSpace = renderer.xr.getReferenceSpace();
            const session = renderer.xr.getSession();

            if (hitTestSource === null) {
              session?.requestReferenceSpace('viewer').then((viewerSpace) => {
                session.requestHitTestSource?.({ space: viewerSpace })?.then((source) => {
                  hitTestSource = source;
                });
              });
            }

            if (hitTestSource) {
              const hitTestResults = frame.getHitTestResults(hitTestSource);
              if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(referenceSpace!);
                reticle.visible = true;
                reticle.matrix.fromArray(pose!.transform.matrix);
              } else {
                reticle.visible = false;
              }
            }
            
            // --- Consolidated Logic within Render Loop ---
            if(localStartPoint) {
                const xrCamera = renderer.xr.getCamera();
                const cameraPosition = new THREE.Vector3();
                xrCamera.getWorldPosition(cameraPosition);

                const currentDistance = localStartPoint.distanceTo(cameraPosition);
                if(isComponentMounted) setDistance(currentDistance);

                const linePositions = (measurementLine.geometry.attributes.position as THREE.BufferAttribute);
                linePositions.setXYZ(0, localStartPoint.x, localStartPoint.y, localStartPoint.z);
                linePositions.setXYZ(1, cameraPosition.x, cameraPosition.y, cameraPosition.z);
                linePositions.needsUpdate = true;
            }

            if(isComponentMounted) {
                if(!sessionActive) {
                    setInstruction("Click 'Start AR' to begin.");
                } else if (!localStartPoint) {
                    setInstruction(reticle.visible ? "Tap to place a marker at the tree's base." : "Point camera at the ground to find a surface.");
                } else {
                    setInstruction("Distance from marker is shown below.");
                }
            }
          }
          renderer.render(scene, camera);
        }
        
        renderer.setAnimationLoop(render);

        return () => {
            isComponentMounted = false;
            renderer.setAnimationLoop(null);
            renderer.xr.getSession()?.end();
            if (containerRef.current) {
                // Clean up all children to prevent memory leaks
                while (containerRef.current.firstChild) {
                    containerRef.current.removeChild(containerRef.current.firstChild);
                }
            }
            renderer.dispose();
        };
    };

    const cleanup = init();
    return cleanup;
  }, [onCancel]);


  const handleConfirm = () => {
    if (distance !== null) {
      onDistanceMeasured(distance);
    }
  };
  
  const handleReset = () => {
      // Logic inside the render loop will handle visuals based on startPoint state
      setStartPoint(null);
      setDistance(null);
  }
  
  if (error) {
    return (
        <div className="fixed inset-0 z-50 bg-background-default flex flex-col items-center justify-center text-center p-4">
            <XCircle className="w-12 h-12 text-status-error mb-4" />
            <h2 className="text-xl font-bold text-content-default">AR Not Supported</h2>
            <p className="max-w-md mt-2 text-content-subtle">{error}</p>
            <button onClick={onCancel} className="mt-8 px-6 py-3 bg-brand-primary text-content-on-brand font-semibold rounded-lg hover:bg-brand-primary-hover">
              Return to Manual Entry
            </button>
        </div>
    );
  }


  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black">
      <div id="ar-overlay" className="absolute inset-0 pointer-events-none">
        {sessionActive ? (
          <div className="w-full h-full flex flex-col justify-between p-4 pointer-events-auto">
            <div className="text-center bg-black/60 text-white p-4 rounded-xl backdrop-blur-sm flex flex-col items-center">
                <p className="font-semibold text-lg">{instruction}</p>
                {startPoint && (
                    <div className="text-5xl font-bold mt-2 tracking-tight">
                        {distance !== null ? `${distance.toFixed(2)}m` : '...'}
                    </div>
                )}
            </div>
            
            <div className="flex justify-center items-center gap-4">
                <button onClick={onCancel} className="flex items-center gap-2 px-6 py-3 bg-red-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm">
                  <X className="w-6 h-6"/> Cancel
                </button>
                {startPoint && (
                  <button onClick={handleReset} className="flex items-center gap-2 px-6 py-3 bg-gray-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm">
                    <RotateCcw className="w-6 h-6"/> Reset
                  </button>
                )}
                <button onClick={handleConfirm} disabled={!startPoint || distance === null} className="flex items-center gap-2 px-6 py-3 bg-green-600/90 text-white rounded-full font-bold shadow-lg backdrop-blur-sm disabled:bg-gray-500/80">
                  <Check className="w-6 h-6"/> Confirm
                </button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {!error && <Loader2 className="w-10 h-10 text-white animate-spin" />}
          </div>
        )}
      </div>
    </div>
  );
}
// --- END: SURGICAL REPLACEMENT ---