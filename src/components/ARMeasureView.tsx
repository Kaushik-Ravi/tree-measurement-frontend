// src/components/ARMeasureView.tsx
// --- START: SURGICAL REPLACEMENT ---
import React from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { Check, X, Move3d, RotateCcw, ScanLine, Loader2, XCircle } from 'lucide-react';

interface ARMeasureViewProps {
  onDistanceMeasured: (distance: number) => void;
  onCancel: () => void;
}

export function ARMeasureView({ onDistanceMeasured, onCancel }: ARMeasureViewProps) {
  const [sessionActive, setSessionActive] = React.useState(false);
  const [distance, setDistance] = React.useState<number | null>(null);
  const [startPoint, setStartPoint] = React.useState<THREE.Vector3 | null>(null);
  const [instruction, setInstruction] = React.useState("Starting AR Session...");
  const [isReticleVisible, setIsReticleVisible] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const cleanupRef = React.useRef<() => void | null>();
  
  React.useEffect(() => {
    // This effect runs only once on mount to initialize the entire AR scene.
    if (cleanupRef.current) return;

    let isComponentMounted = true;
    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controller: THREE.Group;
    let reticle: THREE.Mesh;
    let measurementLine: THREE.Line;
    let startMarker: THREE.Mesh;
    let hitTestSource: XRHitTestSource | null = null;
    let hitTestSourceRequested = false;

    const init = () => {
        if (!containerRef.current) return;
        
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        
        containerRef.current.appendChild(renderer.domElement);
        
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        light.position.set(0.5, 1, 0.25);
        scene.add(light);
        
        reticle = new THREE.Mesh(
          new THREE.RingGeometry(0.05, 0.07, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);

        measurementLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), 
            new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 3 })
        );
        measurementLine.visible = false;
        scene.add(measurementLine);

        startMarker = new THREE.Mesh(
            new THREE.SphereGeometry(0.02, 16, 16), 
            new THREE.MeshBasicMaterial({ color: 0x22c55e })
        );
        startMarker.visible = false;
        scene.add(startMarker);

        const onSelect = () => {
          if (reticle.visible) {
            const point = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
            setStartPoint(point); // This triggers React state update
          }
        };

        controller = renderer.xr.getController(0);
        controller.addEventListener('select', onSelect);
        scene.add(controller);
        
        // --- Headless AR Button Logic ---
        const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });

        // This function will be called by ARButton if WebXR is not supported.
        arButton.onNoXR = () => {
          // Since this runs outside React's lifecycle, we can't set state directly.
          // The best we can do is remove the canvas and show a message via DOM manipulation.
          if (containerRef.current) {
            const errorDiv = document.createElement('div');
            errorDiv.className = "absolute inset-0 bg-background-default flex flex-col items-center justify-center text-center p-4";
            errorDiv.innerHTML = `
              <div class="lucide-icon" style="width: 48px; height: 48px; color: rgb(239, 68, 68); margin-bottom: 16px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
              </div>
              <h2 class="text-xl font-bold text-content-default">AR Not Supported</h2>
              <p class="max-w-md mt-2 text-content-subtle">This feature requires a compatible browser (like Chrome) on an AR-enabled device.</p>
              <button id="ar-error-cancel" class="mt-8 px-6 py-3 bg-brand-primary text-content-on-brand font-semibold rounded-lg hover:bg-brand-primary-hover">Return</button>
            `;
            containerRef.current.innerHTML = '';
            containerRef.current.appendChild(errorDiv);
            containerRef.current.querySelector('#ar-error-cancel')?.addEventListener('click', onCancel);
          }
        };

        renderer.xr.addEventListener('sessionstart', () => {
            if(isComponentMounted) setSessionActive(true);
        });
        
        renderer.xr.addEventListener('sessionend', () => {
            if(isComponentMounted) {
                setSessionActive(false);
                onCancel();
            }
        });

        // Hide and programmatically click the button to start the session flow
        arButton.style.display = 'none';
        containerRef.current.appendChild(arButton);
        arButton.click();

        function render(_: any, frame: XRFrame) {
          if (frame) {
            const referenceSpace = renderer.xr.getReferenceSpace();
            const session = renderer.xr.getSession();

            if (!hitTestSourceRequested) {
              session?.requestReferenceSpace('viewer').then((viewerSpace) => {
                session.requestHitTestSource?.({ space: viewerSpace })?.then((source) => {
                  hitTestSource = source;
                });
              });
              hitTestSourceRequested = true;
            }

            if (hitTestSource) {
              const hitTestResults = frame.getHitTestResults(hitTestSource);
              if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(referenceSpace!);
                reticle.matrix.fromArray(pose!.transform.matrix);
                reticle.visible = true;
              } else {
                reticle.visible = false;
              }
              if(isComponentMounted) setIsReticleVisible(reticle.visible);
            }
          }
          renderer.render(scene, camera);
        }
        
        renderer.setAnimationLoop(render);

        const onWindowResize = () => {
            if (renderer.xr.isPresenting) return;
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
        window.addEventListener('resize', onWindowResize);

        cleanupRef.current = () => {
            isComponentMounted = false;
            renderer.setAnimationLoop(null);
            renderer.xr.getSession()?.end().catch(e => console.warn("Session already ended.", e));
            if (containerRef.current && renderer.domElement.parentElement) {
                containerRef.current.removeChild(renderer.domElement);
            }
            window.removeEventListener('resize', onWindowResize);
            controller.removeEventListener('select', onSelect);
            renderer.dispose();
        };
    };

    init();

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [onCancel]);


  React.useEffect(() => {
    // This effect handles the logic *during* an active session based on React state
    if (!sessionActive) return;

    if (!startPoint) {
        if (!isReticleVisible) {
            setInstruction("Point camera at the ground to find a surface.");
        } else {
            setInstruction("Tap to place a marker at the tree's base.");
        }
    } else {
        setInstruction("Walk to your measurement spot. The distance will update live.");
        
        // This is a bit of a hack to get a render loop tied to React
        let animationFrameId: number;
        const updateDistance = () => {
            const cameraPosition = new THREE.Vector3();
            renderer.xr.getCamera(camera).getWorldPosition(cameraPosition);
            
            const currentDistance = startPoint.distanceTo(cameraPosition);
            setDistance(currentDistance);
            animationFrameId = requestAnimationFrame(updateDistance);
        };
        updateDistance();

        return () => cancelAnimationFrame(animationFrameId);
    }
  }, [sessionActive, startPoint, isReticleVisible, renderer]);


  const handleConfirm = () => {
    if (distance !== null) {
      onDistanceMeasured(distance);
    }
  };

  const handleReset = () => {
    setStartPoint(null);
    setDistance(null);
  };

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
          // Initial loading state before session starts
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="ml-4 text-white font-semibold">{instruction}</p>
          </div>
        )}
      </div>
    </div>
  );
}
// --- END: SURGICAL REPLACEMENT ---