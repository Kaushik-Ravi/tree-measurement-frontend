// src/App.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Upload, TreePine, Ruler, Zap, RotateCcw, Menu, Save, Trash2, Plus, Sparkles, MapPin, X } from 'lucide-react';
import ExifReader from 'exifreader';
import { samAutoSegment, samRefineWithPoints, manualGetDbhRectangle, manualCalculation, calculateCO2, Point, Metrics, IdentificationResponse } from './apiService';
import { CalibrationView } from './components/CalibrationView';
import { ResultsTable } from './components/ResultsTable';
import { TreeResult } from './utils/csvExporter';
import { SpeciesIdentifier } from './components/SpeciesIdentifier';
import { CO2ResultCard } from './components/CO2ResultCard';
import { AdditionalDetailsForm, AdditionalData } from './components/AdditionalDetailsForm';
import { LocationPicker } from './components/LocationPicker';

type AppStatus = 'IDLE' | 'IMAGE_UPLOADING' | 'IMAGE_LOADED' | 'AWAITING_INITIAL_CLICK' | 'PROCESSING' | 'AUTO_RESULT_SHOWN' | 'AWAITING_REFINE_POINTS' | 'MANUAL_AWAITING_BASE_CLICK' | 'MANUAL_AWAITING_HEIGHT_POINTS' | 'MANUAL_AWAITING_CANOPY_POINTS' | 'MANUAL_AWAITING_GIRTH_POINTS' | 'MANUAL_READY_TO_CALCULATE' | 'AWAITING_CALIBRATION_CHOICE' | 'CALIBRATION_AWAITING_INPUT' | 'ERROR';
type IdentificationData = Omit<IdentificationResponse, 'remainingIdentificationRequests'> | null;
type LocationData = { lat: number; lng: number } | null;

