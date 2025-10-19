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

type AppMode = 'SELECT_MODE' | 'QUICK_CAPTURE' | 'FULL_ANALYSIS' | 'COMMUNITY_ANALYSIS';
type AppStatus = 'IDLE' | 'IMAGE_UPLOADING' | 'IMAGE_LOADED' | 'AWAITING_INITIAL_CLICK' | 'PROCESSING' | 'SAVING' | 'AUTO_RESULT_SHOWN' | 'AWAITING_REFINE_POINTS' | 'MANUAL_AWAITING_BASE_CLICK' | 'MANUAL_AWAITING_HEIGHT_POINTS' | 'MANUAL_AWAITING_CANOPY_POINTS' | 'MANUAL_AWAITING_GIRTH_POINTS' | 'MANUAL_READY_TO_CALCULATE' | 'AWAITING_CALIBRATION_CHOICE' | 'CALIBRATION_AWAITING_INPUT' | 'ERROR' | 'FETCHING_GROVE' | 'GROVE_LOADED' | 'CLAIMING_TREE' | 'COMMUNITY_ANALYSIS_ACTIVE';
type IdentificationData = Omit<IdentificationResponse, 'remainingIdentificationRequests'> | null;
type LocationData = { lat: number; lng: number } | null;
type SensorStatus = 'PENDING' | 'GRANTED' | 'DENIED';
type PrerequisiteStatus = {
  location: SensorStatus;
  compass: SensorStatus;
};
type UserProfile = { id: string; full_name: string; avatar_url: string; sapling_points: number; rank: string; } | null;
type MainView = 'main' | 'leaderboard';


