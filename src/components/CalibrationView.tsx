// src/components/CalibrationView.tsx
import React, { useState, useRef, useEffect } from 'react';
// --- START: SURGICAL MODIFICATION ---
import { Settings, Upload, X, Zap, RotateCcw, Ruler, Sparkles, Menu, Check, Info } from 'lucide-react';
// --- END: SURGICAL MODIFICATION ---
import { InstructionToast } from './InstructionToast';
import { ARMeasureView } from './ARMeasureView';
import { Magnifier } from './Magnifier';
// --- START: STANDARD REFERENCE OBJECTS INTEGRATION ---
import { ReferenceObjectSelector } from './ReferenceObjectSelector';
import { 
  StandardReferenceObject, 
  calculateFovRatioFromStandardObject,
  DEFAULT_CALIBRATION_DISTANCE 
} from '../utils/standardReferenceObjects';
// --- END: STANDARD REFERENCE OBJECTS INTEGRATION ---

interface Point { x: number; y: number; }

interface CalibrationViewProps {
  onCalibrationComplete: (fovRatio: number) => void;
}

const ARLinks = () => (
  // --- START: SURGICAL MODIFICATION ---
  <p className="text-xs text-content-subtle mt-2">
    Need help measuring? Try an AR app: {' '}
    <a href="https://play.google.com/store/apps/details?id=com.grymala.aruler&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-secondary hover:underline">
      Android
    </a>
    {' / '}
    <a href="https://apps.apple.com/us/app/ar-ruler-digital-tape-measure/id1326773975?platform=iphone" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-secondary hover:underline">
      iOS
    </a>
  </p>
  // --- END: SURGICAL MODIFICATION ---
);

