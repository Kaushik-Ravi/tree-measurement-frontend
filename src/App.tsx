// src/App.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Upload, TreePine, Ruler, Zap, RotateCcw, Menu, Save, Trash2, Plus, Sparkles, MapPin, X, LogIn, LogOut, Loader2, Edit, Navigation, ShieldCheck, AlertTriangle, ImageIcon } from 'lucide-react';
import ExifReader from 'exifreader';
import { 
  samAutoSegment, samRefineWithPoints, manualGetDbhRectangle, manualCalculation, calculateCO2, 
  Point, Metrics, IdentificationResponse, TreeResult, UpdateTreeResultPayload,
  getResults, saveResult, deleteResult, updateResult, uploadImage, quickCapture
} from './apiService';
import { CalibrationView } from './components/CalibrationView';
import { ResultsTable } from './components/ResultsTable';
import { SpeciesIdentifier } from './components/SpeciesIdentifier';
import { CO2ResultCard } from './components/CO2ResultCard';
import { AdditionalDetailsForm, AdditionalData } from './components/AdditionalDetailsForm';
import { LocationPicker } from './components/LocationPicker';
import { InstructionToast } from './components/InstructionToast';
import { useAuth } from './contexts/AuthContext';
import { EditResultModal } from './components/EditResultModal'; 

type AppMode = 'SELECT_MODE' | 'QUICK_CAPTURE' | 'FULL_ANALYSIS';
type AppStatus = 'IDLE' | 'IMAGE_UPLOADING' | 'IMAGE_LOADED' | 'AWAITING_INITIAL_CLICK' | 'PROCESSING' | 'SAVING' | 'AUTO_RESULT_SHOWN' | 'AWAITING_REFINE_POINTS' | 'MANUAL_AWAITING_BASE_CLICK' | 'MANUAL_AWAITING_HEIGHT_POINTS' | 'MANUAL_AWAITING_CANOPY_POINTS' | 'MANUAL_AWAITING_GIRTH_POINTS' | 'MANUAL_READY_TO_CALCULATE' | 'AWAITING_CALIBRATION_CHOICE' | 'CALIBRATION_AWAITING_INPUT' | 'ERROR';
type IdentificationData = Omit<IdentificationResponse, 'remainingIdentificationRequests'> | null;
type LocationData = { lat: number; lng: number } | null;

const isManualMode = (status: AppStatus) => status.startsWith('MANUAL_');
const CAMERA_FOV_RATIO_KEY = 'treeMeasurementFovRatio';
const ARLinks = () => ( <p className="text-xs text-gray-500 mt-1 pl-1">Need help measuring? Try an AR app: <a href="https://play.google.com/store/apps/details?id=com.grymala.aruler&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">Android</a>{' / '}<a href="https://apps.apple.com/us/app/ar-ruler-digital-tape-measure/id1326773975?platform=iphone" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">iOS</a></p> );

const initialAdditionalData: AdditionalData = { condition: '', ownership: '', remarks: '' };

const AuthComponent = () => {
  const { user, signInWithGoogle, signOut } = useAuth();

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <img src={user.user_metadata.avatar_url} alt="User avatar" className="w-8 h-8 rounded-full border-2 border-green-200" />
        <span className="text-sm font-medium text-gray-700 hidden lg:inline">{user.user_metadata.full_name}</span>
        <button onClick={signOut} className="p-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 flex items-center gap-2" title="Sign Out">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button onClick={signInWithGoogle} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
      <LogIn className="w-4 h-4" />
      Sign In
    </button>
  );
};

const LoginPrompt = () => {
    const { signInWithGoogle } = useAuth();
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center bg-gray-50 p-6">
        <TreePine className="w-16 h-16 text-green-600 mb-4" />
        <h1 className="text-3xl font-bold text-gray-800">Welcome to the Tree Measurement Tool</h1>
        <p className="mt-2 max-w-md text-gray-600">
          Sign in to begin measuring trees, identifying species, and tracking your results in a persistent measurement history.
        </p>
        <button 
          onClick={signInWithGoogle}
          className="mt-8 flex items-center gap-3 px-6 py-3 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 transition-transform active:scale-95 shadow-lg"
        >
          <svg className="w-5 h-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.3 512 0 398.8 0 256S110.3 0 244 0c69.8 0 130.8 28.5 173.4 74.5l-68.2 66.3C314.5 112.5 282.2 96 244 96c-83.2 0-151.2 67.2-151.2 150.2s68 150.2 151.2 150.2c97.7 0 128.8-72.2 132.3-108.9H244v-85.3h238.9c2.3 12.7 3.6 26.4 3.6 40.5z"></path></svg>
          Sign In with Google
        </button>
      </div>
    );
};

