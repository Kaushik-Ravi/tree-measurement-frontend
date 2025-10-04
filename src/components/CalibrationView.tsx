// src/components/CalibrationView.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Settings, Upload } from 'lucide-react';

interface Point { x: number; y: number; }

interface CalibrationViewProps {
  onCalibrationComplete: (fovRatio: number) => void;
}

const ARLinks = () => (
  <p className="text-xs text-neutral-500 mt-2">
    Need help measuring? Try an AR app: {' '}
    <a href="https://play.google.com/store/apps/details?id=com.grymala.aruler&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
      Android
    </a>
    {' / '}
    <a href="https://apps.apple.com/us/app/ar-ruler-digital-tape-measure/id1326773975?platform=iphone" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
      iOS
    </a>
  </p>
);

export function CalibrationView({ onCalibrationComplete }: CalibrationViewProps) {
  const [calibFile, setCalibFile] = useState<File | null>(null);
  const [calibImageSrc, setCalibImageSrc] = useState<string>('');
  const [imageDimensions, setImageDimensions] = useState<{w: number, h: number} | null>(null);
  const [distance, setDistance] = useState('');
  const [realSize, setRealSize] = useState('');
  const [points, setPoints] = useState<Point[]>([]);
  const [instruction, setInstruction] = useState("A one-time camera calibration is needed.");
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!calibFile) return;
    const tempImage = new Image();
    tempImage.src = URL.createObjectURL(calibFile);
    tempImage.onload = () => {
        setImageDimensions({ w: tempImage.naturalWidth, h: tempImage.naturalHeight });
        setCalibImageSrc(tempImage.src);
        setInstruction("Image loaded. Enter distance and size details.");
    }
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
            ctx.beginPath(); ctx.arc(sp.x, sp.y, 6, 0, 2 * Math.PI); ctx.fillStyle = '#FF3B30'; ctx.fill(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 2; ctx.stroke();
        });
    }
  }, [calibImageSrc, points, imageDimensions]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) { setCalibFile(file); setPoints([]); }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (points.length >= 2 || !imageDimensions || !canvasRef.current) return;
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const clickPoint: Point = { x: Math.round((event.clientX - rect.left) / canvas.width * imageDimensions.w), y: Math.round((event.clientY - rect.top) / canvas.height * imageDimensions.h) };
    const newPoints = [...points, clickPoint];
    setPoints(newPoints);
    if (newPoints.length === 1) { setInstruction("First point selected. Click the second endpoint."); }
    if (newPoints.length === 2) { calculateAndFinish(newPoints); }
  };

  const calculateAndFinish = (finalPoints: Point[]) => {
    if (!imageDimensions || !distance || !realSize) return;
    setInstruction("Calibration complete! You can now measure trees.");
    const r = parseFloat(realSize); const D = parseFloat(distance);
    const w = Math.max(imageDimensions.w, imageDimensions.h);
    const n = Math.hypot(finalPoints[0].x - finalPoints[1].x, finalPoints[0].y - finalPoints[1].y);
    const D_in_cm = D * 100;
    const cameraConstant = (r * w) / (n * D_in_cm);
    console.log(`Final Calculated Camera Constant (FOV Ratio): ${cameraConstant}`);
    onCalibrationComplete(cameraConstant);
  };

  const canSelectPoints = !!(calibFile && distance && realSize);
  useEffect(() => { if (canSelectPoints && points.length < 2) { setInstruction("Please click the two endpoints of your known object in the image."); } }, [canSelectPoints, points]);

  return (
    <div className="min-h-screen w-screen bg-gray-100 font-inter text-gray-800">
        <div className="flex flex-col md:flex-row h-screen">
            <div id="calibration-control-panel" className="w-full md:w-[28rem] bg-white md:bg-gray-50 border-r border-gray-200 p-4 md:p-8 flex flex-col">
                <header className="flex-shrink-0">
                    <div className="flex items-center gap-3 mb-6"><Settings className="w-8 h-8 text-green-700" /><h1 className="text-2xl font-semibold text-gray-900">Camera Calibration</h1></div>
                    <div className="p-4 rounded-lg mb-6 bg-blue-50 border border-blue-200 text-blue-800">
                        <p className="font-bold">Instructions</p>
                        <p className="text-sm">{instruction}</p>
                    </div>
                </header>
                <main className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">1. Calibration Photo</label>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50">
                        <Upload className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-600 font-medium">{calibFile ? 'Change Photo' : 'Choose Photo'}</span>
                      </button>
                      <p className="text-xs text-gray-500 mt-2">Tip: Use a photo of a standard A4 paper for best results.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">2. Distance to Object (meters)</label>
                      <input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="e.g., 1.5" className="w-full text-base px-4 py-3 border border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-green-500" />
                      <ARLinks />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">3. Object's Real Size (cm)</label>
                      <input type="number" value={realSize} onChange={e => setRealSize(e.target.value)} placeholder="e.g., 29.7 for A4 paper" className="w-full text-base px-4 py-3 border border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-green-500"/>
                    </div>
                </main>
            </div>
            <div id="calibration-display-panel" className="flex-1 p-4 bg-gray-200 flex items-center justify-center h-64 md:h-auto">
              <canvas 
                ref={canvasRef} 
                onClick={canSelectPoints ? handleCanvasClick : undefined} 
                className={`bg-white rounded-lg shadow-md max-w-full max-h-full ${canSelectPoints && points.length < 2 ? 'cursor-crosshair' : 'cursor-not-allowed'}`} 
              />
            </div>
        </div>
    </div>
  );
}