export function CalibrationView({ onCalibrationComplete }: CalibrationViewProps) {
  const [calibFile, setCalibFile] = useState<File | null>(null);
  const [calibImageSrc, setCalibImageSrc] = useState<string>('');
  const [imageDimensions, setImageDimensions] = useState<{w: number, h: number} | null>(null);
  const [distance, setDistance] = useState('');
  const [realSize, setRealSize] = useState('');
  const [points, setPoints] = useState<Point[]>([]);
  const [instruction, setInstruction] = useState("A one-time camera calibration is needed.");
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [showInstructionToast, setShowInstructionToast] = useState(false);
  // --- START: SURGICAL ADDITION ---
  const [showARDistanceMeasure, setShowARDistanceMeasure] = useState(false);
  // Standard Reference Objects Integration
  const [showObjectSelector, setShowObjectSelector] = useState(false);
  const [selectedObject, setSelectedObject] = useState<StandardReferenceObject | null>(null);
  
  // Magnifier State
  const [magnifierState, setMagnifierState] = useState<{ show: boolean; x: number; y: number }>({ show: false, x: 0, y: 0 });
  // --- END: SURGICAL ADDITION ---
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPanelVisible) {
      setShowInstructionToast(false);
    }
  }, [isPanelVisible]);

  // --- MAGNIFIER HANDLERS ---
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canSelectPoints || isPanelVisible) return;
    
    // Get coordinates
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    setMagnifierState({ show: true, x: clientX, y: clientY });
  };

  const handlePointerLeave = () => {
    setMagnifierState(prev => ({ ...prev, show: false }));
  };
  // ---------------------------

  useEffect(() => {
    if (!calibFile) return;
    const tempImage = new Image();
    const objectURL = URL.createObjectURL(calibFile);
    tempImage.src = objectURL;
    tempImage.onload = () => {
        setImageDimensions({ w: tempImage.naturalWidth, h: tempImage.naturalHeight });
        setCalibImageSrc(tempImage.src);
        setInstruction("Image loaded. Enter distance and size details.");
    }
    // --- START: SURGICAL ADDITION ---
    // Clean up the object URL when the component unmounts or the file changes
    return () => URL.revokeObjectURL(objectURL);
    // --- END: SURGICAL ADDITION ---
  }, [calibFile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !calibImageSrc || !imageDimensions) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const img = new Image(); img.src = calibImageSrc;
    img.onload = () => {
        const parent = canvas.parentElement;
        if (!parent) return;
        const maxWidth = parent.clientWidth;
        const maxHeight = parent.clientHeight;
        const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        points.forEach(p => {
            const sp = { x: (p.x / imageDimensions!.w) * canvas.width, y: (p.y / imageDimensions!.h) * canvas.height };
            // --- START: SURGICAL MODIFICATION ---
            ctx.beginPath(); ctx.arc(sp.x, sp.y, 6, 0, 2 * Math.PI); ctx.fillStyle = 'rgb(var(--status-error))'; ctx.fill(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 2; ctx.stroke();
            // --- END: SURGICAL MODIFICATION ---
        });
    }
  }, [calibImageSrc, points, imageDimensions]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) { setCalibFile(file); setPoints([]); }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setShowInstructionToast(false);
    if (points.length >= 2 || !imageDimensions || !canvasRef.current) return;
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasClickX = (event.clientX - rect.left) * scaleX;
    const canvasClickY = (event.clientY - rect.top) * scaleY;

    const clickPoint: Point = { 
        x: Math.round((canvasClickX / canvas.width) * imageDimensions.w), 
        y: Math.round((canvasClickY / canvas.height) * imageDimensions.h) 
    };

    const newPoints = [...points, clickPoint];
    setPoints(newPoints);
    if (newPoints.length === 1) { 
        setInstruction("First point selected. Click the second endpoint or undo."); 
        setShowInstructionToast(true);
    }
    // --- START: SURGICAL MODIFICATION ---
    // DO NOT auto-confirm on 2nd point - show Confirm button instead (matches main app pattern)
    if (newPoints.length === 2) { 
        setInstruction("Two points marked! Click the green checkmark to confirm calibration."); 
        setShowInstructionToast(true);
    }
    // --- END: SURGICAL MODIFICATION ---
  };
  
  // --- START: SURGICAL ADDITION ---
  const handleUndo = () => {
    if (points.length > 0) {
      setPoints(p => p.slice(0, -1));
      setInstruction(points.length === 1 
        ? "Ready to mark. Click to place the first point."
        : "First point removed. Click to place the first point again."
      );
      setShowInstructionToast(true);
    }
  };

  const handleConfirmCalibration = () => {
    if (points.length === 2) {
      calculateAndFinish(points);
    }
  };
  // --- END: SURGICAL ADDITION ---

  const calculateAndFinish = (finalPoints: Point[]) => {
    if (!imageDimensions) return;
    
    // --- START: STANDARD REFERENCE OBJECTS ENHANCEMENT ---
    // Calculate pixel distance between marked points
    const pixelDistance = Math.hypot(
      finalPoints[0].x - finalPoints[1].x, 
      finalPoints[0].y - finalPoints[1].y
    );
    
    let cameraConstant: number;
    
    if (selectedObject) {
      // NEW PATH: Standard reference object selected - auto-calculate with known dimensions
      console.log('[Calibration] Using standard object:', selectedObject.name);
      
      cameraConstant = calculateFovRatioFromStandardObject(
        pixelDistance,
        selectedObject.id,
        imageDimensions.w,
        imageDimensions.h,
        DEFAULT_CALIBRATION_DISTANCE
      );
      
      setInstruction(`Calibration complete using ${selectedObject.name}!`);
    } else {
      // LEGACY PATH: Manual distance & size entry (preserve existing behavior)
      if (!distance || !realSize) {
        console.warn('[Calibration] Missing distance or real size for manual calibration');
        return;
      }
      
      console.log('[Calibration] Using manual distance entry');
      
      const r = parseFloat(realSize);
      const D_cm = parseFloat(distance); // Input is now in CM
      const w = Math.max(imageDimensions.w, imageDimensions.h);
      
      // Formula expects Distance in CM if Real Size is in CM
      // Camera Constant = (Real Size * Image Width) / (Pixel Distance * Distance)
      cameraConstant = (r * w) / (pixelDistance * D_cm);
    }
    // --- END: STANDARD REFERENCE OBJECTS ENHANCEMENT ---
    
    setIsPanelVisible(true);
    console.log(`[Calibration] Final Calculated Camera Constant (FOV Ratio): ${cameraConstant}`);
    setTimeout(() => onCalibrationComplete(cameraConstant), 1500);
  };

  const canSelectPoints = !!(
    calibFile && 
    (selectedObject || (distance && realSize)) // Either object selected OR manual values entered
  );

  const handlePrepareCalibration = () => {
    if (!canSelectPoints) return;
    
    // --- START: STANDARD REFERENCE OBJECTS ENHANCEMENT ---
    if (selectedObject) {
      setInstruction(selectedObject.instructionText);
    } else {
      setInstruction("Please click the two endpoints of your known object in the image.");
    }
    // --- END: STANDARD REFERENCE OBJECTS ENHANCEMENT ---
    
    setIsPanelVisible(false);
    setShowInstructionToast(true);
  };

  // --- START: SURGICAL ADDITION ---
  const handleARDistanceComplete = (measuredDistance: number) => {
    setDistance(measuredDistance.toFixed(2));
    setShowARDistanceMeasure(false);
    setInstruction("AR distance measured! Now enter the object's real size.");
  };

  const handleARDistanceCancel = () => {
    setShowARDistanceMeasure(false);
  };

  // Standard Reference Objects Handlers
  const handleObjectSelected = (obj: StandardReferenceObject | null) => {
    setShowObjectSelector(false);
    
    if (obj === null) {
      // User chose "Manual Entry" fallback - keep existing flow
      setSelectedObject(null);
      setInstruction("Manual mode: Enter distance and object size below.");
    } else {
      // User chose standard object - pre-fill real size, hide distance input
      setSelectedObject(obj);
      setRealSize((obj.widthMM / 10).toString()); // Convert mm to cm
      setDistance((obj.recommendedDistance * 100).toString()); // Convert m to cm for UI
      setInstruction(`${obj.name} selected! Upload photo and mark the object's width.`);
    }
  };

  const handleQuickStartWithObject = () => {
    setShowObjectSelector(true);
  };
  // --- END: SURGICAL ADDITION ---
  
  return (
    // --- START: SURGICAL REPLACEMENT ---
    <div className="h-screen w-screen bg-background-default font-inter flex flex-col md:flex-row overflow-hidden">
      <InstructionToast message={instruction} show={showInstructionToast} onClose={() => setShowInstructionToast(false)} />
        
      <div id="display-panel" className="flex-1 bg-background-inset flex items-center justify-center relative">
        {!calibFile && (
          <div className="hidden md:flex flex-col items-center text-content-subtle p-8 text-center max-w-md">
            <Settings size={64} className="mb-6 text-brand-primary/50"/>
            <h3 className="text-xl font-semibold text-content-default mb-2">Camera Calibration</h3>
            <p className="text-content-subtle mb-8">
              To measure trees accurately, we need to calibrate your camera first.
            </p>
            
            {!selectedObject ? (
              <div className="w-full space-y-4">
                <p className="text-sm font-medium text-content-default">Choose a standard object you have with you:</p>
                <button
                  onClick={handleQuickStartWithObject}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-brand-primary text-content-on-brand rounded-xl font-semibold shadow-lg hover:bg-brand-primary-hover hover:scale-[1.02] transition-all"
                >
                  <Sparkles className="w-5 h-5" />
                  Select Reference Object
                </button>
                <p className="text-xs text-content-subtle">
                  (Credit Card, ID Card, A4 Paper, etc.)
                </p>
              </div>
            ) : (
              <div className="w-full p-6 bg-brand-primary/5 border border-brand-primary/20 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-brand-primary/10 rounded-lg">
                    <Sparkles className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-content-default">{selectedObject.name}</p>
                    <p className="text-xs text-content-subtle">Selected Reference</p>
                  </div>
                </div>
                <div className="text-left text-sm text-content-default space-y-2 mb-6">
                  <p>1. Place your <strong>{selectedObject.name}</strong> on a wall or tree.</p>
                  <p>2. Stand about <strong>{selectedObject.recommendedDistance} meters</strong> away.</p>
                  <p>3. Take a photo showing the object clearly.</p>
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-primary text-content-on-brand rounded-lg font-medium hover:bg-brand-primary-hover transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  Upload Photo
                </button>
              </div>
            )}
          </div>
        )}
        <canvas 
          ref={canvasRef} 
          onClick={canSelectPoints ? handleCanvasClick : undefined}
          onMouseMove={handlePointerMove}
          onTouchMove={handlePointerMove}
          onTouchStart={handlePointerMove}
          onMouseLeave={handlePointerLeave}
          onTouchEnd={handlePointerLeave}
          className={`max-w-full max-h-full ${canSelectPoints && points.length < 2 && !isPanelVisible ? 'cursor-crosshair' : 'cursor-default'}`} 
        />
        
        {/* Magnifier Component */}
        {magnifierState.show && canSelectPoints && !isPanelVisible && (
          <Magnifier
            x={magnifierState.x}
            y={magnifierState.y}
            imageSrc={calibImageSrc}
            canvas={canvasRef.current}
          />
        )}
        
        {/* Floating Controls (Matches Main App Pattern) */}
        {points.length > 0 && !isPanelVisible && (
          <>
            {/* LEFT: Undo + Confirm Buttons (FloatingInteractionControls pattern) */}
            <div 
              className="fixed left-6 z-50 flex items-center gap-3 bg-background-subtle/95 text-content-default p-2 rounded-xl shadow-2xl backdrop-blur-md border border-stroke-default"
              style={{
                bottom: 'max(80px, calc(1.5rem + env(safe-area-inset-bottom, 0px)))',
              }}
            >
              <button 
                onClick={handleUndo} 
                disabled={points.length === 0}
                className="p-3 rounded-lg hover:bg-background-inset disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Undo last point"
              >
                <RotateCcw size={20} />
              </button>
              {points.length === 2 && (
                <>
                  <div className="w-px h-6 bg-stroke-default" />
                  <button 
                    onClick={handleConfirmCalibration}
                    className="p-3 rounded-lg bg-status-success text-white hover:opacity-90 transition-colors"
                    aria-label="Confirm calibration"
                  >
                    <Check size={20} />
                  </button>
                </>
              )}
            </div>

            {/* RIGHT: Hamburger Menu Button (Show Panel) */}
            <button 
              onClick={() => setIsPanelVisible(true)} 
              className="fixed right-6 z-50 p-4 bg-brand-primary text-content-on-brand rounded-full shadow-2xl hover:bg-brand-primary-hover active:scale-95 transition-transform flex items-center gap-2"
              style={{
                bottom: 'max(80px, calc(1.5rem + env(safe-area-inset-bottom, 0px)))',
              }}
            > 
              <Menu size={24} /> 
              <span className="text-sm font-semibold">Show Panel</span>
            </button>
          </>
        )}
      </div>
      
      <div 
        id="calibration-control-panel" 
        className={`
          bg-background-default border-r border-stroke-default flex flex-col transition-transform duration-300 ease-in-out 
          md:static md:w-[28rem] md:translate-y-0
          w-full fixed z-20 inset-0
          ${isPanelVisible ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-stroke-default md:hidden">
          <h2 className="font-semibold text-lg text-content-default">Camera Calibration</h2>
          {calibFile && (
            <button onClick={() => setIsPanelVisible(false)} className="p-2 text-content-subtle hover:text-content-default">
              <X size={24} />
            </button>
          )}
        </div>
        
        <div className="flex-grow overflow-y-auto p-4 md:p-6">
            <header className="flex-shrink-0">
                <div className="hidden md:flex items-center gap-3 mb-6"><Settings className="w-8 h-8 text-brand-primary" /><h1 className="text-2xl font-semibold text-content-default">Camera Calibration</h1></div>
                <div className="p-4 rounded-lg mb-6 bg-status-info/10 border border-status-info/20 text-status-info/80">
                    <p className="font-bold">Instructions</p>
                    <p className="text-sm">{instruction}</p>
                </div>
            </header>
            <main className="space-y-8">
                {/* STEP 1: REFERENCE OBJECT */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-brand-primary font-semibold">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-primary text-white text-xs">1</span>
                    <h3>Select Reference Object</h3>
                  </div>
                  
                  {!selectedObject ? (
                    <button
                      onClick={handleQuickStartWithObject}
                      className="w-full flex items-center justify-between p-4 bg-background-subtle border border-stroke-default rounded-xl hover:border-brand-primary hover:bg-brand-primary/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary group-hover:scale-110 transition-transform">
                          <Sparkles size={20} />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-content-default">Choose Standard Object</p>
                          <p className="text-xs text-content-subtle">Credit Card, A4 Paper, etc.</p>
                        </div>
                      </div>
                      <div className="text-brand-primary">Select &rarr;</div>
                    </button>
                  ) : (
                    <div className="p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-xl relative">
                      <button 
                        onClick={() => {
                          setSelectedObject(null);
                          setRealSize('');
                          setDistance('');
                          setInstruction("Manual mode: Enter distance and object size below.");
                        }}
                        className="absolute top-3 right-3 text-xs text-brand-primary hover:underline"
                      >
                        Change
                      </button>
                      <div className="flex items-center gap-3 mb-2">
                        <Sparkles className="w-5 h-5 text-brand-primary" />
                        <span className="font-semibold text-content-default">{selectedObject.name}</span>
                      </div>
                      <p className="text-sm text-content-subtle">{selectedObject.description}</p>
                      
                      {/* Privacy Note */}
                      {selectedObject.id === 'card_iso' && (
                        <div className="mt-3 flex gap-2 items-start text-xs text-content-subtle bg-background-default p-2 rounded border border-stroke-default">
                          <Info size={14} className="mt-0.5 text-brand-primary shrink-0" />
                          <span><strong>Privacy Note:</strong> This image is processed locally and <strong>never stored</strong> on any server. For extra safety, you can cover your card details with a piece of paper or turn the card over. We only need the card's shape!</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* STEP 2: VISUAL GUIDE (Only if object selected) */}
                {selectedObject && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2 text-brand-primary font-semibold">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-primary text-white text-xs">2</span>
                      <h3>How to Photograph</h3>
                    </div>
                    
                    <div className="bg-background-subtle p-4 rounded-xl border border-stroke-default text-sm space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 shrink-0" />
                        <p>Place object on a flat surface (wall, table, or floor).</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 shrink-0" />
                        <p>Stand about <strong>{selectedObject.recommendedDistance * 100} cm</strong> away.</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 shrink-0" />
                        <p>Ensure the object is clearly visible.</p>
                      </div>
                      
                      {/* CSS Visual Guide Shape */}
                      <div className="mt-4 h-32 bg-background-default rounded-lg border border-dashed border-stroke-default flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10 bg-grid-pattern" />
                        {/* Dynamic Shape based on object ratio */}
                        <div 
                          className="border-2 border-brand-primary bg-brand-primary/10 relative flex items-center justify-center"
                          style={{
                            width: selectedObject.widthMM > selectedObject.heightMM ? '120px' : '80px',
                            height: selectedObject.widthMM > selectedObject.heightMM ? '75px' : '110px',
                            borderRadius: '6px'
                          }}
                        >
                          <div className="absolute -bottom-6 w-full flex items-center justify-center gap-1 text-xs text-brand-primary font-mono">
                            <div className="h-px w-4 bg-brand-primary" />
                            <span>WIDTH</span>
                            <div className="h-px w-4 bg-brand-primary" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: UPLOAD */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-brand-primary font-semibold">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-primary text-white text-xs">{selectedObject ? '3' : '2'}</span>
                    <h3>Upload Photo</h3>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-background-default border-2 border-dashed border-stroke-default rounded-xl hover:border-brand-primary hover:bg-brand-primary/5 transition-all">
                    <Upload className="w-5 h-5 text-content-subtle" />
                    <span className="text-content-default font-medium">{calibFile ? 'Change Photo' : 'Choose Photo'}</span>
                  </button>
                </div>

                {/* STEP 4: DETAILS */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-brand-primary font-semibold">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-primary text-white text-xs">{selectedObject ? '4' : '3'}</span>
                    <h3>Verify Details</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-content-subtle mb-1">
                        Distance (cm)
                      </label>
                      <input 
                        type="number" 
                        value={distance} 
                        onChange={e => setDistance(e.target.value)} 
                        placeholder="e.g. 100"
                        className="w-full text-base px-3 py-2 border border-stroke-default bg-background-default rounded-lg focus:ring-2 focus:ring-brand-primary" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-content-subtle mb-1">
                        Object Width (cm)
                      </label>
                      <input 
                        type="number" 
                        value={realSize} 
                        onChange={e => setRealSize(e.target.value)} 
                        placeholder="e.g. 21"
                        disabled={!!selectedObject}
                        className="w-full text-base px-3 py-2 border border-stroke-default bg-background-default rounded-lg focus:ring-2 focus:ring-brand-primary disabled:bg-background-inset disabled:text-content-subtle"
                      />
                    </div>
                  </div>
                  
                  {/* AR Measurement Option */}
                  <button 
                    onClick={() => setShowARDistanceMeasure(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors"
                  >
                    <Ruler size={16} />
                    <span>Measure distance with AR</span>
                  </button>
                </div>

                <button 
                  onClick={handlePrepareCalibration} 
                  disabled={!canSelectPoints} 
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-brand-primary text-content-on-brand rounded-xl font-bold text-lg hover:bg-brand-primary-hover disabled:bg-background-inset disabled:text-content-subtle transition-all shadow-lg disabled:shadow-none mt-4"
                >
                  <Zap className="w-5 h-5" />
                  Start Marking
                </button>
            </main>
        </div>
      </div>

      {/* --- START: SURGICAL ADDITION --- */}
      {showARDistanceMeasure && (
        <div className="fixed inset-0 z-50 bg-background-default">
          <ARMeasureView 
            onDistanceMeasured={handleARDistanceComplete}
            onCancel={handleARDistanceCancel}
          />
        </div>
      )}
      
      {showObjectSelector && (
        <ReferenceObjectSelector
          onSelectObject={handleObjectSelected}
          onCancel={() => setShowObjectSelector(false)}
        />
      )}
      {/* --- END: SURGICAL ADDITION --- */}
    </div>
    // --- END: SURGICAL REPLACEMENT ---
  );
}