function App() {
  const { user, session, isLoading: isAuthLoading } = useAuth();

  const [appMode, setAppMode] = useState<AppMode>('SELECT_MODE');
  const [appStatus, setAppStatus] = useState<AppStatus>('IDLE');
  const [instructionText, setInstructionText] = useState("Welcome! Please select a measurement mode to begin.");
  const [errorMessage, setErrorMessage] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showInstructionToast, setShowInstructionToast] = useState(false);
  
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
  
  const [originalImageSrc, setOriginalImageSrc] = useState<string>('');
  const [resultImageSrc, setResultImageSrc] = useState<string>('');
  const [imageDimensions, setImageDimensions] = useState<{w: number, h: number} | null>(null);
  const [refinePoints, setRefinePoints] = useState<Point[]>([]);
  const [manualPoints, setManualPoints] = useState<Record<string, Point[]>>({ height: [], canopy: [], girth: [] });
  const [transientPoint, setTransientPoint] = useState<Point | null>(null);
  const [dbhLine, setDbhLine] = useState<{x1: number, y1: number, x2: number, y2: number} | null>(null);
  const [dbhGuideRect, setDbhGuideRect] = useState<{x:number, y:number, width:number, height:number} | null>(null);

  const [allResults, setAllResults] = useState<TreeResult[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  
  const [editingResult, setEditingResult] = useState<TreeResult | null>(null);

  const [geoPermissionStatus, setGeoPermissionStatus] = useState<'IDLE' | 'PENDING' | 'GRANTED' | 'DENIED'>('IDLE');
  const [userGeoLocation, setUserGeoLocation] = useState<LocationData>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const savedRatio = localStorage.getItem(CAMERA_FOV_RATIO_KEY); if (savedRatio) { setFovRatio(parseFloat(savedRatio)); } }, []);
  
  useEffect(() => { if (isPanelOpen) setShowInstructionToast(false) }, [isPanelOpen]);
  
  useEffect(() => {
    if (appMode !== 'QUICK_CAPTURE') return;
  
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) { setDeviceHeading(event.alpha); }
    };
  
    // @ts-ignore
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // @ts-ignore
      DeviceOrientationEvent.requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          } else {
            setErrorMessage("Compass access is required for Quick Capture. Please enable it in your device settings.");
          }
        })
        .catch(console.error);
    } else {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
  
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [appMode]);

  useEffect(() => {
    const fetchUserResults = async () => {
      if (session?.access_token) {
        setIsHistoryLoading(true);
        try {
          const results = await getResults(session.access_token);
          setAllResults(results);
        } catch (error: any) {
          setErrorMessage(`Could not fetch history: ${error.message}`);
        } finally {
          setIsHistoryLoading(false);
        }
      }
    };
    fetchUserResults();
  }, [session]);

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
        const objectURL = URL.createObjectURL(currentMeasurementFile);
        tempImage.src = objectURL;

        tempImage.onload = async () => {
          setImageDimensions({ w: tempImage.naturalWidth, h: tempImage.naturalHeight });
          const tags = await ExifReader.load(currentMeasurementFile);
          
          let focalLengthValue: number | null = null;
          const focalLengthIn35mm = tags['FocalLengthIn35mmFilm']?.value;
          const rawFocalLength = tags['FocalLength']?.value;
          const scaleFactor35 = tags['ScaleFactor35efl']?.value;
          
          if (typeof focalLengthIn35mm === 'number') {
            focalLengthValue = focalLengthIn35mm;
          } else if (typeof rawFocalLength === 'number' && typeof scaleFactor35 === 'number') {
            focalLengthValue = rawFocalLength * scaleFactor35;
          }

          setOriginalImageSrc(objectURL);
          setResultImageSrc(objectURL);
          
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
      } catch (error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); if (currentMeasurementFile) { const objURL = URL.createObjectURL(currentMeasurementFile); setOriginalImageSrc(objURL); setResultImageSrc(objURL); } }
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
  
  const handleModeSelect = (mode: AppMode) => {
    setInstructionText("Waiting for location permission...");
    setGeoPermissionStatus('PENDING');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserGeoLocation(userLoc);
        setCurrentLocation(userLoc); 
        setGeoPermissionStatus('GRANTED');
        setAppMode(mode);
        setAppStatus('IDLE');
        setIsPanelOpen(true);
        setInstructionText(mode === 'QUICK_CAPTURE' ? 'Ready for Quick Capture. Upload an image and enter the distance.' : 'Ready for Full Analysis. Upload an image to start.');
      },
      (error) => {
        console.error("Geolocation error:", error);
        setGeoPermissionStatus('DENIED');
        setErrorMessage("Location access is required to use this application. Please enable it in your browser settings.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => { 
    const file = event.target.files?.[0]; 
    if (!file) return;
    setAppStatus('IMAGE_UPLOADING');
    setErrorMessage('');
    setCurrentMeasurementFile(file);
    setDistance('');
    setFocalLength(null);
    setScaleFactor(null);
    setCurrentMetrics(null);
    setRefinePoints([]);
    setDbhLine(null);
    setTransientPoint(null);
    setManualPoints({ height: [], canopy: [], girth: [] });
    setDbhGuideRect(null);
    setPendingTreeFile(null);
    setImageDimensions(null);
  };
  
  const handleDeleteResult = async (idToDelete: string) => {
    if (!session?.access_token) { setErrorMessage("You must be logged in to delete results."); return; }
    if (window.confirm("Are you sure you want to permanently delete this measurement?")) {
      try { await deleteResult(idToDelete, session.access_token); setAllResults(results => results.filter(result => result.id !== idToDelete)); } catch (error: any) { setErrorMessage(`Failed to delete: ${error.message}`); }
    }
  };

  const handleOpenEditModal = (resultToEdit: TreeResult) => {
    setEditingResult(resultToEdit);
  };
  
  const handleUpdateResult = async (updatedData: AdditionalData, updatedLocation: LocationData) => {
    if (!editingResult || !session?.access_token) {
      setErrorMessage("Cannot update: missing data or not logged in.");
      return;
    }
    
    const payload: UpdateTreeResultPayload = {
      ...updatedData,
      latitude: updatedLocation?.lat,
      longitude: updatedLocation?.lng,
    };

    try {
      const updatedResult = await updateResult(editingResult.id, payload, session.access_token);
      setAllResults(prev => prev.map(r => (r.id === updatedResult.id ? updatedResult : r)));
      setEditingResult(null);
    } catch (error: any) {
      setErrorMessage(`Failed to update result: ${error.message}`);
    }
  };

  const handleMeasurementSuccess = (metrics: Metrics) => { setCurrentMetrics(metrics); setAppStatus('AUTO_RESULT_SHOWN'); setIsPanelOpen(true); setInstructionText("Measurement complete. Review the results below."); };
  
  const handleCanvasClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    setShowInstructionToast(false);
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
        setIsPanelOpen(true); setInstructionText("Running automatic segmentation..."); setTransientPoint(clickPoint);
        try { 
          setAppStatus('PROCESSING'); 
          const response = await samAutoSegment(currentMeasurementFile!, parseFloat(distance), scaleFactor!, clickPoint); 
          if (response.status !== 'success') throw new Error(response.message); 
          setScaleFactor(response.scale_factor); setDbhLine(response.dbh_line_coords); setResultImageSrc(`data:image/png;base64,${response.result_image_base64}`); 
          handleMeasurementSuccess(response.metrics);
        } catch (error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); } finally { setTransientPoint(null); }
    } else if (appStatus === 'AWAITING_REFINE_POINTS') { setRefinePoints(prev => [...prev, clickPoint]);
    } else if (isManualMode(appStatus)) { handleManualPointCollection(clickPoint); }
  };
  
  const onCalibrationComplete = (newFovRatio: number) => {
    setFovRatio(newFovRatio); localStorage.setItem(CAMERA_FOV_RATIO_KEY, newFovRatio.toString());
    if (pendingTreeFile) { setCurrentMeasurementFile(pendingTreeFile); setPendingTreeFile(null); setAppStatus('IMAGE_UPLOADING');
    } else { softReset(appMode); }
  };

  const prepareMeasurementSession = (): number | null => {
    if (!distance || !currentMeasurementFile || !imageDimensions) return null;
    let cameraConstant: number | null = null;
    if (focalLength) { cameraConstant = 36.0 / focalLength; } else if (fovRatio) { cameraConstant = fovRatio;
    } else { setAppStatus('ERROR'); setErrorMessage("Calibration data missing. Please calibrate your camera first."); return null; }
    const distMM = parseFloat(distance) * 1000;
    const horizontalPixels = Math.max(imageDimensions.w, imageDimensions.h);
    const finalScaleFactor = (distMM * cameraConstant) / horizontalPixels;
    setScaleFactor(finalScaleFactor);
    return finalScaleFactor;
  };
  
  const handleStartAutoMeasurement = () => { if (prepareMeasurementSession()) { setAppStatus('AWAITING_INITIAL_CLICK'); setIsPanelOpen(false); setInstructionText("Ready. Please click once on the main trunk of the tree."); setShowInstructionToast(true); } };
  const handleStartManualMeasurement = () => { if (prepareMeasurementSession()) { setResultImageSrc(URL.createObjectURL(currentMeasurementFile!)); setCurrentMetrics(null); setDbhLine(null); setRefinePoints([]); setAppStatus('MANUAL_AWAITING_BASE_CLICK'); setIsPanelOpen(false); setInstructionText("Manual Mode: Click the exact base of the tree trunk."); setShowInstructionToast(true); } };
  const handleApplyRefinements = async () => { if (refinePoints.length === 0) return; try { setAppStatus('PROCESSING'); setIsPanelOpen(true); setInstructionText(`Re-running segmentation...`); const response = await samRefineWithPoints(currentMeasurementFile!, refinePoints, scaleFactor!); if (response.status !== 'success') throw new Error(response.message); setDbhLine(response.dbh_line_coords); setRefinePoints([]); setResultImageSrc(`data:image/png;base64,${response.result_image_base64}`); handleMeasurementSuccess(response.metrics); } catch(error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); } };
  const handleCalculateManual = async () => { try { setAppStatus('PROCESSING'); setIsPanelOpen(true); setInstructionText("Calculating manual results..."); const response = await manualCalculation(manualPoints.height, manualPoints.canopy, manualPoints.girth, scaleFactor!); if (response.status !== 'success') throw new Error(response.message); setManualPoints({ height: [], canopy: [], girth: [] }); setDbhGuideRect(null); handleMeasurementSuccess(response.metrics); } catch(error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); } };
  
  const handleSaveResult = async () => {
    if (!currentMeasurementFile || !currentMetrics || !session?.access_token || !scaleFactor) {
      setErrorMessage("Cannot save: missing data or not logged in.");
      return;
    }

    setAppStatus('SAVING');
    setInstructionText("Uploading image and saving results...");
    setIsPanelOpen(true);

    try {
      const uploadResponse = await uploadImage(currentMeasurementFile, session.access_token);
      const imageUrl = uploadResponse.image_url;

      const newResultPayload = {
        fileName: currentMeasurementFile.name,
        metrics: currentMetrics,
        species: currentIdentification?.bestMatch ?? undefined,
        woodDensity: currentIdentification?.woodDensity ?? undefined,
        co2_sequestered_kg: currentCO2 ?? undefined,
        latitude: currentLocation?.lat,
        longitude: currentLocation?.lng,
        image_url: imageUrl,
        distance_m: parseFloat(distance),
        scale_factor: scaleFactor,
        ...additionalData,
      };

      await saveResult(newResultPayload, session.access_token);
      
      const updatedResults = await getResults(session.access_token);
      setAllResults(updatedResults);
      softReset('FULL_ANALYSIS');

    } catch (error: any) {
      setErrorMessage(`Failed to save result: ${error.message}`);
      setAppStatus('AUTO_RESULT_SHOWN');
      setInstructionText("An error occurred. Please try saving again.");
    }
  };

  const handleQuickCaptureSubmit = async () => {
    if (!currentMeasurementFile || !distance || !userGeoLocation || !session?.access_token) {
      setErrorMessage("Missing required data: image, distance, or location.");
      return;
    }
    setAppStatus('SAVING');
    setInstructionText("Calculating and submitting data for analysis...");

    const calculatedScaleFactor = prepareMeasurementSession();
    if (!calculatedScaleFactor) {
      setAppStatus('ERROR');
      return;
    }
    
    try {
      await quickCapture(
        currentMeasurementFile,
        parseFloat(distance),
        calculatedScaleFactor,
        deviceHeading,
        userGeoLocation.lat,
        userGeoLocation.lng,
        session.access_token
      );
      
      const updatedResults = await getResults(session.access_token);
      setAllResults(updatedResults);
      softReset('QUICK_CAPTURE');

    } catch (error: any) {
      setErrorMessage(`Submission failed: ${error.message}`);
      setAppStatus('ERROR');
    }
  };

  const softReset = (currentMode: AppMode) => {
    setAppMode(currentMode);
    setAppStatus('IDLE');
    setInstructionText(currentMode === 'QUICK_CAPTURE' ? 'Ready for next Quick Capture. Upload an image.' : 'Ready for next Full Analysis. Upload an image.');
    setErrorMessage('');
    setCurrentMeasurementFile(null);
    setDistance('');
    setFocalLength(null);
    setScaleFactor(null);
    setCurrentMetrics(null);
    setCurrentIdentification(null);
    setCurrentCO2(null);
    setAdditionalData(initialAdditionalData);
    setCurrentLocation(userGeoLocation); 
    setIsLocationPickerActive(false);
    setRefinePoints([]);
    setOriginalImageSrc('');
    setResultImageSrc('');
    setDbhLine(null);
    setTransientPoint(null);
    setManualPoints({ height: [], canopy: [], girth: [] });
    setDbhGuideRect(null);
    setPendingTreeFile(null);
    setImageDimensions(null);
    setDeviceHeading(null);
    setIsPanelOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleReturnToModeSelect = () => {
    softReset('SELECT_MODE');
    setGeoPermissionStatus('IDLE');
    setUserGeoLocation(null);
    setCurrentLocation(null);
    setInstructionText("Welcome! Please select a measurement mode to begin.");
  };

  const handleManualPointCollection = async (point: Point) => { 
    if (!scaleFactor || !imageDimensions) return;
    const showNextInstruction = (text: string) => { setInstructionText(text); setShowInstructionToast(true); };
    if (appStatus === 'MANUAL_AWAITING_BASE_CLICK') {
      try { const response = await manualGetDbhRectangle(point, scaleFactor, imageDimensions.w, imageDimensions.h); setDbhGuideRect(response.rectangle_coords); setAppStatus('MANUAL_AWAITING_HEIGHT_POINTS'); showNextInstruction("STEP 1/3 (Height): Click highest and lowest points."); } catch (error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); }
    } else if (appStatus === 'MANUAL_AWAITING_HEIGHT_POINTS') {
      setManualPoints(p => { const h = [...p.height, point]; if (h.length === 2) { setAppStatus('MANUAL_AWAITING_CANOPY_POINTS'); showNextInstruction("STEP 2/3 (Canopy): Click widest points."); } return {...p, height: h}; }); 
    } else if (appStatus === 'MANUAL_AWAITING_CANOPY_POINTS') {
      setManualPoints(p => { const c = [...p.canopy, point]; if (c.length === 2) { setAppStatus('MANUAL_AWAITING_GIRTH_POINTS'); showNextInstruction("STEP 3/3 (Girth): Use guide to click trunk's width."); } return {...p, canopy: c}; }); 
    } else if (appStatus === 'MANUAL_AWAITING_GIRTH_POINTS') {
      setManualPoints(p => { const g = [...p.girth, point]; if (g.length === 2) { setAppStatus('MANUAL_READY_TO_CALCULATE'); setIsPanelOpen(true); setInstructionText("All points collected. Click 'Calculate'."); } return {...p, girth: g}; }); 
    }
  };

  const handleConfirmLocation = (location: LocationData) => { setCurrentLocation(location); setIsLocationPickerActive(false); };
  
  if (isAuthLoading) { return ( <div className="h-screen w-screen flex items-center justify-center bg-white"> <Loader2 className="w-8 h-8 text-gray-400 animate-spin" /> </div> ); }
  if (appStatus === 'CALIBRATION_AWAITING_INPUT') { return <CalibrationView onCalibrationComplete={onCalibrationComplete} />; }
  if (!user) { return <LoginPrompt />; }

  const hasActiveMeasurement = (appMode === 'FULL_ANALYSIS' || appMode === 'QUICK_CAPTURE') && appStatus !== 'IDLE' && currentMeasurementFile;
  const isBusy = appStatus === 'PROCESSING' || appStatus === 'SAVING' || isCO2Calculating || isHistoryLoading;

  const ModeSelectionScreen = () => (
    <div className="w-full h-full flex flex-col justify-center items-center p-4 md:p-8">
      <div className="text-center max-w-2xl">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Choose Your Workflow</h2>
        <p className="mt-2 text-gray-600">Select the best method for your needs.</p>
      </div>
      
      {geoPermissionStatus === 'PENDING' && ( <div className="mt-8 flex items-center gap-3 text-gray-500"> <Loader2 className="animate-spin w-5 h-5" /> <span>Accessing your location...</span> </div> )}
      {geoPermissionStatus === 'DENIED' && ( <div className="mt-8 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg max-w-md text-center"> <div className="flex items-center justify-center gap-2 font-bold"><AlertTriangle size={20}/>Location Access Denied</div> <p className="text-sm mt-1">{errorMessage}</p> </div> )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        <button onClick={() => handleModeSelect('QUICK_CAPTURE')} disabled={geoPermissionStatus === 'PENDING' || geoPermissionStatus === 'DENIED'} className="group text-left p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full group-hover:bg-blue-500 transition-colors"> <Navigation className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" /> </div>
            <div> <h3 className="text-lg font-bold text-gray-900">Quick Capture</h3> <p className="text-sm text-gray-500">Fastest way to log a tree. Requires a photo, distance, and GPS.</p> </div>
          </div>
        </button>
        <button onClick={() => handleModeSelect('FULL_ANALYSIS')} disabled={geoPermissionStatus === 'PENDING' || geoPermissionStatus === 'DENIED'} className="group text-left p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-green-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
           <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full group-hover:bg-green-500 transition-colors"> <ShieldCheck className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" /> </div>
            <div> <h3 className="text-lg font-bold text-gray-900">Full Analysis</h3> <p className="text-sm text-gray-500">The complete in-field tool for the most accurate results.</p> </div>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-white font-inter flex flex-col md:flex-row overflow-hidden">
      {editingResult && ( <EditResultModal result={editingResult} onClose={() => setEditingResult(null)} onSave={handleUpdateResult} /> )}
      <InstructionToast message={instructionText} show={showInstructionToast} onClose={() => setShowInstructionToast(false)} />
      
      {appMode === 'SELECT_MODE' && <ModeSelectionScreen />}

      {(appMode === 'QUICK_CAPTURE' || appMode === 'FULL_ANALYSIS') && (
          <>
            <div id="display-panel" className="flex-1 bg-gray-100 flex items-center justify-center relative">
                {(!currentMeasurementFile && !isLocationPickerActive) && <div className="hidden md:flex flex-col items-center text-gray-400"><TreePine size={64}/><p className="mt-4 text-lg">Upload an image to start</p></div>}
                {isLocationPickerActive ? ( <LocationPicker onConfirm={handleConfirmLocation} onCancel={() => setIsLocationPickerActive(false)} initialLocation={currentLocation} /> ) : (
                  currentMeasurementFile && <canvas ref={canvasRef} id="image-canvas" onClick={handleCanvasClick} className={`max-w-full max-h-full ${appStatus.includes('AWAITING') ? 'cursor-crosshair' : ''}`} />
                )}
            </div>
              
            {currentMeasurementFile && !isPanelOpen && !isLocationPickerActive && ( <button onClick={() => setIsPanelOpen(true)} className="md:hidden fixed bottom-6 right-6 z-30 p-4 bg-green-700 text-white rounded-full shadow-lg hover:bg-green-800 active:scale-95 transition-transform"> <Menu size={24} /> </button> )}

            {(!isLocationPickerActive || window.innerWidth >= 768) && (
              <div id="control-panel" className={` bg-gray-50 border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out md:static md:w-[35%] md:max-w-xl md:flex-shrink-0 md:translate-y-0 ${currentMeasurementFile ? 'fixed z-20 inset-0' : 'w-full overflow-y-auto'} ${isPanelOpen || !currentMeasurementFile ? 'translate-y-0' : 'translate-y-full'} `} >
                <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 md:hidden">
                    {currentMeasurementFile ? ( <> <AuthComponent /> <button onClick={() => setIsPanelOpen(false)} className="p-2 text-gray-500 hover:text-gray-800"><X size={24} /></button> </> ) : ( <div className="w-full flex justify-between items-center"> <div className="flex items-center gap-3"><TreePine className="w-7 h-7 text-green-700" /><h1 className="text-xl font-semibold text-gray-900">Tree Measurement</h1></div> <AuthComponent /> </div> )}
                </div>

                <div className="flex-grow overflow-y-auto p-4 md:p-6">
                  <div className="hidden md:flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      {appMode === 'QUICK_CAPTURE' ? <Navigation className="w-8 h-8 text-blue-700" /> : <TreePine className="w-8 h-8 text-green-700" />}
                      <h1 className="text-2xl font-semibold text-gray-900">{appMode === 'QUICK_CAPTURE' ? 'Quick Capture' : 'Full Analysis'}</h1>
                    </div>
                    <AuthComponent />
                  </div>

                  <button onClick={handleReturnToModeSelect} className="text-sm text-blue-600 hover:underline mb-4">{'<'} Back to Mode Selection</button>
                  
                  <div className="p-4 rounded-lg mb-6 bg-slate-100 border border-slate-200"><h3 className="font-bold text-slate-800">Current Task</h3><div id="status-box" className="text-sm text-slate-600"><p>{instructionText}</p></div>{errorMessage && <p className="text-sm text-red-600 font-medium mt-1">{errorMessage}</p>}</div>
                  {isBusy && ( <div className="mb-6"><div className="progress-bar-container"><div className="progress-bar-animated"></div></div>{ <p className="text-xs text-center text-gray-500 animate-pulse mt-1">{isHistoryLoading ? 'Loading history...' : appStatus === 'SAVING' ? 'Saving...' : isCO2Calculating ? 'Calculating CO₂...' : 'Processing...'}</p>}</div> )}
                  
                  {/* --- All Input Controls --- */}
                  <div className="space-y-6">
                    <div> <label className="block text-sm font-medium text-gray-700 mb-2">1. Select Photo</label> <input ref={fileInputRef} type="file" id="image-upload" accept="image/*" onChange={handleImageUpload} className="hidden" /> <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50"> <Upload className="w-5 h-5 text-gray-400" /> <span className="text-gray-600">{currentMeasurementFile ? 'Change Image' : 'Choose Image File'}</span> </button> </div>
                    <div> <label htmlFor="distance-input" className="block text-sm font-medium text-gray-700 mb-2">2. Distance to Tree Base (meters)</label> <div className="relative"> <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /> <input type="number" id="distance-input" placeholder="e.g., 10.5" value={distance} onChange={(e) => setDistance(e.target.value)} disabled={appStatus !== 'IMAGE_LOADED'} className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 disabled:bg-gray-200" /> </div> <ARLinks /> </div>
                    {appStatus === 'AWAITING_CALIBRATION_CHOICE' && (<div className="space-y-4 p-4 border-2 border-dashed border-blue-500 rounded-lg"><div className="flex items-center gap-2 text-blue-700"><Save className="w-5 h-5" /><h3 className="font-bold">Use Saved Calibration?</h3></div><button onClick={() => { setAppStatus('IMAGE_LOADED'); setIsPanelOpen(true); }} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Yes, Use Saved</button><button onClick={() => setAppStatus('CALIBRATION_AWAITING_INPUT')} className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700">No, Calibrate New</button></div>)}
                  </div>
                  
                  {appMode === 'QUICK_CAPTURE' && (
                    <div className="pt-6 border-t mt-6">
                        <button onClick={handleQuickCaptureSubmit} disabled={appStatus !== 'IMAGE_LOADED' || !distance || isBusy} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300">
                            <Zap className="w-5 h-5" />
                            Submit for Analysis
                        </button>
                    </div>
                  )}

                  {appMode === 'FULL_ANALYSIS' && appStatus === 'IMAGE_LOADED' && (
                    <div className="space-y-3 pt-6 border-t mt-6"> <button id="start-auto-btn" onClick={handleStartAutoMeasurement} disabled={!distance} className="w-full text-left p-4 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:bg-gray-300 transition-all flex items-center gap-4"> <Zap className="w-6 h-6 flex-shrink-0" /> <div><p className="font-semibold">Automatic Measurement</p><p className="text-xs text-green-200">Slower, more precise</p></div> </button> <button id="start-manual-btn" onClick={handleStartManualMeasurement} disabled={!distance} className="w-full text-left p-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-300 transition-all flex items-center gap-4"> <Ruler className="w-6 h-6 flex-shrink-0" /> <div><p className="font-semibold">Manual Measurement</p><p className="text-xs text-amber-100">Faster, mark points yourself</p></div> </button> </div>
                  )}

                  {appMode === 'FULL_ANALYSIS' && appStatus === 'AUTO_RESULT_SHOWN' && ( <div className="space-y-4"> <div> <h2 className="text-lg font-semibold text-gray-900">Current Measurements</h2> <div className="space-y-2 mt-2"> <div className="flex justify-between items-center p-3 bg-white rounded-lg border"><label className="font-medium text-gray-700">Height:</label><span className="font-mono text-lg text-gray-800">{currentMetrics?.height_m?.toFixed(2) ?? '--'} m</span></div> <div className="flex justify-between items-center p-3 bg-white rounded-lg border"><label className="font-medium text-gray-700">Canopy:</label><span className="font-mono text-lg text-gray-800">{currentMetrics?.canopy_m?.toFixed(2) ?? '--'} m</span></div> <div className="flex justify-between items-center p-3 bg-white rounded-lg border"><label className="font-medium text-gray-700">DBH:</label><span className="font-mono text-lg text-gray-800">{currentMetrics?.dbh_cm?.toFixed(2) ?? '--'} cm</span></div> </div> </div> <div className="grid grid-cols-2 gap-3 pt-4 border-t"> <button onClick={() => { setIsLocationPickerActive(false); setAppStatus('AWAITING_REFINE_POINTS'); setIsPanelOpen(false); setInstructionText("Click points to fix the tree's outline. The *first click* also sets the new height for the DBH measurement."); setShowInstructionToast(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Correct Outline</button> <button onClick={() => { if (currentMeasurementFile && scaleFactor) { setIsLocationPickerActive(false); setResultImageSrc(URL.createObjectURL(currentMeasurementFile)); setCurrentMetrics(null); setDbhLine(null); setRefinePoints([]); setAppStatus('MANUAL_AWAITING_BASE_CLICK'); setIsPanelOpen(false); setInstructionText("Manual Mode: Click the exact base of the tree trunk."); setShowInstructionToast(true); } }} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm">Manual Mode</button> </div> <div className="space-y-4 border-t pt-4"> <button onClick={() => setIsLocationPickerActive(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"> <MapPin className="w-5 h-5 text-blue-600" /> {currentLocation ? `Location Set: ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'Add Location'} </button> <SpeciesIdentifier onIdentificationComplete={setCurrentIdentification} onClear={() => setCurrentIdentification(null)} existingResult={currentIdentification} mainImageFile={currentMeasurementFile} mainImageSrc={originalImageSrc} /> <CO2ResultCard co2Value={currentCO2} isLoading={isCO2Calculating} /> <AdditionalDetailsForm data={additionalData} onUpdate={(field, value) => setAdditionalData(prev => ({ ...prev, [field]: value }))} /> </div> <div className="grid grid-cols-2 gap-3 pt-4 border-t"> <button onClick={() => softReset('FULL_ANALYSIS')} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"><RotateCcw className="w-4 h-4" />Measure Another</button> <button onClick={handleSaveResult} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"><Plus className="w-5 h-5" />Save to History</button> </div> </div> )}

                  <div className="border-t border-gray-200 mt-6 pt-6"> <ResultsTable results={allResults} onDeleteResult={handleDeleteResult} onEditResult={handleOpenEditModal} /> </div>
                </div>
              </div>
            )}
          </>
      )}
    </div>
  );
}

export default App;