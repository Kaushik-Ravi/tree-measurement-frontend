// src/components/CalibrationView.tsx
import React, { useState, useRef, useEffect } from 'react';
// --- START: SURGICAL MODIFICATION ---
import { Settings, Upload, X, Zap, RotateCcw, Ruler } from 'lucide-react';
// --- END: SURGICAL MODIFICATION ---
import { InstructionToast } from './InstructionToast';
import { ARMeasureView } from './ARMeasureView';

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
  // --- END: SURGICAL ADDITION ---
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPanelVisible) {
      setShowInstructionToast(false);
    }
  }, [isPanelVisible]);

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
    if (newPoints.length === 2) { 
        calculateAndFinish(newPoints); 
    }
  };
  
  // --- START: SURGICAL ADDITION ---
  const handleUndo = () => {
    if (points.length > 0) {
      setPoints(p => p.slice(0, -1));
      setInstruction("Previous point removed. Click to place the first point.");
      setShowInstructionToast(true);
    }
  };
  // --- END: SURGICAL ADDITION ---

  const calculateAndFinish = (finalPoints: Point[]) => {
    if (!imageDimensions || !distance || !realSize) return;
    setInstruction("Calibration complete! You can now measure trees.");
    setIsPanelVisible(true);
    const r = parseFloat(realSize); const D = parseFloat(distance);
    const w = Math.max(imageDimensions.w, imageDimensions.h);
    const n = Math.hypot(finalPoints[0].x - finalPoints[1].x, finalPoints[0].y - finalPoints[1].y);
    const D_in_cm = D * 100;
    const cameraConstant = (r * w) / (n * D_in_cm);
    console.log(`Final Calculated Camera Constant (FOV Ratio): ${cameraConstant}`);
    setTimeout(() => onCalibrationComplete(cameraConstant), 1500); // Delay to show final message
  };

  const canSelectPoints = !!(calibFile && distance && realSize);

  const handlePrepareCalibration = () => {
    if (!canSelectPoints) return;
    setInstruction("Please click the two endpoints of your known object in the image.");
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
  // --- END: SURGICAL ADDITION ---
  
  return (
    // --- START: SURGICAL REPLACEMENT ---
    <div className="h-screen w-screen bg-background-default font-inter flex flex-col md:flex-row overflow-hidden">
      <InstructionToast message={instruction} show={showInstructionToast} onClose={() => setShowInstructionToast(false)} />
        
      <div id="display-panel" className="flex-1 bg-background-inset flex items-center justify-center relative">
        {!calibFile && (
          <div className="hidden md:flex flex-col items-center text-content-subtle">
            <Settings size={64}/>
            <p className="mt-4 text-lg">Upload a photo to calibrate</p>
          </div>
        )}
        <canvas 
          ref={canvasRef} 
          onClick={canSelectPoints ? handleCanvasClick : undefined} 
          className={`max-w-full max-h-full ${canSelectPoints && points.length < 2 && !isPanelVisible ? 'cursor-crosshair' : 'cursor-default'}`} 
        />
        {points.length > 0 && !isPanelVisible && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
                <button onClick={handleUndo} className="p-3 bg-background-subtle/90 text-content-default rounded-lg shadow-lg backdrop-blur-sm border border-stroke-default hover:bg-background-inset disabled:opacity-50 transition-colors">
                    <RotateCcw size={20} />
                </button>
            </div>
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
            <main className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-content-default mb-2">1. Calibration Photo</label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-background-default border-2 border-dashed border-stroke-default rounded-lg hover:border-brand-primary hover:bg-brand-primary/10">
                    <Upload className="w-5 h-5 text-content-subtle" />
                    <span className="text-content-default font-medium">{calibFile ? 'Change Photo' : 'Choose Photo'}</span>
                  </button>
                  <p className="text-xs text-content-subtle mt-2">Tip: Use a photo of a standard A4 paper for best results.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-default mb-2">2. Distance to Object (meters)</label>
                  <input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="e.g., 1.5" className="w-full text-base px-4 py-3 border border-stroke-default bg-background-default rounded-lg focus:ring-2 focus:ring-brand-primary" />
                  
                  {/* AR Measurement Option - Prominent Button */}
                  <button 
                    onClick={() => setShowARDistanceMeasure(true)}
                    className="mt-3 w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 border-2 border-brand-primary/30 rounded-lg hover:from-brand-primary/20 hover:to-brand-secondary/20 hover:border-brand-primary/50 transition-all duration-200 group"
                    title="Measure distance using AR"
                  >
                    <Ruler className="w-5 h-5 text-brand-primary group-hover:scale-110 transition-transform" />
                    <span className="text-brand-primary font-semibold">Measure with Camera (AR)</span>
                  </button>
                  
                  <ARLinks />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-default mb-2">3. Object's Real Size (cm)</label>
                  <input type="number" value={realSize} onChange={e => setRealSize(e.target.value)} placeholder="e.g., 29.7 for A4 paper" className="w-full text-base px-4 py-3 border border-stroke-default bg-background-default rounded-lg focus:ring-2 focus:ring-brand-primary"/>
                </div>
                <button 
                  onClick={handlePrepareCalibration} 
                  disabled={!canSelectPoints} 
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary text-content-on-brand rounded-lg font-medium hover:bg-brand-primary-hover disabled:bg-background-inset disabled:text-content-subtle transition-all"
                >
                  <Zap className="w-5 h-5" />
                  Start Calibration
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
      {/* --- END: SURGICAL ADDITION --- */}
    </div>
    // --- END: SURGICAL REPLACEMENT ---
  );
}