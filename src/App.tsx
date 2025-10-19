// src/App.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Upload, TreePine, Ruler, Zap, RotateCcw, Menu, Save, Trash2, Plus, Sparkles, MapPin, X, LogIn, LogOut, Loader2, Edit, Navigation, ShieldCheck, AlertTriangle, ImageIcon, CheckCircle, XCircle, ListTree, GitMerge, Users, BarChart2 } from 'lucide-react';
import ExifReader from 'exifreader';
import { 
  samAutoSegment, samRefineWithPoints, manualGetDbhRectangle, manualCalculation, calculateCO2, 
  Point, Metrics, IdentificationResponse, TreeResult, UpdateTreeResultPayload, PendingTree, CommunityAnalysisPayload,
  getResults, saveResult, deleteResult, updateResult, uploadImage, quickCapture,
  getPendingTrees, claimTree, submitCommunityAnalysis, samAutoSegmentFromUrl
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
import { CommunityGroveView } from './components/CommunityGroveView';
import { supabase } from './supabaseClient';
import { LeaderboardView } from './components/LeaderboardView';

// --- START: SURGICAL ADDITION ---
// Major architectural change: From "Modes" to a linear "Journey"
// AppMode is being deprecated in favor of a simpler View + Status model.
type AppView = 'HUB' | 'SESSION' | 'COMMUNITY_GROVE' | 'LEADERBOARD' | 'CALIBRATION';

// The AppStatus is now more linear, representing steps in the measurement session.
type AppStatus = 
  'IDLE' | // Represents the Hub view
  'SESSION_AWAITING_PERMISSIONS' |
  'SESSION_AWAITING_PHOTO' |
  'SESSION_PROCESSING_PHOTO' |
  'SESSION_AWAITING_DISTANCE' |
  'SESSION_AWAITING_ANALYSIS_CHOICE' |
  'ANALYSIS_AWAITING_INITIAL_CLICK' |
  'ANALYSIS_PROCESSING' |
  'ANALYSIS_SAVING' |
  'ANALYSIS_COMPLETE' |
  'ANALYSIS_AWAITING_REFINE_POINTS' |
  'ANALYSIS_MANUAL_AWAITING_BASE_CLICK' |
  'ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS' |
  'ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS' |
  'ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS' |
  'ANALYSIS_MANUAL_READY_TO_CALCULATE' |
  'ERROR';
// --- END: SURGICAL ADDITION ---

type IdentificationData = Omit<IdentificationResponse, 'remainingIdentificationRequests'> | null;
type LocationData = { lat: number; lng: number } | null;
type SensorStatus = 'PENDING' | 'GRANTED' | 'DENIED';
type PrerequisiteStatus = {
  location: SensorStatus;
  compass: SensorStatus;
};
type UserProfile = { id: string; full_name: string; avatar_url: string; sapling_points: number; rank: string; } | null;


const isManualMode = (status: AppStatus) => status.startsWith('ANALYSIS_MANUAL_');
const CAMERA_FOV_RATIO_KEY = 'treeMeasurementFovRatio';
const ARLinks = () => ( <p className="text-xs text-gray-500 mt-1 pl-1">Need help measuring? Try an AR app: <a href="https://play.google.com/store/apps/details?id=com.grymala.aruler&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">Android</a>{' / '}<a href="https://apps.apple.com/us/app/ar-ruler-digital-tape-measure/id1326773975?platform=iphone" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">iOS</a></p> );

const initialAdditionalData: AdditionalData = { condition: '', ownership: '', remarks: '' };

const AuthComponent = ({ profile }: { profile: UserProfile }) => {
  const { user, signInWithGoogle, signOut } = useAuth();

  if (user && profile) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-green-800">{profile.sapling_points} SP</p>
            <p className="text-xs text-gray-500 -mt-1">{profile.rank}</p>
        </div>
        <img src={user.user_metadata.avatar_url} alt="User avatar" className="w-8 h-8 rounded-full border-2 border-green-200" />
        <button onClick={signOut} className="p-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 flex items-center gap-2" title="Sign Out">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (user && !profile) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
      </div>
    )
  }

  return (
    <button onClick={signInWithGoogle} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
      <LogIn className="w-4 h-4" />
      Sign In
    </button>
  );
};

