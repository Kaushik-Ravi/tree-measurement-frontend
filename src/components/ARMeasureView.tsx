// src/components/ARMeasureView.tsx
// --- START: SURGICAL ADDITION ---
import React from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { Check, X, Move3d } from 'lucide-react';

// Props interface for communication with the parent component (App.tsx)
interface ARMeasureViewProps {
  onDistanceMeasured: (distance: number) => void;
  onCancel: () => void;
}

export function ARMeasureView({ onDistanceMeasured, onCancel }: ARMeasureViewProps) {
  const [sessionActive, setSessionActive] = React.useState(false);
  const [distance, setDistance] = React.useState<number | null>(null);
  const [startPoint, setStartPoint] = React.useState<THREE.Vector3 | null>(null);
  const [instruction, setInstruction] = React.useState("Point your camera at the ground to begin.");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isMountedRef = React.useRef(false);

  React.useEffect(() => {
    // Prevent running the effect twice in strict mode
    if (isMountedRef.current) return;
    isMountedRef.current = true;

    // --- Core Three.js & WebXR Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    
    if (containerRef.current) {
        containerRef.current.appendChild(renderer.domElement);
    }
    
    // Simple lighting
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);
    
    // Reticle (the circle on the ground)
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.07, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Measurement line
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const measurementLine = new THREE.Line(lineGeometry, lineMaterial);
    measurementLine.visible = false;
    scene.add(measurementLine);

    // Markers for start/end points
    const markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const startMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    startMarker.visible = false;
    scene.add(startMarker);

    let hitTestSource: XRHitTestSource | null = null;
    let hitTestSourceRequested = false;

    // Function to handle screen tap
    const onSelect = () => {
      if (reticle.visible) {
        const point = new THREE.Vector3();
        point.setFromMatrixPosition(reticle.matrix);
        setStartPoint(point);
        startMarker.position.copy(point);
        startMarker.visible = true;
        measurementLine.visible = true;
        setInstruction("Point at your current position to see the distance.");
      }
    };

    // --- AR Session Logic ---
    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: containerRef.current?.querySelector('#ar-overlay')! }
    });

    arButton.addEventListener('click', () => {
        setInstruction("Point your camera at the ground to find a surface.");
    });
    
    renderer.xr.addEventListener('sessionstart', () => setSessionActive(true));
    renderer.xr.addEventListener('sessionend', () => {
        setSessionActive(false);
        onCancel(); // Automatically cancel if user exits AR session
    });

    if (containerRef.current) {
        containerRef.current.appendChild(arButton);
        arButton.style.position = 'absolute';
        arButton.style.bottom = '20px';
        arButton.style.left = '50%';
        arButton.style.transform = 'translateX(-50%)';
        arButton.style.padding = '12px 24px';
        arButton.style.backgroundColor = 'rgb(var(--brand-primary))';
        arButton.style.color = 'white';
        arButton.style.border = 'none';
        arButton.style.borderRadius = '8px';
        arButton.style.fontWeight = 'bold';
        arButton.textContent = "Start AR Measurement";
    }

    // --- Render Loop ---
    function render(timestamp: any, frame: XRFrame) {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (hitTestSourceRequested === false) {
          session?.requestReferenceSpace('viewer').then((viewerSpace) => {
            session.requestHitTestSource?.({ space: viewerSpace })?.then((source) => {
              hitTestSource = source;
            });
          });
          session?.addEventListener('end', () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
          });
          hitTestSourceRequested = true;
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

        // Calculate and display distance if a start point is set
        if (startPoint) {
          const cameraPosition = new THREE.Vector3();
          camera.getWorldPosition(cameraPosition);
          
          // Project points onto the horizontal plane (y=0) for ground distance
          const startPointGround = startPoint.clone();
          startPointGround.y = 0;
          const cameraPositionGround = cameraPosition.clone();
          cameraPositionGround.y = 0;

          const currentDistance = startPointGround.distanceTo(cameraPositionGround);
          setDistance(currentDistance);

          // Update line visual
          const linePositions = measurementLine.geometry.attributes.position;
          linePositions.setXYZ(0, startPoint.x, startPoint.y, startPoint.z);
          linePositions.setXYZ(1, cameraPosition.x, cameraPosition.y, cameraPosition.z);
          linePositions.needsUpdate = true;
        }
      }
      renderer.render(scene, camera);
    }
    
    renderer.setAnimationLoop(render);

    // Handle window resize
    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onWindowResize);

    // --- Cleanup function ---
    return () => {
      renderer.setAnimationLoop(null);
      renderer.xr.getSession()?.end();
      if (containerRef.current && arButton.parentElement) {
        containerRef.current.removeChild(arButton);
      }
       if (containerRef.current && renderer.domElement.parentElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      window.removeEventListener('resize', onWindowResize);
      controller.removeEventListener('select', onSelect);
      renderer.dispose();
      isMountedRef.current = false;
    };
  }, [onCancel]);


  const handleConfirm = () => {
    if (distance !== null) {
      onDistanceMeasured(distance);
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black">
      {/* This overlay is used by WebXR DOM Overlay feature */}
      <div id="ar-overlay" className="absolute inset-0 pointer-events-none">
        {sessionActive && (
          <div className="w-full h-full flex flex-col justify-between p-4 pointer-events-auto">
            {/* Top instruction text */}
            <div className="text-center bg-black/50 text-white p-3 rounded-lg backdrop-blur-sm">
                <p className="font-semibold">{instruction}</p>
                {startPoint && (
                    <div className="text-4xl font-bold mt-2">
                        {distance !== null ? `${distance.toFixed(2)}m` : '...'}
                    </div>
                )}
            </div>

            {/* Bottom action buttons */}
            <div className="flex justify-center items-center gap-4">
               {!startPoint ? (
                  <div className="flex items-center gap-2 text-white bg-black/50 p-3 rounded-lg backdrop-blur-sm">
                    <Move3d className="w-6 h-6"/>
                    <span className="font-medium">Tap to place start point at tree base</span>
                  </div>
               ) : (
                <>
                  <button
                    onClick={onCancel}
                    className="flex items-center gap-2 px-6 py-4 bg-red-600 text-white rounded-full font-bold shadow-lg"
                  >
                    <X className="w-6 h-6"/>
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={distance === null}
                    className="flex items-center gap-2 px-6 py-4 bg-green-600 text-white rounded-full font-bold shadow-lg disabled:bg-gray-500"
                  >
                    <Check className="w-6 h-6"/>
                    Confirm
                  </button>
                </>
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// --- END: SURGICAL ADDITION ---