const isManualMode = (status: AppStatus) => status.startsWith('MANUAL_');
const CAMERA_FOV_RATIO_KEY = 'treeMeasurementFovRatio';
const ARLinks = () => ( <p className="text-xs text-gray-500 mt-1 pl-1">Need help measuring? Try an AR app: <a href="https://play.google.com/store/apps/details?id=com.grymala.aruler&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">Android</a>{' / '}<a href="https://apps.apple.com/us/app/ar-ruler-digital-tape-measure/id1326773975?platform=iphone" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">iOS</a></p> );

const initialAdditionalData: AdditionalData = { condition: '', ownership: '', remarks: '' };

function App() {
  const [appStatus, setAppStatus] = useState<AppStatus>('IDLE');
  const [instructionText, setInstructionText] = useState("Welcome! To begin, select a tree image to measure.");
  const [errorMessage, setErrorMessage] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  const [fovRatio, setFovRatio] = useState<number | null>(null);

  const [currentMeasurementFile, setCurrentMeasurementFile] = useState<File | null>(null);
  const [pendingTreeFile, setPendingTreeFile] = useState<File | null>(null);
  const [distance, setDistance] = useState('');
  const [focalLength, setFocalLength] = useState<number | null>(null);
  const [scaleFactor, setScaleFactor] = useState<number | null>(null);
  const [currentMetrics, setCurrentMetrics] = useState<Metrics | null>(null);
  const [currentIdentification, setCurrentIdentification] = useState<IdentificationData>(null);
  const [currentCO2, setCurrentCO2] = useState<number | null>(null);
  const [isCO2Calculating, setIsCO2Calculating] = useState(false);
  const [additionalData, setAdditionalData] = useState<AdditionalData>(initialAdditionalData);
  const [isLocationPickerActive, setIsLocationPickerActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData>(null);
  
  const [resultImageSrc, setResultImageSrc] = useState<string>('');
  const [imageDimensions, setImageDimensions] = useState<{w: number, h: number} | null>(null);
  const [refinePoints, setRefinePoints] = useState<Point[]>([]);
  const [manualPoints, setManualPoints] = useState<Record<string, Point[]>>({ height: [], canopy: [], girth: [] });
  const [transientPoint, setTransientPoint] = useState<Point | null>(null);
  const [dbhLine, setDbhLine] = useState<{x1: number, y1: number, x2: number, y2: number} | null>(null);
  const [dbhGuideRect, setDbhGuideRect] = useState<{x:number, y:number, width:number, height:number} | null>(null);

  const [allResults, setAllResults] = useState<TreeResult[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const savedRatio = localStorage.getItem(CAMERA_FOV_RATIO_KEY); if (savedRatio) { setFovRatio(parseFloat(savedRatio)); } }, []);

  useEffect(() => {
    const triggerCO2Calculation = async () => {
      if (currentMetrics && currentIdentification?.woodDensity) {
        setIsCO2Calculating(true); setCurrentCO2(null);
        try { const result = await calculateCO2(currentMetrics, currentIdentification.woodDensity.value); setCurrentCO2(result.co2_sequestered_kg); } catch (error: any) { console.error("CO2 Calculation Error:", error.message); } finally { setIsCO2Calculating(false); }
      } else { setCurrentCO2(null); }
    };
    triggerCO2Calculation();
  }, [currentMetrics, currentIdentification]);

  useEffect(() => {
    if (appStatus !== 'IMAGE_UPLOADING' || !currentMeasurementFile) return;
    const processImage = async () => {
      setInstructionText("Analyzing image metadata...");
      try {
        const tempImage = new Image();
        tempImage.src = URL.createObjectURL(currentMeasurementFile);
        tempImage.onload = async () => {
          setImageDimensions({ w: tempImage.naturalWidth, h: tempImage.naturalHeight });
          const tags = await ExifReader.load(currentMeasurementFile);
          
          const latDescription = tags.GPSLatitude?.description;
          const lngDescription = tags.GPSLongitude?.description;

          if (typeof latDescription === 'number' && typeof lngDescription === 'number') {
            setCurrentLocation({ lat: latDescription, lng: lngDescription });
          } else if (typeof latDescription === 'string' && typeof lngDescription === 'string') {
            setCurrentLocation({ lat: parseFloat(latDescription), lng: parseFloat(lngDescription) });
          }

          const focalLengthValue = tags['FocalLengthIn35mmFilm']?.value;
          setResultImageSrc(tempImage.src);
          
          if (typeof focalLengthValue === 'number') {
            setFocalLength(focalLengthValue); 
            setAppStatus('IMAGE_LOADED'); 
            setIsPanelOpen(true);
            setInstructionText("EXIF data found! Enter the distance to the tree base.");
          } else {
            setPendingTreeFile(currentMeasurementFile);
            if (fovRatio) { 
              setAppStatus('AWAITING_CALIBRATION_CHOICE'); 
              setIsPanelOpen(true);
              setInstructionText("This image lacks EXIF data. Use the saved camera calibration?"); 
            } else { 
              setAppStatus('CALIBRATION_AWAITING_INPUT'); 
            }
          }
        };
      } catch (error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); if (currentMeasurementFile) setResultImageSrc(URL.createObjectURL(currentMeasurementFile)); }
    };
    processImage();
  }, [currentMeasurementFile, appStatus, fovRatio]);

  useEffect(() => {
    if (isLocationPickerActive) return;
    const canvas = canvasRef.current; if (!canvas || !resultImageSrc) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const img = new Image(); img.src = resultImageSrc;
    img.onload = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const maxWidth = parent.clientWidth;
      const maxHeight = parent.clientHeight;
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const scaleCoords = (p: Point): Point => !imageDimensions ? p : { x: (p.x / imageDimensions.w) * canvas.width, y: (p.y / imageDimensions.h) * canvas.height };
      const drawPoint = (p: Point, color: string) => { const sp = scaleCoords(p); ctx.beginPath(); ctx.arc(sp.x, sp.y, 5, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke(); };
      if (dbhLine) { const p1 = scaleCoords({x: dbhLine.x1, y: dbhLine.y1}); const p2 = scaleCoords({x: dbhLine.x2, y: dbhLine.y2}); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 4; ctx.stroke(); }
      if (dbhGuideRect && imageDimensions) { const p = scaleCoords({x: dbhGuideRect.x, y: dbhGuideRect.y}); const rectHeight = (dbhGuideRect.height / imageDimensions.h) * canvas.height; const lineY = p.y + rectHeight / 2; ctx.beginPath(); ctx.setLineDash([10, 10]); ctx.moveTo(0, lineY); ctx.lineTo(canvas.width, lineY); ctx.strokeStyle = 'rgba(0, 116, 217, 0.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
      refinePoints.forEach(p => drawPoint(p, '#FF4136')); Object.values(manualPoints).flat().forEach(p => drawPoint(p, '#FF851B')); if (transientPoint) drawPoint(transientPoint, '#0074D9');
    };
  }, [resultImageSrc, dbhLine, dbhGuideRect, refinePoints, manualPoints, transientPoint, imageDimensions, isLocationPickerActive]);
  
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; softReset(); setCurrentMeasurementFile(file); setAppStatus('IMAGE_UPLOADING'); };
  const handleDeleteResult = (idToDelete: string) => setAllResults(results => results.filter(result => result.id !== idToDelete));
  const handleMeasurementSuccess = (metrics: Metrics) => { setCurrentMetrics(metrics); setAppStatus('AUTO_RESULT_SHOWN'); setIsPanelOpen(true); setInstructionText("Measurement complete. Review the results below."); };
  const handleCanvasClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    if (!imageDimensions || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasClickX = (event.clientX - rect.left) * scaleX;
    const canvasClickY = (event.clientY - rect.top) * scaleY;
    const imageClickX = (canvasClickX / canvas.width) * imageDimensions.w;
    const imageClickY = (canvasClickY / canvas.height) * imageDimensions.h;
    const clickPoint: Point = { x: Math.round(imageClickX), y: Math.round(imageClickY) };

    if (appStatus === 'AWAITING_INITIAL_CLICK') {
        setIsPanelOpen(true);
        setInstructionText("Running automatic segmentation...");
        setTransientPoint(clickPoint);
        try { 
          setAppStatus('PROCESSING'); 
          const response = await samAutoSegment(currentMeasurementFile!, parseFloat(distance), scaleFactor!, clickPoint); 
          if (response.status !== 'success') throw new Error(response.message); 
          setScaleFactor(response.scale_factor); 
          setDbhLine(response.dbh_line_coords); 
          setResultImageSrc(`data:image/png;base64,${response.result_image_base64}`); 
          handleMeasurementSuccess(response.metrics);
        } catch (error: any) { 
          setAppStatus('ERROR'); 
          setErrorMessage(error.message); 
        } finally { 
          setTransientPoint(null); 
        }
    } else if (appStatus === 'AWAITING_REFINE_POINTS') { setRefinePoints(prev => [...prev, clickPoint]);
    } else if (isManualMode(appStatus)) { handleManualPointCollection(clickPoint); }
  };
  const onCalibrationComplete = (newFovRatio: number) => {
    setFovRatio(newFovRatio);
    localStorage.setItem(CAMERA_FOV_RATIO_KEY, newFovRatio.toString());
    if (pendingTreeFile) {
      setCurrentMeasurementFile(pendingTreeFile);
      setPendingTreeFile(null);
      setAppStatus('IMAGE_UPLOADING'); // Re-trigger the trusted workflow
    } else {
      softReset();
    }
  };
  const handleStartMeasurement = () => {
    if (!distance || !currentMeasurementFile || !imageDimensions) return;
    let cameraConstant: number | null = null;
    if (focalLength) { cameraConstant = 36.0 / focalLength; } else if (fovRatio) { cameraConstant = fovRatio; } else { setAppStatus('ERROR'); setErrorMessage("Calibration data missing."); return; }
    const distMM = parseFloat(distance) * 1000;
    const horizontalPixels = Math.max(imageDimensions.w, imageDimensions.h);
    const finalScaleFactor = (distMM * cameraConstant) / horizontalPixels;
    setScaleFactor(finalScaleFactor); 
    setAppStatus('AWAITING_INITIAL_CLICK'); 
    setIsPanelOpen(false);
    setInstructionText("Ready. Please click once on the main trunk of the tree.");
  };
  const handleApplyRefinements = async () => { 
    if (refinePoints.length === 0) return; 
    try { setAppStatus('PROCESSING'); setIsPanelOpen(true); setInstructionText(`Re-running segmentation...`); const response = await samRefineWithPoints(currentMeasurementFile!, refinePoints, scaleFactor!); if (response.status !== 'success') throw new Error(response.message); setDbhLine(response.dbh_line_coords); setRefinePoints([]); setResultImageSrc(`data:image/png;base64,${response.result_image_base64}`); handleMeasurementSuccess(response.metrics);
    } catch(error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); }
  };
  const handleCalculateManual = async () => { 
    try { setAppStatus('PROCESSING'); setIsPanelOpen(true); setInstructionText("Calculating manual results..."); const response = await manualCalculation(manualPoints.height, manualPoints.canopy, manualPoints.girth, scaleFactor!); if (response.status !== 'success') throw new Error(response.message); setManualPoints({ height: [], canopy: [], girth: [] }); setDbhGuideRect(null); handleMeasurementSuccess(response.metrics);
    } catch(error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); } 
  };
  const handleSaveToSession = () => {
    if (!currentMeasurementFile || !currentMetrics) return;
    const newResult: TreeResult = {
      id: `${currentMeasurementFile.name}-${Date.now()}`, fileName: currentMeasurementFile.name, metrics: currentMetrics,
      species: currentIdentification?.bestMatch ?? undefined, woodDensity: currentIdentification?.woodDensity ?? undefined,
      co2_sequestered_kg: currentCO2 ?? undefined, latitude: currentLocation?.lat, longitude: currentLocation?.lng, ...additionalData
    };
    setAllResults(prev => [newResult, ...prev]);
    softReset();
  };
  const softReset = () => { 
    setAppStatus('IDLE'); setInstructionText("Select a tree image to measure."); setErrorMessage(''); setCurrentMeasurementFile(null); setDistance(''); setFocalLength(null); setScaleFactor(null); setCurrentMetrics(null); setCurrentIdentification(null); setCurrentCO2(null); setAdditionalData(initialAdditionalData); setCurrentLocation(null); setIsLocationPickerActive(false); setRefinePoints([]); setResultImageSrc(''); setDbhLine(null); setTransientPoint(null); setManualPoints({ height: [], canopy: [], girth: [] }); setDbhGuideRect(null); setPendingTreeFile(null); setImageDimensions(null); setIsPanelOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const fullReset = () => { softReset(); setAllResults([]); };
  const handleCorrectOutline = () => { setIsLocationPickerActive(false); setAppStatus('AWAITING_REFINE_POINTS'); setIsPanelOpen(false); setInstructionText("Click points to fix the tree's outline. The *first click* also sets the new height for the DBH measurement."); };
  const handleCancelRefinement = () => { setRefinePoints([]); setAppStatus('AUTO_RESULT_SHOWN'); setIsPanelOpen(true); setInstructionText("Refinement cancelled. Review the results below."); };
  const handleSwitchToManualMode = () => { if (currentMeasurementFile && scaleFactor) { setIsLocationPickerActive(false); setResultImageSrc(URL.createObjectURL(currentMeasurementFile)); setCurrentMetrics(null); setDbhLine(null); setRefinePoints([]); setAppStatus('MANUAL_AWAITING_BASE_CLICK'); setIsPanelOpen(false); setInstructionText("Manual Mode: Click the exact base of the tree trunk."); }};
  const handleCancelManualMode = () => { setAppStatus('IMAGE_LOADED'); setIsPanelOpen(true); setInstructionText("Manual mode cancelled."); setManualPoints({ height: [], canopy: [], girth: [] }); setDbhGuideRect(null); if (currentMeasurementFile) { setCurrentMetrics(null); setResultImageSrc(URL.createObjectURL(currentMeasurementFile)); }};
  const handleManualPointCollection = async (point: Point) => { 
    if (!scaleFactor || !imageDimensions) return;
    if (appStatus === 'MANUAL_AWAITING_BASE_CLICK') {
      try { const response = await manualGetDbhRectangle(point, scaleFactor, imageDimensions.w, imageDimensions.h); setDbhGuideRect(response.rectangle_coords); setAppStatus('MANUAL_AWAITING_HEIGHT_POINTS'); setInstructionText("STEP 1/3 (Height): Click highest and lowest points."); } catch (error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); }
    } else if (appStatus === 'MANUAL_AWAITING_HEIGHT_POINTS') {
      setManualPoints(p => { const h = [...p.height, point]; if (h.length === 2) { setAppStatus('MANUAL_AWAITING_CANOPY_POINTS'); setInstructionText("STEP 2/3 (Canopy): Click widest points."); } return {...p, height: h}; }); 
    } else if (appStatus === 'MANUAL_AWAITING_CANOPY_POINTS') {
      setManualPoints(p => { const c = [...p.canopy, point]; if (c.length === 2) { setAppStatus('MANUAL_AWAITING_GIRTH_POINTS'); setInstructionText("STEP 3/3 (Girth): Use guide to click trunk's width."); } return {...p, canopy: c}; }); 
    } else if (appStatus === 'MANUAL_AWAITING_GIRTH_POINTS') {
      setManualPoints(p => { const g = [...p.girth, point]; if (g.length === 2) { setAppStatus('MANUAL_READY_TO_CALCULATE'); setIsPanelOpen(true); setInstructionText("All points collected. Click 'Calculate'."); } return {...p, girth: g}; }); 
    }
  };
  const handleConfirmLocation = (location: LocationData) => { setCurrentLocation(location); setIsLocationPickerActive(false); };

  if (appStatus === 'CALIBRATION_AWAITING_INPUT') { return <CalibrationView onCalibrationComplete={onCalibrationComplete} />; }

  const hasActiveMeasurement = appStatus !== 'IDLE' && appStatus !== 'IMAGE_UPLOADING' && currentMeasurementFile;

  return (
    <div className="h-screen w-screen bg-white font-inter flex flex-col md:flex-row overflow-hidden">
        
      {/* --- Display Panel (Canvas or Map) --- */}
      <div id="display-panel" className="flex-1 bg-gray-100 flex items-center justify-center relative">
        {(!hasActiveMeasurement && !isLocationPickerActive) && <div className="hidden md:flex flex-col items-center text-gray-400"><TreePine size={64}/><p className="mt-4 text-lg">Upload an image to start measuring</p></div>}
        {(hasActiveMeasurement || isLocationPickerActive) && (
          isLocationPickerActive ? (
              <LocationPicker onConfirm={handleConfirmLocation} onCancel={() => setIsLocationPickerActive(false)} initialLocation={currentLocation} />
          ) : (
              <canvas ref={canvasRef} id="image-canvas" onClick={handleCanvasClick} className={`max-w-full max-h-full ${appStatus.includes('AWAITING') ? 'cursor-crosshair' : ''}`} />
          )
        )}
      </div>
      
      {/* --- Mobile Controls (Hamburger Button) --- */}
      {hasActiveMeasurement && !isPanelOpen && !isLocationPickerActive && (
        <button onClick={() => setIsPanelOpen(true)} className="md:hidden fixed bottom-6 right-6 z-30 p-4 bg-green-700 text-white rounded-full shadow-lg hover:bg-green-800 active:scale-95 transition-transform">
          <Menu size={24} />
        </button>
      )}

      {/* --- Control Panel (Desktop) / Summoned Panel (Mobile) --- */}
      {(!isLocationPickerActive || window.innerWidth >= 768) && (
        <div id="control-panel" 
          className={`
            bg-gray-50 border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out 
            md:static md:w-[35%] md:flex-[0.35] md:translate-y-0
            ${hasActiveMeasurement ? 'fixed z-20 inset-0' : 'w-full md:w-[35%]'}
            ${isPanelOpen || !hasActiveMeasurement ? 'translate-y-0' : 'translate-y-full'}
          `}
        >
          {hasActiveMeasurement && (
            <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 md:hidden">
              <h2 className="font-semibold text-lg text-gray-800">Controls</h2>
              <button onClick={() => setIsPanelOpen(false)} className="p-2 text-gray-500 hover:text-gray-800">
                <X size={24} />
              </button>
            </div>
          )}

          <div className="flex-grow overflow-y-auto p-4 md:p-6">
            <div className="hidden md:flex justify-between items-center mb-6">
              <div className="flex items-center gap-3"><TreePine className="w-8 h-8 text-green-700" /><h1 className="text-2xl font-semibold text-gray-900">Tree Measurement</h1></div>
            </div>
            
            <div className="p-4 rounded-lg mb-6 bg-slate-100 border border-slate-200"><h3 className="font-bold text-slate-800">Current Task</h3><div id="status-box" className="text-sm text-slate-600"><p>{instructionText}</p></div>{appStatus === 'ERROR' && <p className="text-sm text-red-600 font-medium mt-1">{errorMessage}</p>}</div>
            {(appStatus === 'PROCESSING' || isCO2Calculating) && ( <div className="mb-6"><div className="progress-bar-container"><div className="progress-bar-animated"></div></div>{ isCO2Calculating && <p className="text-xs text-center text-gray-500 animate-pulse mt-1">Calculating CO₂...</p>}</div> )}
            
            {appStatus !== 'AUTO_RESULT_SHOWN' && (
              <div className="space-y-4">
                {appStatus !== 'AWAITING_REFINE_POINTS' && !isManualMode(appStatus) && (
                  <div className="space-y-6">
                    {appStatus !== 'AWAITING_CALIBRATION_CHOICE' && (
                      <>
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">1. Select Measurement Photo</label><input ref={fileInputRef} type="file" id="image-upload" accept="image/*" onChange={handleImageUpload} className="hidden" /><button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50"><Upload className="w-5 h-5 text-gray-400" /><span className="text-gray-600">{currentMeasurementFile ? 'Change Image' : 'Choose Image File'}</span></button></div>
                      <div><label htmlFor="distance-input" className="block text-sm font-medium text-gray-700 mb-2">2. Distance to Tree Base (meters)</label><div className="relative"><Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="number" id="distance-input" placeholder="e.g., 10.5" value={distance} onChange={(e) => setDistance(e.target.value)} disabled={appStatus !== 'IMAGE_LOADED'} className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 disabled:bg-gray-200" /></div><ARLinks /></div>
                      <button id="start-auto-btn" onClick={handleStartMeasurement} disabled={appStatus !== 'IMAGE_LOADED' || !distance} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 disabled:bg-gray-300 transition-all"><Zap className="w-5 h-5" />Prepare for Measurement</button>
                      </>
                    )}
                    {appStatus === 'AWAITING_CALIBRATION_CHOICE' && (<div className="space-y-4 p-4 border-2 border-dashed border-blue-500 rounded-lg"><div className="flex items-center gap-2 text-blue-700"><Save className="w-5 h-5" /><h3 className="font-bold">Use Saved Calibration?</h3></div><button onClick={() => { setAppStatus('IMAGE_LOADED'); setIsPanelOpen(true); }} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Yes, Use Saved</button><button onClick={() => setAppStatus('CALIBRATION_AWAITING_INPUT')} className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700">No, Calibrate New</button></div>)}
                  </div>
                )}
                {appStatus === 'AWAITING_REFINE_POINTS' && ( <div className="grid grid-cols-2 gap-3 pt-4 border-t"><button onClick={handleApplyRefinements} disabled={refinePoints.length === 0} className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:bg-gray-300 text-sm">Apply Correction</button><button onClick={handleCancelRefinement} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">Cancel</button></div> )}
                {isManualMode(appStatus) && (
                  <div className="pt-4 border-t">
                      {appStatus === 'MANUAL_READY_TO_CALCULATE' && <button onClick={handleCalculateManual} className="w-full mb-3 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 text-sm">Calculate Manual Results</button>}
                      <button onClick={handleCancelManualMode} className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">Cancel Manual Mode</button>
                  </div>
                )}
              </div>
            )}

            {appStatus === 'AUTO_RESULT_SHOWN' && (
              <div className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Current Measurements</h2>
                    <div className="space-y-2 mt-2">
                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border"><label className="font-medium text-gray-700">Height:</label><span className="font-mono text-lg text-gray-800">{currentMetrics?.height_m?.toFixed(2) ?? '--'} m</span></div>
                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border"><label className="font-medium text-gray-700">Canopy:</label><span className="font-mono text-lg text-gray-800">{currentMetrics?.canopy_m?.toFixed(2) ?? '--'} m</span></div>
                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border"><label className="font-medium text-gray-700">DBH:</label><span className="font-mono text-lg text-gray-800">{currentMetrics?.dbh_cm?.toFixed(2) ?? '--'} cm</span></div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                    <button onClick={handleCorrectOutline} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Correct Outline</button>
                    <button onClick={handleSwitchToManualMode} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm">Manual Mode</button>
                </div>
                <div className="space-y-4 border-t pt-4">
                  <button onClick={() => setIsLocationPickerActive(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100">
                      <MapPin className="w-5 h-5 text-blue-600" /> {currentLocation ? `Location Set: ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'Add Location'}
                  </button>
                  <SpeciesIdentifier onIdentificationComplete={setCurrentIdentification} onClear={() => setCurrentIdentification(null)} existingResult={currentIdentification} />
                  <CO2ResultCard co2Value={currentCO2} isLoading={isCO2Calculating} />
                  <AdditionalDetailsForm data={additionalData} onUpdate={(field, value) => setAdditionalData(prev => ({ ...prev, [field]: value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                  <button onClick={softReset} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"><RotateCcw className="w-4 h-4" />Measure Another</button>
                  <button onClick={handleSaveToSession} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"><Plus className="w-5 h-5" />Save to Session</button>
                </div>
              </div>
            )}
            
            <div className="border-t border-gray-200 mt-6 pt-6">
              <ResultsTable results={allResults} onDeleteResult={handleDeleteResult} />
              {allResults.length > 0 && (<div className="mt-4"><button onClick={fullReset} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-700 bg-red-100 rounded-lg hover:bg-red-200"><Trash2 className="w-4 h-4" /> Clear Session</button></div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;