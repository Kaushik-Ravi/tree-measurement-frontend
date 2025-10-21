// src/components/ARMeasureView.tsx
// --- START: SURGICAL REPLACEMENT ---
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Check, X, RotateCcw, Move3d, Camera } from 'lucide-react';

interface ARMeasureViewProps {
  onDistanceMeasured: (distance: number) => void;
  onCancel: () => void;
}

export function ARMeasureView({ onDistanceMeasured, onCancel }: ARMeasureViewProps) {
  const [instruction, setInstruction] = useState("Point camera at the ground to find a surface.");
  const [distance, setDistance] = useState<number | null>(null);
  const [session, setSession] = useState<XRSession | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<THREE.Vector3[]>([]);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef(new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20));
  const markersRef = useRef<THREE.Mesh[]>([]);
  const lineRef = useRef<THREE.Line | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  
  useEffect(() => {
    if ('xr' in navigator) {
      (navigator.xr as any).isSessionSupported('immersive-ar').then((supported: boolean) => {
        setIsSupported(supported);
        if (!supported) {
          setInstruction("AR measurement is not supported on this device or browser.");
        }
      });
    } else {
      setIsSupported(false);
      setInstruction("AR measurement is not supported on this browser.");
    }
  }, []);

  const handleReset = useCallback(() => {
    pointsRef.current = [];
    setDistance(null);
    markersRef.current.forEach(marker => (marker.visible = false));
    if (lineRef.current) lineRef.current.visible = false;
    setInstruction("Tap to place a marker at the base of the tree.");
  }, []);
  
  const startARSession = useCallback(async () => {
    if (!containerRef.current || !isSupported) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);
    
    // Themed 3D Object Materials
    const brandColor = new THREE.Color('rgb(46, 125, 50)'); // --brand-primary
    const markerMaterial = new THREE.MeshBasicMaterial({ color: brandColor });
    const lineMaterial = new THREE.LineBasicMaterial({ color: brandColor, linewidth: 3 });

    // Setup scene objects
    sceneRef.current.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.5));
    
    reticleRef.current = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.08, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('white'), opacity: 0.8, transparent: true })
    );
    reticleRef.current.matrixAutoUpdate = false;
    reticleRef.current.visible = false;
    sceneRef.current.add(reticleRef.current);

    const markerGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    markersRef.current = [new THREE.Mesh(markerGeometry, markerMaterial), new THREE.Mesh(markerGeometry, markerMaterial)];
    markersRef.current.forEach(marker => {
      marker.visible = false;
      sceneRef.current.add(marker);
    });

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    lineRef.current = new THREE.Line(lineGeometry, lineMaterial);
    lineRef.current.visible = false;
    sceneRef.current.add(lineRef.current);

    try {
      const xrSession = await (navigator.xr as any).requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: containerRef.current.querySelector('#ar-overlay')! },
      });

      xrSession.addEventListener('end', () => {
        setSession(null);
        onCancel();
      });

      await renderer.xr.setSession(xrSession);
      setSession(xrSession);
      setInstruction("Point camera at the ground to find a surface.");

      let hitTestSource: XRHitTestSource | null = null;
      let hitTestSourceRequested = false;

      const onSelect = () => {
        if (reticleRef.current?.visible && pointsRef.current.length < 2) {
            const point = new THREE.Vector3().setFromMatrixPosition(reticleRef.current.matrix);
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
      sceneRef.current.add(controller);

      const renderLoop = (_: any, frame: XRFrame) => {
        if (frame) {
          const referenceSpace = renderer.xr.getReferenceSpace();
          if (!hitTestSourceRequested) {
            // --- START: SURGICAL MODIFICATION ---
            xrSession.requestReferenceSpace('viewer').then((viewerSpace: XRReferenceSpace) => {
              xrSession.requestHitTestSource?.({ space: viewerSpace })?.then((source: XRHitTestSource) => { hitTestSource = source; });
            });
            // --- END: SURGICAL MODIFICATION ---
            hitTestSourceRequested = true;
          }

          if (hitTestSource && referenceSpace) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length > 0) {
              const hit = hitTestResults[0];
              reticleRef.current!.visible = true;
              reticleRef.current!.matrix.fromArray(hit.getPose(referenceSpace)!.transform.matrix);
            } else {
              reticleRef.current!.visible = false;
            }
          }
        }
        renderer.render(sceneRef.current, cameraRef.current);
      };
      
      renderer.setAnimationLoop(renderLoop);

    } catch (error) {
      console.error("Failed to start AR session:", error);
      setInstruction("Could not start AR session. Please allow permissions and try again.");
    }
  }, [isSupported, onCancel]);

  const handleConfirm = () => {
    if (distance !== null) {
      onDistanceMeasured(distance);
    }
  };

  const isMeasurementComplete = distance !== null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-background-default flex items-center justify-center">
      {!session && (
        <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-content-default">AR Distance Measurement</h2>
            <p className="text-content-subtle mt-2 mb-6 max-w-sm mx-auto">{instruction}</p>
            <button
                onClick={startARSession}
                disabled={!isSupported}
                className="flex items-center justify-center gap-3 px-8 py-4 bg-brand-primary text-content-on-brand rounded-lg font-semibold hover:bg-brand-primary-hover disabled:bg-background-inset disabled:text-content-subtle disabled:cursor-not-allowed shadow-lg shadow-brand-primary/20"
            >
                <Camera className="w-6 h-6"/>
                Start AR Session
            </button>
             <button onClick={onCancel} className="mt-4 text-sm text-content-subtle hover:underline">Cancel</button>
        </div>
      )}

      <div id="ar-overlay" className="absolute inset-0 pointer-events-none">
        {session && (
          <div className="w-full h-full flex flex-col justify-between p-4 pointer-events-auto">
            <div className="text-center bg-background-default/80 text-content-default p-3 rounded-lg backdrop-blur-md border border-stroke-default shadow-lg">
                <p className="font-semibold">{instruction}</p>
                {isMeasurementComplete && (
                    <div className="text-4xl font-bold mt-2 text-brand-primary">
                        {distance.toFixed(2)}m
                    </div>
                )}
            </div>

            <div className="flex justify-center items-center gap-4">
               {!isMeasurementComplete ? (
                  <div className="flex items-center gap-2 text-content-default bg-background-default/80 p-3 rounded-lg backdrop-blur-md border border-stroke-default shadow-lg">
                    <Move3d className="w-6 h-6 text-brand-secondary"/>
                    <span className="font-medium">Place two points to measure</span>
                  </div>
               ) : (
                <>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-6 py-4 bg-brand-accent text-white rounded-full font-bold shadow-lg hover:bg-brand-accent-hover"
                  >
                    <RotateCcw className="w-6 h-6"/>
                    Redo
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex items-center gap-2 px-6 py-4 bg-brand-primary text-content-on-brand rounded-full font-bold shadow-lg hover:bg-brand-primary-hover"
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
// --- END: SURGICAL REPLACEMENT ---