function App() {
  const { user, session } = useAuth();
  
  // --- START: SURGICAL REFACTOR ---
  // State management is updated to reflect the new "View" and "Status" architecture.
  const [currentView, setCurrentView] = useState<AppView>('HUB');
  const [appStatus, setAppStatus] = useState<AppStatus>('IDLE');
  // --- END: SURGICAL REFACTOR ---

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

  const [prereqStatus, setPrereqStatus] = useState<PrerequisiteStatus>({ location: 'PENDING', compass: 'PENDING' });
  const [userGeoLocation, setUserGeoLocation] = useState<LocationData>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [capturedHeading, setCapturedHeading] = useState<number | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfile>(null);
  const [pendingTrees, setPendingTrees] = useState<PendingTree[]>([]);
  const [claimedTree, setClaimedTree] = useState<TreeResult | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const savedRatio = localStorage.getItem(CAMERA_FOV_RATIO_KEY); if (savedRatio) { setFovRatio(parseFloat(savedRatio)); } }, []);
  
  useEffect(() => { if (isPanelOpen) setShowInstructionToast(false) }, [isPanelOpen]);

  // --- START: SURGICAL REFACTOR ---
  // Pre-flight checks are now part of the session start, not on initial load.
  // This logic is moved into the `handleStartSession` function.
  // This useEffect is now only for the live compass heading.
  useEffect(() => {
    const handleLiveOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setDeviceHeading(event.alpha);
        // We only need to confirm the sensor works once.
        setPrereqStatus(prev => prev.compass === 'GRANTED' ? prev : { ...prev, compass: 'GRANTED' });
      }
    };
    window.addEventListener('deviceorientation', handleLiveOrientation, true);
    
    return () => {
      window.removeEventListener('deviceorientation', handleLiveOrientation, true);
    };
  }, []);
  // --- END: SURGICAL REFACTOR ---


  useEffect(() => {
    const fetchUserResults = async () => {
      if (session?.access_token && user) {
        setIsHistoryLoading(true);
        try {
          const [results, profile] = await Promise.all([
            getResults(session.access_token),
            supabase.from('user_profiles').select('*').eq('id', user.id).single()
          ]);

          setAllResults(results);
          if (profile.data) {
            setUserProfile(profile.data);
          }
          
        } catch (error: any) {
          setErrorMessage(`Could not fetch history: ${error.message}`);
        } finally {
          setIsHistoryLoading(false);
        }
      }
    };
    fetchUserResults();
  }, [session, user]);

  useEffect(() => {
    const triggerCO2Calculation = async () => {
      if (currentMetrics && currentIdentification?.woodDensity) {
        setIsCO2Calculating(true); setCurrentCO2(null);
        try { const result = await calculateCO2(currentMetrics, currentIdentification.woodDensity.value); setCurrentCO2(result.co2_sequestered_kg); } catch (error: any) { console.error("CO2 Calculation Error:", error.message); } finally { setIsCO2Calculating(false); }
      } else { setCurrentCO2(null); }
    };
    triggerCO2Calculation();
  }, [currentMetrics, currentIdentification]);

  // --- START: SURGICAL REFACTOR ---
  // The monolithic image processing useEffect is now tied to a specific app status,
  // making the state machine more robust and predictable.
  useEffect(() => {
    if (appStatus !== 'SESSION_PROCESSING_PHOTO' || !currentMeasurementFile) return;
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
            setAppStatus('SESSION_AWAITING_DISTANCE'); 
            setInstructionText("Great! Now, please enter the distance to the tree's base.");
          } else {
            setPendingTreeFile(currentMeasurementFile);
            if (fovRatio) { 
              // We will eventually add a choice here, for now, we proceed.
              setAppStatus('SESSION_AWAITING_DISTANCE'); 
              setInstructionText("No camera data found, but we can use your saved calibration. Please enter the distance."); 
            } else { 
              // Force calibration
              setCurrentView('CALIBRATION');
            }
          }
        };
      } catch (error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); if (currentMeasurementFile) { const objURL = URL.createObjectURL(currentMeasurementFile); setOriginalImageSrc(objURL); setResultImageSrc(objURL); } }
    };
    processImage();
  }, [currentMeasurementFile, appStatus, fovRatio]);
  // --- END: SURGICAL REFACTOR ---

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
  
  // --- START: SURGICAL REFACTOR ---
  // The old `handleModeSelect` is removed. This new function starts the entire guided journey.
  const handleStartSession = async () => {
    setCurrentView('SESSION');
    setAppStatus('SESSION_AWAITING_PERMISSIONS');
    setInstructionText("Checking device permissions...");
  
    // 1. Location Check
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0
        });
      });
      const userLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
      setUserGeoLocation(userLoc);
      setCurrentLocation(userLoc);
      setPrereqStatus(prev => ({ ...prev, location: 'GRANTED' }));
    } catch (error) {
      setErrorMessage("Location access is required to map a tree. Please enable it in your browser settings.");
      setAppStatus('ERROR');
      return;
    }
  
    // 2. Compass Check (using device orientation listener)
    // @ts-ignore
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        // @ts-ignore
        const permissionState = await DeviceOrientationEvent.requestPermission();
        if (permissionState !== 'granted') throw new Error("Permission denied.");
      } catch (err) {
        setErrorMessage("Compass access is recommended for accurate mapping. You can continue without it.");
        setPrereqStatus(prev => ({ ...prev, compass: 'DENIED' }));
      }
    }
    // The useEffect listener for 'deviceorientation' will update the status to GRANTED if successful.
    
    // 3. Proceed to Photo
    setAppStatus('SESSION_AWAITING_PHOTO');
    setInstructionText("Let's start with a photo of the tree.");
  };
  // --- END: SURGICAL REFACTOR ---


  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => { 
    const file = event.target.files?.[0]; 
    if (!file) return;

    setCapturedHeading(deviceHeading); // Lock in the heading value on upload.

    setAppStatus('SESSION_PROCESSING_PHOTO');
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

  const handleMeasurementSuccess = (metrics: Metrics) => { 
      setCurrentMetrics(metrics); 
      setAppStatus('ANALYSIS_COMPLETE');
      setIsPanelOpen(true); 
      setInstructionText("Measurement complete. Review the results below."); 
  };
  
  const handleCanvasClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    setShowInstructionToast(false);
    const canvas = event.currentTarget;
    if (!imageDimensions || !canvas || !scaleFactor || !session?.access_token) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasClickX = (event.clientX - rect.left) * scaleX;
    const canvasClickY = (event.clientY - rect.top) * scaleY;
    const imageClickX = (canvasClickX / canvas.width) * imageDimensions.w;
    const imageClickY = (canvasClickY / canvas.height) * imageDimensions.h;
    const clickPoint: Point = { x: Math.round(imageClickX), y: Math.round(imageClickY) };

    if (appStatus === 'ANALYSIS_AWAITING_INITIAL_CLICK') {
        setIsPanelOpen(true); 
        setInstructionText("Running automatic segmentation..."); 
        setTransientPoint(clickPoint);
        setAppStatus('ANALYSIS_PROCESSING'); 

        try {
            let response;
            if (currentView === 'SESSION' && currentMeasurementFile) {
                response = await samAutoSegment(currentMeasurementFile, parseFloat(distance), scaleFactor, clickPoint);
            } else if (currentView === 'COMMUNITY_GROVE' && claimedTree) {
                response = await samAutoSegmentFromUrl(claimedTree.image_url!, claimedTree.distance_m!, scaleFactor, clickPoint, session.access_token);
            } else {
                throw new Error("Invalid state for auto-segmentation.");
            }

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

    } else if (appStatus === 'ANALYSIS_AWAITING_REFINE_POINTS') { setRefinePoints(prev => [...prev, clickPoint]);
    } else if (isManualMode(appStatus)) { handleManualPointCollection(clickPoint); }
  };
  
  const onCalibrationComplete = (newFovRatio: number) => {
    setFovRatio(newFovRatio); localStorage.setItem(CAMERA_FOV_RATIO_KEY, newFovRatio.toString());
    setCurrentView('SESSION'); // Return to the session
    setAppStatus('SESSION_AWAITING_DISTANCE');
    setInstructionText("Calibration complete! Now, please enter the distance to the tree's base.");
  };

  const prepareMeasurementSession = (): number | null => {
    const distForCalc = currentView === 'COMMUNITY_GROVE' ? claimedTree?.distance_m : parseFloat(distance);
    const dims = imageDimensions;
    if (!distForCalc || !dims) {
        setErrorMessage("Missing distance or image dimensions.");
        return null;
    }

    let cameraConstant: number | null = null;

    if (focalLength) {
        cameraConstant = 36.0 / focalLength;
    } else if (fovRatio) {
        cameraConstant = fovRatio;
    } else if (currentView === 'COMMUNITY_GROVE' && claimedTree?.scale_factor && claimedTree?.distance_m) {
        // In community mode, we can derive a synthetic camera constant to ensure manual mode works correctly.
        const horizontalPixels = Math.max(dims.w, dims.h);
        cameraConstant = (claimedTree.scale_factor * horizontalPixels) / (claimedTree.distance_m * 1000);
    } else {
        setAppStatus('ERROR');
        setErrorMessage("Calibration data missing. Please calibrate your camera first.");
        return null;
    }

    const distMM = distForCalc * 1000;
    const horizontalPixels = Math.max(dims.w, dims.h);
    const finalScaleFactor = (distMM * cameraConstant) / horizontalPixels;
    setScaleFactor(finalScaleFactor);
    return finalScaleFactor;
  };
  
  const handleStartAutoMeasurement = () => { if (prepareMeasurementSession()) { setAppStatus('ANALYSIS_AWAITING_INITIAL_CLICK'); setIsPanelOpen(false); setInstructionText("Ready. Please click once on the main trunk of the tree."); setShowInstructionToast(true); } };
  
  const handleStartManualMeasurement = () => { 
      const imageToUse = currentView === 'COMMUNITY_GROVE' ? claimedTree?.image_url : originalImageSrc;
      if (prepareMeasurementSession() && imageToUse) { 
          setResultImageSrc(imageToUse); setCurrentMetrics(null); setDbhLine(null); setRefinePoints([]); 
          setAppStatus('ANALYSIS_MANUAL_AWAITING_BASE_CLICK'); setIsPanelOpen(false); setInstructionText("Manual Mode: Click the exact base of the tree trunk."); setShowInstructionToast(true); 
      } 
  };

  const handleApplyRefinements = async () => { if (refinePoints.length === 0 || !currentMeasurementFile) return; try { setAppStatus('ANALYSIS_PROCESSING'); setIsPanelOpen(true); setInstructionText(`Re-running segmentation...`); const response = await samRefineWithPoints(currentMeasurementFile, refinePoints, scaleFactor!); if (response.status !== 'success') throw new Error(response.message); setDbhLine(response.dbh_line_coords); setRefinePoints([]); setResultImageSrc(`data:image/png;base64,${response.result_image_base64}`); handleMeasurementSuccess(response.metrics); } catch(error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); } };
  const handleCalculateManual = async () => { try { setAppStatus('ANALYSIS_PROCESSING'); setIsPanelOpen(true); setInstructionText("Calculating manual results..."); const response = await manualCalculation(manualPoints.height, manualPoints.canopy, manualPoints.girth, scaleFactor!); if (response.status !== 'success') throw new Error(response.message); setManualPoints({ height: [], canopy: [], girth: [] }); setDbhGuideRect(null); handleMeasurementSuccess(response.metrics); } catch(error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); } };
  
  const handleSaveResult = async () => {
    if (!currentMeasurementFile || !currentMetrics || !session?.access_token || !scaleFactor) {
      setErrorMessage("Cannot save: missing data or not logged in.");
      return;
    }

    setAppStatus('ANALYSIS_SAVING');
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
      softReset('SESSION');

    } catch (error: any) {
      setErrorMessage(`Failed to save result: ${error.message}`);
      setAppStatus('ANALYSIS_COMPLETE');
      setInstructionText("An error occurred. Please try saving again.");
    }
  };

  // --- START: SURGICAL REFACTOR ---
  // Renamed from handleQuickCaptureSubmit to reflect the new user-facing language.
  const handleSubmitForCommunity = async () => {
    if (!currentMeasurementFile || !distance || !userGeoLocation || !session?.access_token) {
      setErrorMessage("Missing required data: image, distance, or location.");
      return;
    }
    setAppStatus('ANALYSIS_SAVING');
    setInstructionText("Submitting tree for community analysis...");

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
        capturedHeading, 
        userGeoLocation.lat,
        userGeoLocation.lng,
        session.access_token
      );
      
      const updatedResults = await getResults(session.access_token);
      setAllResults(updatedResults);
      // Pass 'SESSION' to softReset to indicate it's a measurement session concluding.
      softReset('SESSION');

    } catch (error: any) {
      setErrorMessage(`Submission failed: ${error.message}`);
      setAppStatus('ERROR');
    }
  };
  // --- END: SURGICAL REFACTOR ---

  const handleNavigateToGrove = async () => {
    if (!session?.access_token) return;
    setCurrentView('COMMUNITY_GROVE');
    setAppStatus('IDLE'); // Grove has its own internal loading state
    setInstructionText("Fetching pending saplings from the Community Grove...");
    try {
      const trees = await getPendingTrees(session.access_token);
      setPendingTrees(trees);
    } catch(e: any) {
      setErrorMessage(`Failed to load grove: ${e.message}`);
      setAppStatus('ERROR');
    }
  };

  const handleClaimTree = async (treeId: string) => {
    if (!session?.access_token) return;
    setAppStatus('ANALYSIS_PROCESSING'); // Use a generic processing state
    try {
      const res = await claimTree(treeId, session.access_token);
      const claimedData = res.data;

      if (!claimedData || claimedData.distance_m == null || claimedData.scale_factor == null) {
        console.error("Claim response missing critical data:", claimedData);
        throw new Error("Failed to claim tree: The record is missing essential measurement data and cannot be analyzed.");
      }
      
      setClaimedTree(claimedData);

      // --- START: SURGICAL ADDITION ---
      // Convert URL to File to enable SpeciesIdentifier cropping.
      // Reset additional data form state for the new analysis.
      const response = await fetch(claimedData.image_url);
      const blob = await response.blob();
      const fileName = claimedData.image_url.split('/').pop() || 'claimed-tree.jpg';
      const file = new File([blob], fileName, { type: blob.type });
      setCurrentMeasurementFile(file);
      setAdditionalData(initialAdditionalData); 
      // --- END: SURGICAL ADDITION ---

      const img = new Image();
      img.crossOrigin = "Anonymous"; // Important for canvas
      img.src = claimedData.image_url;
      img.onload = () => {
        setImageDimensions({w: img.naturalWidth, h: img.naturalHeight});
        setOriginalImageSrc(claimedData.image_url);
        setResultImageSrc(claimedData.image_url); // Set both for initial display
        setCurrentLocation(claimedData.latitude && claimedData.longitude ? {lat: claimedData.latitude, lng: claimedData.longitude} : null);
        setDistance(claimedData.distance_m ? String(claimedData.distance_m) : '');

        setAppStatus('SESSION_AWAITING_ANALYSIS_CHOICE');
        setIsPanelOpen(true);
        setInstructionText(`Tree claimed. You have 10 minutes to analyze. Start by selecting a measurement mode below.`);
      };
      img.onerror = () => {
        throw new Error("Could not load tree image.");
      }
    } catch(e: any) {
      setErrorMessage(e.message);
      handleReturnToHub();
    }
  };

  const handleSubmitCommunityAnalysis = async () => {
    if (!claimedTree || !currentMetrics || !session?.access_token) return;
    setAppStatus('ANALYSIS_SAVING');
    try {
      // --- START: SURGICAL ADDITION ---
      // Add additional data to the submission payload.
      const payload: CommunityAnalysisPayload = {
        metrics: currentMetrics,
        species: currentIdentification?.bestMatch,
        ...additionalData,
      };
      // --- END: SURGICAL ADDITION ---
      await submitCommunityAnalysis(claimedTree.id, payload, session.access_token);
      softReset('COMMUNITY_GROVE');
    } catch(e: any) {
      setErrorMessage(e.message);
      setAppStatus('ANALYSIS_COMPLETE');
    }
  };


  const softReset = (originView: AppView) => {
    const isCommunityMode = originView === 'COMMUNITY_GROVE';
    
    // Always return to the Hub
    setCurrentView('HUB');
    setAppStatus('IDLE');
    setInstructionText(
        isCommunityMode ? 'Analysis submitted! Returning to the Hub.' :
        'Session complete! Ready to map another tree.'
    );
    
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
    setCapturedHeading(null);
    setIsPanelOpen(false); // Hide panel on session end
    setClaimedTree(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  // --- START: SURGICAL REFACTOR ---
  // Replaced `handleReturnToModeSelect` with a simpler `handleReturnToHub`
  const handleReturnToHub = () => {
    // Soft reset handles most of the state clearing.
    // This function is now simpler and just ensures the view is correct.
    softReset(currentView);
    setCurrentView('HUB');
    setAppStatus('IDLE');
  };
  // --- END: SURGICAL REFACTOR ---

  const handleManualPointCollection = async (point: Point) => { 
    if (!scaleFactor || !imageDimensions) return;
    const showNextInstruction = (text: string) => { setInstructionText(text); setShowInstructionToast(true); };
    if (appStatus === 'ANALYSIS_MANUAL_AWAITING_BASE_CLICK') {
      try { const response = await manualGetDbhRectangle(point, scaleFactor, imageDimensions.w, imageDimensions.h); setDbhGuideRect(response.rectangle_coords); setAppStatus('ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS'); showNextInstruction("STEP 1/3 (Height): Click highest and lowest points."); } catch (error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); }
    } else if (appStatus === 'ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS') {
      setManualPoints(p => { const h = [...p.height, point]; if (h.length === 2) { setAppStatus('ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS'); showNextInstruction("STEP 2/3 (Canopy): Click widest points."); } return {...p, height: h}; }); 
    } else if (appStatus === 'ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS') {
      setManualPoints(p => { const c = [...p.canopy, point]; if (c.length === 2) { setAppStatus('ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS'); showNextInstruction("STEP 3/3 (Girth): Use guide to click trunk's width."); } return {...p, canopy: c}; }); 
    } else if (appStatus === 'ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS') {
      setManualPoints(p => { const g = [...p.girth, point]; if (g.length === 2) { setAppStatus('ANALYSIS_MANUAL_READY_TO_CALCULATE'); setIsPanelOpen(true); setInstructionText("All points collected. Click 'Calculate'."); } return {...p, girth: g}; }); 
    }
  };

  const handleConfirmLocation = (location: LocationData) => { setCurrentLocation(location); setIsLocationPickerActive(false); };
  
  if (currentView === 'CALIBRATION') { return <CalibrationView onCalibrationComplete={onCalibrationComplete} />; }
  if (currentView === 'LEADERBOARD') { return <LeaderboardView onBack={() => setCurrentView('HUB')} />; }
  if (currentView === 'COMMUNITY_GROVE' && !claimedTree) { return <CommunityGroveView pendingTrees={pendingTrees} isLoading={appStatus === 'ANALYSIS_PROCESSING'} onClaimTree={handleClaimTree} onBack={handleReturnToHub} /> }

  // --- START: SURGICAL REFACTOR ---
  // The main return block is now structured around the Home Hub and the Measurement Session.
  // This is the core of the new user flow.
  const isSessionActive = currentView === 'SESSION' || (currentView === 'COMMUNITY_GROVE' && !!claimedTree);
  const isBusy = ['ANALYSIS_PROCESSING', 'ANALYSIS_SAVING'].includes(appStatus) || isCO2Calculating || isHistoryLoading;

  const renderSessionView = () => (
    <>
      <div id="display-panel" className="flex-1 bg-gray-100 flex items-center justify-center relative">
          {(!originalImageSrc && !isLocationPickerActive) && <div className="hidden md:flex flex-col items-center text-gray-400"><TreePine size={64}/><p className="mt-4 text-lg">Upload an image to start</p></div>}
          {isLocationPickerActive ? ( <LocationPicker onConfirm={handleConfirmLocation} onCancel={() => setIsLocationPickerActive(false)} initialLocation={currentLocation} /> ) : (
            originalImageSrc && <canvas ref={canvasRef} id="image-canvas" onClick={handleCanvasClick} className={`max-w-full max-h-full ${appStatus.includes('AWAITING') ? 'cursor-crosshair' : ''}`} />
          )}
      </div>
        
      {isSessionActive && !isPanelOpen && !isLocationPickerActive && ( <button onClick={() => setIsPanelOpen(true)} className="md:hidden fixed bottom-6 right-6 z-30 p-4 bg-green-700 text-white rounded-full shadow-lg hover:bg-green-800 active:scale-95 transition-transform"> <Menu size={24} /> </button> )}

      {(!isLocationPickerActive || window.innerWidth >= 768) && (
        <div id="control-panel" className={` bg-gray-50 border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out md:static md:w-[35%] md:max-w-xl md:flex-shrink-0 md:translate-y-0 fixed z-20 inset-0 ${isPanelOpen || !isSessionActive ? 'translate-y-0' : 'translate-y-full'} `} >
          <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 md:hidden">
              {isSessionActive ? ( <> <AuthComponent profile={userProfile} /> <button onClick={() => setIsPanelOpen(false)} className="p-2 text-gray-500 hover:text-gray-800"><X size={24} /></button> </> ) : ( <div className="w-full flex justify-between items-center"> <div className="flex items-center gap-3"><TreePine className="w-7 h-7 text-green-700" /><h1 className="text-xl font-semibold text-gray-900">Tree Measurement</h1></div> <AuthComponent profile={userProfile} /> </div> )}
          </div>

          <div className="flex-grow overflow-y-auto p-4 md:p-6">
            <div className="hidden md:flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-gray-900">{claimedTree ? 'Community Analysis' : 'New Measurement'}</h1>
              </div>
              <AuthComponent profile={userProfile} />
            </div>

            <button onClick={handleReturnToHub} className="text-sm text-blue-600 hover:underline mb-4">{'<'} Back to Hub</button>
            
            <div className="p-4 rounded-lg mb-6 bg-slate-100 border border-slate-200"><h3 className="font-bold text-slate-800">Current Task</h3><div id="status-box" className="text-sm text-slate-600"><p>{instructionText}</p></div>{errorMessage && <p className="text-sm text-red-600 font-medium mt-1">{errorMessage}</p>}</div>
            {isBusy && ( <div className="mb-6"><div className="progress-bar-container"><div className="progress-bar-animated"></div></div>{ <p className="text-xs text-center text-gray-500 animate-pulse mt-1">{isHistoryLoading ? 'Loading history...' : appStatus === 'ANALYSIS_SAVING' ? 'Saving...' : isCO2Calculating ? 'Calculating CO₂...' : 'Processing...'}</p>}</div> )}
            
            {/* --- Guided Session Steps --- */}
            {appStatus === 'SESSION_AWAITING_PHOTO' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">1. Select Photo</label> 
                <input ref={fileInputRef} type="file" id="image-upload" accept="image/*" onChange={handleImageUpload} className="hidden" /> 
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50"> <Upload className="w-5 h-5 text-gray-400" /> <span className="text-gray-600">Choose Image File</span> </button>
              </div>
            )}

            {appStatus === 'SESSION_AWAITING_DISTANCE' && (
              <div>
                <label htmlFor="distance-input" className="block text-sm font-medium text-gray-700 mb-2">2. Distance to Tree Base (meters)</label>
                <div className="relative">
                  <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="number" id="distance-input" placeholder="e.g., 10.5" value={distance} onChange={(e) => setDistance(e.target.value)} className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500" />
                </div>
                <ARLinks />
                <button onClick={() => setAppStatus('SESSION_AWAITING_ANALYSIS_CHOICE')} disabled={!distance} className="w-full mt-4 px-6 py-3 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:bg-gray-300">
                  Continue
                </button>
              </div>
            )}

            {appStatus === 'SESSION_AWAITING_ANALYSIS_CHOICE' && (
              <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-base font-semibold text-center text-gray-800">How would you like to proceed?</h3>
                  <button onClick={handleSubmitForCommunity} className="w-full text-left p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-4">
                    <Navigation className="w-6 h-6 flex-shrink-0" /> 
                    <div>
                      <p className="font-semibold">Submit for Community <span className="text-xs font-bold bg-white text-blue-700 px-1.5 py-0.5 rounded-full ml-1">+2 SP</span></p>
                      <p className="text-xs text-blue-200">Quickly tag this tree for others to analyze.</p>
                    </div>
                  </button>
                  <button onClick={() => setIsPanelOpen(false)} className="w-full text-left p-4 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-all flex items-center gap-4">
                    <ShieldCheck className="w-6 h-6 flex-shrink-0" /> 
                    <div>
                      <p className="font-semibold">Analyze Myself <span className="text-xs font-bold bg-white text-green-700 px-1.5 py-0.5 rounded-full ml-1">+15 SP</span></p>
                      <p className="text-xs text-green-200">Perform a detailed analysis for immediate results.</p>
                    </div> 
                  </button>
              </div>
            )}

            {(appStatus.startsWith('ANALYSIS_') && !isManualMode(appStatus) && appStatus !== 'ANALYSIS_COMPLETE') && (
               <div className="space-y-3 pt-6 border-t mt-6"> 
                  <button id="start-auto-btn" onClick={handleStartAutoMeasurement} className="w-full text-left p-4 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:bg-gray-300 disabled:opacity-50 transition-all flex items-center gap-4"> <Zap className="w-6 h-6 flex-shrink-0" /> <div><p className="font-semibold">Automatic Measurement</p><p className="text-xs text-green-200">Slower, more precise</p></div> </button> 
                  <button id="start-manual-btn" onClick={handleStartManualMeasurement} className="w-full text-left p-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-300 transition-all flex items-center gap-4"> <Ruler className="w-6 h-6 flex-shrink-0" /> <div><p className="font-semibold">Manual Measurement</p><p className="text-xs text-amber-100">Faster, mark points yourself</p></div> </button> 
              </div>
            )}
            
            {appStatus === 'ANALYSIS_MANUAL_READY_TO_CALCULATE' && (
              <div className="pt-6 mt-6 border-t">
                <button onClick={handleCalculateManual} disabled={isBusy} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 disabled:bg-gray-300">
                  <Ruler className="w-5 h-5" /> Calculate Measurements
                </button>
              </div>
            )}

            {currentMetrics && (appStatus === 'ANALYSIS_COMPLETE') && ( <div className="space-y-4"> <div> <h2 className="text-lg font-semibold text-gray-900">Current Measurements</h2> <div className="space-y-2 mt-2"> <div className="flex justify-between items-center p-3 bg-white rounded-lg border"><label className="font-medium text-gray-700">Height:</label><span className="font-mono text-lg text-gray-800">{currentMetrics?.height_m?.toFixed(2) ?? '--'} m</span></div> <div className="flex justify-between items-center p-3 bg-white rounded-lg border"><label className="font-medium text-gray-700">Canopy:</label><span className="font-mono text-lg text-gray-800">{currentMetrics?.canopy_m?.toFixed(2) ?? '--'} m</span></div> <div className="flex justify-between items-center p-3 bg-white rounded-lg border"><label className="font-medium text-gray-700">Trunk Width (at chest height):</label><span className="font-mono text-lg text-gray-800">{currentMetrics?.dbh_cm?.toFixed(2) ?? '--'} cm</span></div> </div> </div> {currentView === 'SESSION' && appStatus === 'ANALYSIS_COMPLETE' && <div className="grid grid-cols-2 gap-3 pt-4 border-t"> <button onClick={() => { setIsLocationPickerActive(false); setAppStatus('ANALYSIS_AWAITING_REFINE_POINTS'); setIsPanelOpen(false); setInstructionText("Click points to fix the tree's outline. The *first click* also sets the new height for the DBH measurement."); setShowInstructionToast(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Correct Outline</button> <button onClick={() => { if (currentMeasurementFile && scaleFactor) { setIsLocationPickerActive(false); setResultImageSrc(URL.createObjectURL(currentMeasurementFile)); setCurrentMetrics(null); setDbhLine(null); setRefinePoints([]); setAppStatus('ANALYSIS_MANUAL_AWAITING_BASE_CLICK'); setIsPanelOpen(false); setInstructionText("Manual Mode: Click the exact base of the tree trunk."); setShowInstructionToast(true); } }} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm">Manual Mode</button> </div>} 
            <div className="space-y-4 border-t pt-4"> 
              <SpeciesIdentifier onIdentificationComplete={setCurrentIdentification} onClear={() => setCurrentIdentification(null)} existingResult={currentIdentification} mainImageFile={currentMeasurementFile} mainImageSrc={originalImageSrc} /> 
              <CO2ResultCard co2Value={currentCO2} isLoading={isCO2Calculating} /> 
              {currentView === 'SESSION' && 
                <button onClick={() => setIsLocationPickerActive(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"> 
                  <MapPin className="w-5 h-5 text-blue-600" /> {currentLocation ? `Location Set: ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'Add Location'} 
                </button>
              }
              {(currentView === 'SESSION' || currentView === 'COMMUNITY_GROVE') && 
                <AdditionalDetailsForm data={additionalData} onUpdate={(field, value) => setAdditionalData(prev => ({ ...prev, [field]: value }))} />
              }
            </div> 
            <div className="grid grid-cols-2 gap-3 pt-4 border-t"> <button onClick={() => softReset(currentView)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"><RotateCcw className="w-4 h-4" />{currentView === 'COMMUNITY_GROVE' ? 'Cancel & Exit' : 'Measure Another'}</button> {currentView === 'SESSION' && <button onClick={handleSaveResult} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"><Plus className="w-5 h-5" />Save to History</button>} {currentView === 'COMMUNITY_GROVE' && <button onClick={handleSubmitCommunityAnalysis} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"><GitMerge className="w-5 h-5" />Submit Analysis</button>}</div> </div> )}
            
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="h-screen w-screen bg-white font-inter flex flex-col overflow-hidden">
      {editingResult && ( <EditResultModal result={editingResult} onClose={() => setEditingResult(null)} onSave={handleUpdateResult} /> )}
      <InstructionToast message={instructionText} show={showInstructionToast} onClose={() => setShowInstructionToast(false)} />
      
      {isSessionActive ? renderSessionView() : (
        // Home Hub View
        <div className="flex flex-col h-full">
            <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200">
                <div className="flex items-center gap-3"><TreePine className="w-7 h-7 text-green-700" /><h1 className="text-xl font-semibold text-gray-900">Tree Measurement</h1></div>
                <AuthComponent profile={userProfile} />
            </header>
            <main className="flex-grow overflow-y-auto p-4 md:p-6 space-y-8">
              <div className="text-center">
                <button onClick={handleStartSession} className="px-8 py-4 bg-green-700 text-white rounded-lg font-bold text-lg hover:bg-green-800 transition-transform active:scale-95 shadow-lg">
                  Start Mapping a Tree
                </button>
                <div className="mt-6 flex justify-center gap-6">
                  <button onClick={handleNavigateToGrove} className="text-base font-medium text-indigo-600 hover:underline">Visit the Community Grove</button>
                  <button onClick={() => setCurrentView('LEADERBOARD')} className="text-base font-medium text-indigo-600 hover:underline">View Leaderboard</button>
                </div>
              </div>
              <ResultsTable results={allResults} onDeleteResult={handleDeleteResult} onEditResult={handleOpenEditModal} />
            </main>
        </div>
      )}
    </div>
  );
  // --- END: SURGICAL REFACTOR ---
}

export default App;