const isManualMode = (status: AppStatus) => status.startsWith('MANUAL_');
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
  
  const [currentView, setCurrentView] = useState<MainView>('main');
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

  // Effect for pre-flight checks on the mode selection screen
  useEffect(() => {
    if (appMode !== 'SELECT_MODE') return;
  
    // --- Location Check ---
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserGeoLocation(userLoc);
        setCurrentLocation(userLoc);
        setPrereqStatus(prev => ({ ...prev, location: 'GRANTED' }));
      },
      (error) => {
        console.error("Geolocation error:", error);
        setPrereqStatus(prev => ({ ...prev, location: 'DENIED' }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  
    // --- Compass Check ---
    const handleInitialOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setPrereqStatus(prev => ({ ...prev, compass: 'GRANTED' }));
        window.removeEventListener('deviceorientation', handleInitialOrientation, true);
      }
    };
  
    const requestAndListen = () => {
        window.addEventListener('deviceorientation', handleInitialOrientation, true);
        setTimeout(() => {
            setPrereqStatus(prev => prev.compass === 'GRANTED' ? prev : { ...prev, compass: 'DENIED' });
        }, 3000);
    };

    // @ts-ignore
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // @ts-ignore
      DeviceOrientationEvent.requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            requestAndListen();
          } else {
            setPrereqStatus(prev => ({ ...prev, compass: 'DENIED' }));
          }
        })
        .catch((err: any) => {
            console.error("Compass permission error:", err);
            setPrereqStatus(prev => ({ ...prev, compass: 'DENIED' }));
        });
    } else {
      requestAndListen();
    }
  }, [appMode]);

  // Effect for live compass updates (used to snapshot on upload)
  useEffect(() => {
    // Keep listener active in both modes if compass is granted
    if (prereqStatus.compass !== 'GRANTED') {
      return;
    }

    const handleLiveOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setDeviceHeading(event.alpha);
      }
    };
    window.addEventListener('deviceorientation', handleLiveOrientation, true);
    
    return () => {
      window.removeEventListener('deviceorientation', handleLiveOrientation, true);
    };
  }, [prereqStatus.compass]);


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
    setAppMode(mode);
    setAppStatus('IDLE');
    setIsPanelOpen(true);
    if (mode === 'COMMUNITY_ANALYSIS') {
      handleNavigateToGrove();
    } else {
      setInstructionText(mode === 'QUICK_CAPTURE' ? 'Ready for Quick Capture. Upload an image and enter the distance.' : 'Ready for Full Analysis. Upload an image to start.');
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => { 
    const file = event.target.files?.[0]; 
    if (!file) return;

    setCapturedHeading(deviceHeading); // Lock in the heading value on upload.

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

  const handleMeasurementSuccess = (metrics: Metrics) => { 
      setCurrentMetrics(metrics); 
      setAppStatus(appMode === 'COMMUNITY_ANALYSIS' ? 'AUTO_RESULT_SHOWN' : 'AUTO_RESULT_SHOWN'); 
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

    if (appStatus === 'AWAITING_INITIAL_CLICK') {
        setIsPanelOpen(true); 
        setInstructionText("Running automatic segmentation..."); 
        setTransientPoint(clickPoint);
        setAppStatus('PROCESSING'); 

        try {
            let response;
            if (appMode === 'FULL_ANALYSIS' && currentMeasurementFile) {
                response = await samAutoSegment(currentMeasurementFile, parseFloat(distance), scaleFactor, clickPoint);
            } else if (appMode === 'COMMUNITY_ANALYSIS' && claimedTree) {
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

    } else if (appStatus === 'AWAITING_REFINE_POINTS') { setRefinePoints(prev => [...prev, clickPoint]);
    } else if (isManualMode(appStatus)) { handleManualPointCollection(clickPoint); }
  };
  
  const onCalibrationComplete = (newFovRatio: number) => {
    setFovRatio(newFovRatio); localStorage.setItem(CAMERA_FOV_RATIO_KEY, newFovRatio.toString());
    if (pendingTreeFile) { setCurrentMeasurementFile(pendingTreeFile); setPendingTreeFile(null); setAppStatus('IMAGE_UPLOADING');
    } else { softReset(appMode); }
  };

  const prepareMeasurementSession = (): number | null => {
    const distForCalc = appMode === 'COMMUNITY_ANALYSIS' ? claimedTree?.distance_m : parseFloat(distance);
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
    } else if (appMode === 'COMMUNITY_ANALYSIS' && claimedTree?.scale_factor && claimedTree?.distance_m) {
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
  
  const handleStartAutoMeasurement = () => { if (prepareMeasurementSession()) { setAppStatus('AWAITING_INITIAL_CLICK'); setIsPanelOpen(false); setInstructionText("Ready. Please click once on the main trunk of the tree."); setShowInstructionToast(true); } };
  
  const handleStartManualMeasurement = () => { 
      const imageToUse = appMode === 'COMMUNITY_ANALYSIS' ? claimedTree?.image_url : originalImageSrc;
      if (prepareMeasurementSession() && imageToUse) { 
          setResultImageSrc(imageToUse); setCurrentMetrics(null); setDbhLine(null); setRefinePoints([]); 
          setAppStatus('MANUAL_AWAITING_BASE_CLICK'); setIsPanelOpen(false); setInstructionText("Manual Mode: Click the exact base of the tree trunk."); setShowInstructionToast(true); 
      } 
  };

  const handleApplyRefinements = async () => { if (refinePoints.length === 0 || !currentMeasurementFile) return; try { setAppStatus('PROCESSING'); setIsPanelOpen(true); setInstructionText(`Re-running segmentation...`); const response = await samRefineWithPoints(currentMeasurementFile, refinePoints, scaleFactor!); if (response.status !== 'success') throw new Error(response.message); setDbhLine(response.dbh_line_coords); setRefinePoints([]); setResultImageSrc(`data:image/png;base64,${response.result_image_base64}`); handleMeasurementSuccess(response.metrics); } catch(error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); } };
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
        capturedHeading, // Use the captured heading
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

  const handleNavigateToGrove = async () => {
    if (!session?.access_token) return;
    setAppMode('COMMUNITY_ANALYSIS');
    setAppStatus('FETCHING_GROVE');
    setInstructionText("Fetching pending saplings from the Community Grove...");
    try {
      const trees = await getPendingTrees(session.access_token);
      setPendingTrees(trees);
      setAppStatus('GROVE_LOADED');
    } catch(e: any) {
      setErrorMessage(`Failed to load grove: ${e.message}`);
      setAppStatus('ERROR');
    }
  };

  const handleClaimTree = async (treeId: string) => {
    if (!session?.access_token) return;
    setAppStatus('CLAIMING_TREE');
    try {
      const res = await claimTree(treeId, session.access_token);
      const claimedData = res.data;

      // --- START: SURGICAL ADDITION ---
      // Surgically added check to ensure critical data is present before proceeding.
      if (!claimedData || claimedData.distance_m == null || claimedData.scale_factor == null) {
        console.error("Claim response missing critical data:", claimedData);
        throw new Error("Failed to claim tree: The record is missing essential measurement data and cannot be analyzed.");
      }
      // --- END: SURGICAL ADDITION ---

      setClaimedTree(claimedData);

      const img = new Image();
      img.crossOrigin = "Anonymous"; // Important for canvas
      img.src = claimedData.image_url;
      img.onload = () => {
        setImageDimensions({w: img.naturalWidth, h: img.naturalHeight});
        setOriginalImageSrc(claimedData.image_url);
        setResultImageSrc(claimedData.image_url); // Set both for initial display
        setCurrentLocation(claimedData.latitude && claimedData.longitude ? {lat: claimedData.latitude, lng: claimedData.longitude} : null);
        setDistance(claimedData.distance_m ? String(claimedData.distance_m) : '');

        setAppStatus('COMMUNITY_ANALYSIS_ACTIVE');
        setIsPanelOpen(true);
        setInstructionText(`Tree claimed. You have 10 minutes to analyze. Start by selecting a measurement mode below.`);
      };
      img.onerror = () => {
        throw new Error("Could not load tree image.");
      }
    } catch(e: any) {
      setErrorMessage(e.message);
      setAppStatus('GROVE_LOADED');
    }
  };

  const handleSubmitCommunityAnalysis = async () => {
    if (!claimedTree || !currentMetrics || !session?.access_token) return;
    setAppStatus('SAVING');
    try {
      const payload: CommunityAnalysisPayload = {
        metrics: currentMetrics,
        species: currentIdentification?.bestMatch
      };
      await submitCommunityAnalysis(claimedTree.id, payload, session.access_token);
      softReset('COMMUNITY_ANALYSIS');
    } catch(e: any) {
      setErrorMessage(e.message);
      setAppStatus('AUTO_RESULT_SHOWN');
    }
  };


  const softReset = (currentMode: AppMode) => {
    const isCommunityMode = currentMode === 'COMMUNITY_ANALYSIS';
    setAppMode(currentMode);
    setAppStatus(isCommunityMode ? 'IDLE' : 'IDLE'); // Go to mode select after
    setInstructionText(
        isCommunityMode ? 'Analysis submitted! Returning to mode selection.' :
        currentMode === 'QUICK_CAPTURE' ? 'Ready for next Quick Capture. Upload an image.' : 
        'Ready for next Full Analysis. Upload an image.'
    );
    
    if (isCommunityMode) {
      handleReturnToModeSelect();
      return;
    }

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
    setIsPanelOpen(true);
    setClaimedTree(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleReturnToModeSelect = () => {
    setAppMode('SELECT_MODE');
    setAppStatus('IDLE');
    setCurrentView('main');
    setPrereqStatus({ location: 'PENDING', compass: 'PENDING' });
    setUserGeoLocation(null);
    setCurrentLocation(null);
    setDeviceHeading(null);
    setCapturedHeading(null);
    setInstructionText("Welcome! Please select a measurement mode to begin.");
    setPendingTrees([]);
    setClaimedTree(null);
    // Also reset measurement state
    setCurrentMeasurementFile(null); setDistance(''); setFocalLength(null); setScaleFactor(null); setCurrentMetrics(null); setCurrentIdentification(null); setCurrentCO2(null); setAdditionalData(initialAdditionalData); setIsLocationPickerActive(false); setRefinePoints([]); setOriginalImageSrc(''); setResultImageSrc(''); setDbhLine(null); setTransientPoint(null); setManualPoints({ height: [], canopy: [], girth: [] }); setDbhGuideRect(null); setPendingTreeFile(null); setImageDimensions(null); setCapturedHeading(null);
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
  
  if (appStatus === 'CALIBRATION_AWAITING_INPUT') { return <CalibrationView onCalibrationComplete={onCalibrationComplete} />; }

  const isWorkbenchVisible = appMode === 'QUICK_CAPTURE' || appMode === 'FULL_ANALYSIS' || (appMode === 'COMMUNITY_ANALYSIS' && claimedTree);
  const hasActiveMeasurement = isWorkbenchVisible && appStatus !== 'IDLE';
  const isBusy = ['PROCESSING', 'SAVING', 'FETCHING_GROVE', 'CLAIMING_TREE'].includes(appStatus) || isCO2Calculating || isHistoryLoading;

  const workbenchImageSrc = appMode === 'COMMUNITY_ANALYSIS' ? claimedTree?.image_url : originalImageSrc;
  const workbenchTitle = appMode === 'COMMUNITY_ANALYSIS' ? 'Community Analysis' : appMode === 'QUICK_CAPTURE' ? 'Quick Capture' : 'Full Analysis';
  const workbenchIcon = appMode === 'COMMUNITY_ANALYSIS' ? <Users className="w-8 h-8 text-indigo-700" /> : appMode === 'QUICK_CAPTURE' ? <Navigation className="w-8 h-8 text-blue-700" /> : <TreePine className="w-8 h-8 text-green-700" />;

  const isAutoDisabled = (appMode === 'FULL_ANALYSIS' && !currentMeasurementFile) || (appMode === 'COMMUNITY_ANALYSIS' && !claimedTree);
  const isManualDisabled = (appMode === 'FULL_ANALYSIS' && !currentMeasurementFile) || (appMode === 'COMMUNITY_ANALYSIS' && !claimedTree);

  const PrereqCheckItem = ({ name, status, errorText }: { name: string, status: SensorStatus, errorText: string }) => {
    return (
      <div className="flex items-center gap-3">
        {status === 'PENDING' && <Loader2 className="animate-spin w-5 h-5 text-gray-400" />}
        {status === 'GRANTED' && <CheckCircle className="w-5 h-5 text-green-600" />}
        {status === 'DENIED' && <XCircle className="w-5 h-5 text-red-600" />}
        <div>
          <p className={`font-medium ${status === 'DENIED' ? 'text-red-700' : 'text-gray-700'}`}>{name}</p>
          {status === 'DENIED' && <p className="text-xs text-red-600">{errorText}</p>}
        </div>
      </div>
    );
  };

  const ModeSelectionScreen = () => (
    <div className="w-full h-full flex flex-col justify-center items-center p-4 md:p-8">
      <div className="text-center max-w-2xl">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Choose Your Workflow</h2>
        <p className="mt-2 text-gray-600">First, let's ensure your device is ready.</p>
      </div>

      <div className="mt-8 p-6 bg-white border border-gray-200 rounded-lg w-full max-w-md space-y-4">
        <h3 className="font-semibold text-gray-800">System Prerequisites</h3>
        <PrereqCheckItem name="Location Access" status={prereqStatus.location} errorText="Location is required. Please enable it in browser settings." />
        <PrereqCheckItem name="Compass Sensor" status={prereqStatus.compass} errorText="Compass is needed for Quick Capture. Please enable permissions and point your device towards the tree." />
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
        <button onClick={() => handleModeSelect('QUICK_CAPTURE')} disabled={prereqStatus.location !== 'GRANTED' || prereqStatus.compass !== 'GRANTED'} className="group text-left p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full group-hover:bg-blue-500 transition-colors"> <Navigation className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" /> </div>
            <div> <h3 className="text-lg font-bold text-gray-900">Quick Capture</h3> <p className="text-sm text-gray-500">Fastest way to log a tree. Requires a photo, distance, and GPS.</p> </div>
          </div>
        </button>
        <button onClick={() => handleModeSelect('FULL_ANALYSIS')} disabled={prereqStatus.location !== 'GRANTED'} className="group text-left p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-green-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
           <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full group-hover:bg-green-500 transition-colors"> <ShieldCheck className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" /> </div>
            <div> <h3 className="text-lg font-bold text-gray-900">Full Analysis</h3> <p className="text-sm text-gray-500">The complete in-field tool for the most accurate results.</p> </div>
          </div>
        </button>
        <button onClick={() => handleModeSelect('COMMUNITY_ANALYSIS')} disabled={prereqStatus.location !== 'GRANTED'} className="group text-left p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
           <div className="flex items-center gap-4">
            <div className="bg-indigo-100 p-3 rounded-full group-hover:bg-indigo-500 transition-colors"> <Users className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" /> </div>
            <div> <h3 className="text-lg font-bold text-gray-900">Community Grove</h3> <p className="text-sm text-gray-500">Help the community by analyzing pending tree submissions.</p> </div>
          </div>
        </button>
      </div>

      <div className="mt-8 w-full max-w-6xl">
        <button onClick={() => setCurrentView('leaderboard')} className="group w-full text-left p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-gray-400 hover:shadow-lg transition-all flex items-center justify-center gap-3">
          <BarChart2 className="w-5 h-5 text-gray-600 group-hover:text-indigo-600" />
          <h3 className="text-md font-bold text-gray-700 group-hover:text-indigo-700">View Community Leaderboard</h3>
        </button>
      </div>
    </div>
  );

  if (currentView === 'leaderboard') {
    return <LeaderboardView onBack={() => setCurrentView('main')} />;
  }

  return (
    <div className="h-screen w-screen bg-white font-inter flex flex-col md:flex-row overflow-hidden">
      {editingResult && ( <EditResultModal result={editingResult} onClose={() => setEditingResult(null)} onSave={handleUpdateResult} /> )}
      <InstructionToast message={instructionText} show={showInstructionToast} onClose={() => setShowInstructionToast(false)} />
      
      {appMode === 'SELECT_MODE' && <ModeSelectionScreen />}
      
      {appMode === 'COMMUNITY_ANALYSIS' && !claimedTree && (
        <CommunityGroveView pendingTrees={pendingTrees} isLoading={appStatus === 'FETCHING_GROVE'} onClaimTree={handleClaimTree} onBack={handleReturnToModeSelect} />
      )}

      {/* --- SURGICAL CHANGE IS HERE --- */}
      {/* The condition below was changed from `appStatus === 'COMMUNITY_ANALYSIS_ACTIVE'` to `(appMode === 'COMMUNITY_ANALYSIS' && claimedTree)`. */}
      {/* This ensures the workbench stays visible throughout the entire analysis workflow, not just on the first screen. */}
      {isWorkbenchVisible && (
          <>
            <div id="display-panel" className="flex-1 bg-gray-100 flex items-center justify-center relative">
                {(!workbenchImageSrc && !isLocationPickerActive) && <div className="hidden md:flex flex-col items-center text-gray-400"><TreePine size={64}/><p className="mt-4 text-lg">Upload an image to start</p></div>}
                {isLocationPickerActive ? ( <LocationPicker onConfirm={handleConfirmLocation} onCancel={() => setIsLocationPickerActive(false)} initialLocation={currentLocation} /> ) : (
                  workbenchImageSrc && <canvas ref={canvasRef} id="image-canvas" onClick={handleCanvasClick} className={`max-w-full max-h-full ${appStatus.includes('AWAITING') ? 'cursor-crosshair' : ''}`} />
                )}
            </div>
              
            {hasActiveMeasurement && !isPanelOpen && !isLocationPickerActive && ( <button onClick={() => setIsPanelOpen(true)} className="md:hidden fixed bottom-6 right-6 z-30 p-4 bg-green-700 text-white rounded-full shadow-lg hover:bg-green-800 active:scale-95 transition-transform"> <Menu size={24} /> </button> )}

            {(!isLocationPickerActive || window.innerWidth >= 768) && (
              <div id="control-panel" className={` bg-gray-50 border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out md:static md:w-[35%] md:max-w-xl md:flex-shrink-0 md:translate-y-0 ${hasActiveMeasurement ? 'fixed z-20 inset-0' : 'w-full overflow-y-auto'} ${isPanelOpen || !hasActiveMeasurement ? 'translate-y-0' : 'translate-y-full'} `} >
                <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 md:hidden">
                    {hasActiveMeasurement ? ( <> <AuthComponent profile={userProfile} /> <button onClick={() => setIsPanelOpen(false)} className="p-2 text-gray-500 hover:text-gray-800"><X size={24} /></button> </> ) : ( <div className="w-full flex justify-between items-center"> <div className="flex items-center gap-3"><TreePine className="w-7 h-7 text-green-700" /><h1 className="text-xl font-semibold text-gray-900">Tree Measurement</h1></div> <AuthComponent profile={userProfile} /> </div> )}
                </div>

                <div className="flex-grow overflow-y-auto p-4 md:p-6">
                  <div className="hidden md:flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      {workbenchIcon}
                      <h1 className="text-2xl font-semibold text-gray-900">{workbenchTitle}</h1>
                    </div>
                    <AuthComponent profile={userProfile} />
                  </div>

                  <button onClick={handleReturnToModeSelect} className="text-sm text-blue-600 hover:underline mb-4">{'<'} Back to Mode Selection</button>
                  
                  <div className="p-4 rounded-lg mb-6 bg-slate-100 border border-slate-200"><h3 className="font-bold text-slate-800">Current Task</h3><div id="status-box" className="text-sm text-slate-600"><p>{instructionText}</p></div>{errorMessage && <p className="text-sm text-red-600 font-medium mt-1">{errorMessage}</p>}</div>
                  {isBusy && ( <div className="mb-6"><div className="progress-bar-container"><div className="progress-bar-animated"></div></div>{ <p className="text-xs text-center text-gray-500 animate-pulse mt-1">{isHistoryLoading ? 'Loading history...' : appStatus === 'SAVING' ? 'Saving...' : isCO2Calculating ? 'Calculating CO₂...' : 'Processing...'}</p>}</div> )}
                  
                  {appMode !== 'COMMUNITY_ANALYSIS' && <div className="space-y-6"> <div> <label className="block text-sm font-medium text-gray-700 mb-2">1. Select Photo</label> <input ref={fileInputRef} type="file" id="image-upload" accept="image/*" onChange={handleImageUpload} className="hidden" /> <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50"> <Upload className="w-5 h-5 text-gray-400" /> <span className="text-gray-600">{currentMeasurementFile ? 'Change Image' : 'Choose Image File'}</span> </button> </div> <div> <label htmlFor="distance-input" className="block text-sm font-medium text-gray-700 mb-2">2. Distance to Tree Base (meters)</label> <div className="relative"> <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /> <input type="number" id="distance-input" placeholder="e.g., 10.5" value={distance} onChange={(e) => setDistance(e.target.value)} disabled={appStatus !== 'IMAGE_LOADED'} className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 disabled:bg-gray-200" /> </div> <ARLinks /> </div> {appStatus === 'AWAITING_CALIBRATION_CHOICE' && (<div className="space-y-4 p-4 border-2 border-dashed border-blue-500 rounded-lg"><div className="flex items-center gap-2 text-blue-700"><Save className="w-5 h-5" /><h3 className="font-bold">Use Saved Calibration?</h3></div><button onClick={() => { setAppStatus('IMAGE_LOADED'); setIsPanelOpen(true); }} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Yes, Use Saved</button><button onClick={() => setAppStatus('CALIBRATION_AWAITING_INPUT')} className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700">No, Calibrate New</button></div>)} </div>}
                  
                  {appMode === 'QUICK_CAPTURE' && ( <div className="pt-6 mt-6 border-t"> <button onClick={handleQuickCaptureSubmit} disabled={appStatus !== 'IMAGE_LOADED' || !distance || isBusy} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300"> <Zap className="w-5 h-5" /> Submit for Analysis </button> </div> )}

                  {(appStatus === 'IMAGE_LOADED' || appStatus === 'COMMUNITY_ANALYSIS_ACTIVE') && (appMode === 'FULL_ANALYSIS' || appMode === 'COMMUNITY_ANALYSIS') && ( <div className="space-y-3 pt-6 border-t mt-6"> <button id="start-auto-btn" onClick={handleStartAutoMeasurement} disabled={isAutoDisabled} className="w-full text-left p-4 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:bg-gray-300 disabled:opacity-50 transition-all flex items-center gap-4"> <Zap className="w-6 h-6 flex-shrink-0" /> <div><p className="font-semibold">Automatic Measurement</p><p className="text-xs text-green-200">Slower, more precise</p></div> </button> <button id="start-manual-btn" onClick={handleStartManualMeasurement} disabled={isManualDisabled} className="w-full text-left p-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-300 transition-all flex items-center gap-4"> <Ruler className="w-6 h-6 flex-shrink-0" /> <div><p className="font-semibold">Manual Measurement</p><p className="text-xs text-amber-100">Faster, mark points yourself</p></div> </button> </div> )}

                  {appStatus === 'MANUAL_READY_TO_CALCULATE' && (
                    <div className="pt-6 mt-6 border-t">
                      <button 
                        onClick={handleCalculateManual} 
                        disabled={isBusy}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 disabled:bg-gray-300"
                      >
                        <Ruler className="w-5 h-5" />
                        Calculate Measurements
                      </button>
                    </div>
                  )}

                  {currentMetrics && (appStatus === 'AUTO_RESULT_SHOWN') && ( <div className="space-y-4"> <div> <h2 className="text-lg font-semibold text-gray-900">Current Measurements</h2> <div className="space-y-2 mt-2"> <div className="flex justify-between items-center p-3 bg-white rounded-lg border"><label className="font-medium text-gray-700">Height:</label><span className="font-mono text-lg text-gray-800">{currentMetrics?.height_m?.toFixed(2) ?? '--'} m</span></div> <div className="flex justify-between items-center p-3 bg-white rounded-lg border"><label className="font-medium text-gray-700">Canopy:</label><span className="font-mono text-lg text-gray-800">{currentMetrics?.canopy_m?.toFixed(2) ?? '--'} m</span></div> <div className="flex justify-between items-center p-3 bg-white rounded-lg border"><label className="font-medium text-gray-700">DBH:</label><span className="font-mono text-lg text-gray-800">{currentMetrics?.dbh_cm?.toFixed(2) ?? '--'} cm</span></div> </div> </div> {appMode === 'FULL_ANALYSIS' && appStatus === 'AUTO_RESULT_SHOWN' && <div className="grid grid-cols-2 gap-3 pt-4 border-t"> <button onClick={() => { setIsLocationPickerActive(false); setAppStatus('AWAITING_REFINE_POINTS'); setIsPanelOpen(false); setInstructionText("Click points to fix the tree's outline. The *first click* also sets the new height for the DBH measurement."); setShowInstructionToast(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Correct Outline</button> <button onClick={() => { if (currentMeasurementFile && scaleFactor) { setIsLocationPickerActive(false); setResultImageSrc(URL.createObjectURL(currentMeasurementFile)); setCurrentMetrics(null); setDbhLine(null); setRefinePoints([]); setAppStatus('MANUAL_AWAITING_BASE_CLICK'); setIsPanelOpen(false); setInstructionText("Manual Mode: Click the exact base of the tree trunk."); setShowInstructionToast(true); } }} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm">Manual Mode</button> </div>} <div className="space-y-4 border-t pt-4"> <SpeciesIdentifier onIdentificationComplete={setCurrentIdentification} onClear={() => setCurrentIdentification(null)} existingResult={currentIdentification} mainImageFile={currentMeasurementFile} mainImageSrc={originalImageSrc} /> <CO2ResultCard co2Value={currentCO2} isLoading={isCO2Calculating} /> {appMode === 'FULL_ANALYSIS' && <><button onClick={() => setIsLocationPickerActive(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"> <MapPin className="w-5 h-5 text-blue-600" /> {currentLocation ? `Location Set: ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'Add Location'} </button><AdditionalDetailsForm data={additionalData} onUpdate={(field, value) => setAdditionalData(prev => ({ ...prev, [field]: value }))} /></>} </div> <div className="grid grid-cols-2 gap-3 pt-4 border-t"> <button onClick={() => softReset(appMode)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"><RotateCcw className="w-4 h-4" />{appMode === 'COMMUNITY_ANALYSIS' ? 'Cancel & Exit' : 'Measure Another'}</button> {appMode === 'FULL_ANALYSIS' && <button onClick={handleSaveResult} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"><Plus className="w-5 h-5" />Save to History</button>} {appMode === 'COMMUNITY_ANALYSIS' && <button onClick={handleSubmitCommunityAnalysis} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"><GitMerge className="w-5 h-5" />Submit Analysis</button>}</div> </div> )}
                  
                  {appMode !== 'COMMUNITY_ANALYSIS' && <div className="border-t border-gray-200 mt-6 pt-6"> <ResultsTable results={allResults} onDeleteResult={handleDeleteResult} onEditResult={handleOpenEditModal} /> </div>}
                </div>
              </div>
            )}
          </>
      )}
    </div>
  );
}

export default App;