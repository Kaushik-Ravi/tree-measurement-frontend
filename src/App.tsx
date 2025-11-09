// src/App.tsx
import React, { useState, useRef, useEffect } from 'react';
// --- START: SURGICAL MODIFICATION (AR IMPORTS) ---
import { Upload, TreePine, Ruler, Zap, RotateCcw, Menu, Plus, MapPin, LogIn, LogOut, Navigation, ShieldCheck, Info, Check, Sun, Moon, Camera, Move, ArrowLeft, Users, BarChart2, GitMerge, Sparkles, ImageIcon } from 'lucide-react';
import { ARMeasureView } from './components/ARMeasureView';
// --- END: SURGICAL MODIFICATION (AR IMPORTS) ---
// --- START: LIVE AR INTEGRATION ---
import { LiveARMeasureView } from './components/live-ar/LiveARMeasureView_Enhanced';
import { FeatureFlags } from './config/featureFlags';
// --- END: LIVE AR INTEGRATION ---
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
import { PermissionsCheckModal } from './components/PermissionsCheckModal';

type AppView = 'HUB' | 'SESSION' | 'COMMUNITY_GROVE' | 'LEADERBOARD' | 'CALIBRATION';

type AppStatus = 
  'IDLE' | 
  'SESSION_AWAITING_PERMISSIONS' |
  'SESSION_AWAITING_PHOTO' | 
  'SESSION_PROCESSING_PHOTO' |
  'SESSION_AWAITING_DISTANCE' |
  'SESSION_AWAITING_CALIBRATION_CHOICE' |
  'SESSION_AWAITING_ANALYSIS_CHOICE' |
  'ANALYSIS_AWAITING_MODE_SELECTION' | 
  'ANALYSIS_AWAITING_INITIAL_CLICK' |
  'ANALYSIS_AWAITING_INITIAL_CLICK_CONFIRMATION' |
  'ANALYSIS_PROCESSING' |
  'ANALYSIS_SAVING' |
  'ANALYSIS_COMPLETE' |
  'ANALYSIS_AWAITING_REFINE_POINTS' |
  'ANALYSIS_MANUAL_AWAITING_BASE_CLICK' |
  'ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS' |
  'ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS' |
  'ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS' |
  'ANALYSIS_MANUAL_READY_TO_CALCULATE' |
  'COMMUNITY_GROVE_LOADING' |
  'ERROR';

type IdentificationData = Omit<IdentificationResponse, 'remainingIdentificationRequests'> | null;
type LocationData = { lat: number; lng: number } | null;

// Enhanced permission states for robust error handling
type SensorStatus = 
  | 'CHECKING'          // Initial validation in progress
  | 'PENDING'           // Ready to request (never asked)
  | 'REQUESTING'        // Permission dialog currently shown to user
  | 'GRANTED'           // Permission approved
  | 'DENIED'            // User clicked "Block" or "Don't Allow" this session
  | 'UNAVAILABLE'       // GPS hardware disabled or unavailable
  | 'TIMEOUT'           // Location request timed out
  | 'ERROR'             // Unknown error occurred
  | 'HTTPS_REQUIRED'    // Page not secure (http://)
  | 'NOT_REQUIRED'      // Feature not needed (e.g., compass on Android)
  | 'NOT_SUPPORTED';    // Browser doesn't support feature

type PrerequisiteStatus = {
  location: SensorStatus;
  compass: SensorStatus;
};
type UserProfile = { id: string; full_name: string; avatar_url: string; sapling_points: number; rank: string; } | null;

type Theme = 'light' | 'dark';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

const ThemeToggle = ({ theme, onToggle }: ThemeToggleProps) => (
  <button onClick={onToggle} className="p-2 text-content-subtle bg-background-subtle rounded-lg hover:bg-background-inset" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
  </button>
);

interface FloatingInteractionControlsProps {
  onUndo: () => void;
  onConfirm: () => void;
  showConfirm: boolean;
  undoDisabled: boolean;
  confirmDisabled: boolean;
}

const FloatingInteractionControls = ({ onUndo, onConfirm, showConfirm, undoDisabled, confirmDisabled }: FloatingInteractionControlsProps) => {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-background-subtle/90 text-content-default p-2 rounded-xl shadow-lg backdrop-blur-sm border border-stroke-default">
      <button onClick={onUndo} disabled={undoDisabled} className="p-3 rounded-lg hover:bg-background-inset disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        <RotateCcw size={20} />
      </button>
      {showConfirm && (
        <>
          <div className="w-px h-6 bg-stroke-default" />
          <button onClick={onConfirm} disabled={confirmDisabled} className="p-3 rounded-lg bg-status-success text-white hover:opacity-90 disabled:bg-content-subtle disabled:cursor-not-allowed transition-colors">
            <Check size={20} />
          </button>
        </>
      )}
    </div>
  );
};


const isManualMode = (status: AppStatus) => status.startsWith('ANALYSIS_MANUAL_');
const CAMERA_FOV_RATIO_KEY = 'treeMeasurementFovRatio';
const ARLinks = () => ( <p className="text-xs text-content-subtle mt-1 pl-1">Need help measuring? Try an AR app: <a href="https://play.google.com/store/apps/details?id=com.grymala.aruler&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-secondary hover:underline">Android</a>{' / '}<a href="https://apps.apple.com/us/app/ar-ruler-digital-tape-measure/id1326773975?platform=iphone" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-secondary hover:underline">iOS</a></p> );

const initialAdditionalData: AdditionalData = { condition: '', ownership: '', remarks: '' };

const AuthComponent = ({ profile, theme, onThemeToggle }: { profile: UserProfile, theme: Theme, onThemeToggle: () => void }) => {
  const { user, signInWithGoogle, signOut } = useAuth();

  if (user && profile) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-brand-primary">{profile.sapling_points} SP</p>
            <p className="text-xs text-content-subtle -mt-1">{profile.rank}</p>
        </div>
        <img src={user.user_metadata.avatar_url} alt="User avatar" className="w-8 h-8 rounded-full border-2 border-stroke-subtle" />
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        <button onClick={signOut} className="p-2 text-content-subtle bg-background-subtle rounded-lg hover:bg-background-inset flex items-center gap-2" title="Sign Out">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (user && !profile) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-background-inset animate-pulse" />
      </div>
    )
  }

  return (
     <div className="flex items-center gap-3">
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        <button onClick={signInWithGoogle} className="flex items-center gap-2 px-4 py-2 bg-background-default border border-stroke-default rounded-lg text-sm font-medium text-content-default hover:bg-background-subtle">
          <LogIn className="w-4 h-4" />
          Sign In
        </button>
    </div>
  );
};

function App() {
  const { user, session } = useAuth();
  
  const [currentView, setCurrentView] = useState<AppView>('HUB');
  const [appStatus, setAppStatus] = useState<AppStatus>('IDLE');

  const [instructionText, setInstructionText] = useState("Welcome! Click 'Start Mapping a Tree' to begin.");
  const [errorMessage, setErrorMessage] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showInstructionToast, setShowInstructionToast] = useState(false);
  
  const [fovRatio, setFovRatio] = useState<number | null>(null);

  const [theme, setTheme] = useState<Theme>(() => {
    if (localStorage.getItem('theme') === 'light') {
      return 'light';
    }
    return 'dark';
  });
  
  // --- START: SURGICAL REPLACEMENT (SIMPLIFIED AR STATE) ---
  const [isArModeActive, setIsArModeActive] = useState(false);
  const [isLiveARModeActive, setIsLiveARModeActive] = useState(false); // Live AR mode
  // --- END: SURGICAL REPLACEMENT (SIMPLIFIED AR STATE) ---

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const handleThemeToggle = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

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
  const [maskGenerated, setMaskGenerated] = useState<boolean>(false);

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

  useEffect(() => {
    // CRITICAL FIX: Don't listen to device orientation when AR mode is active
    // This prevents conflict between WebXR camera and DeviceOrientationEvent
    // which caused flickering and sensor access issues
    if (currentView !== 'SESSION' || isArModeActive || isLiveARModeActive) return;
    
    const handleLiveOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setDeviceHeading(event.alpha);
        if (prereqStatus.compass !== 'GRANTED') {
            setPrereqStatus(prev => ({ ...prev, compass: 'GRANTED' }));
        }
      }
    };
    window.addEventListener('deviceorientation', handleLiveOrientation, true);
    
    return () => {
      window.removeEventListener('deviceorientation', handleLiveOrientation, true);
    };
  }, [prereqStatus.compass, currentView, isArModeActive, isLiveARModeActive]);

  const handleReturnToHub = () => {
    softReset();
  };
  
  useEffect(() => {
    const handleBrowserBack = (event: PopStateEvent) => {
      if (currentView !== 'HUB') {
        event.preventDefault();
        handleReturnToHub();
      }
    };
    window.addEventListener('popstate', handleBrowserBack);
    return () => window.removeEventListener('popstate', handleBrowserBack);
  }, [currentView]);

  useEffect(() => {
      if (currentView !== 'HUB' && window.history.state?.view !== currentView) {
          window.history.pushState({ view: currentView }, '');
      }
  }, [currentView]);


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

  // --- PHASE: 3-TIER CALIBRATION INTEGRATION FOR PHOTO METHOD ---
  useEffect(() => {
    if (appStatus !== 'SESSION_PROCESSING_PHOTO' || !currentMeasurementFile) return;
    
    const processImage = async () => {
      console.log('[Photo Calibration] 🎯 Starting 3-tier calibration workflow');
      setInstructionText("Analyzing image metadata...");
      
      try {
        const tempImage = new Image();
        const objectURL = URL.createObjectURL(currentMeasurementFile);
        tempImage.src = objectURL;

        tempImage.onload = async () => {
          setImageDimensions({ w: tempImage.naturalWidth, h: tempImage.naturalHeight });
          console.log('[Photo Calibration] Image dimensions:', tempImage.naturalWidth, 'x', tempImage.naturalHeight);
          
          // --- TIER 1: EXIF EXTRACTION (Best Accuracy) ---
          console.log('[Photo Calibration Tier 1] 📸 Attempting EXIF extraction...');
          const tags = await ExifReader.load(currentMeasurementFile);
          
          let focalLengthValue: number | null = null;
          const focalLengthIn35mm = tags['FocalLengthIn35mmFilm']?.value;
          const rawFocalLength = tags['FocalLength']?.value;
          const scaleFactor35 = tags['ScaleFactor35efl']?.value;
          
          if (typeof focalLengthIn35mm === 'number') {
            focalLengthValue = focalLengthIn35mm;
            console.log('[Photo Calibration Tier 1] ✅ SUCCESS - FocalLengthIn35mmFilm:', focalLengthValue, 'mm');
          } else if (typeof rawFocalLength === 'number' && typeof scaleFactor35 === 'number') {
            focalLengthValue = rawFocalLength * scaleFactor35;
            console.log('[Photo Calibration Tier 1] ✅ SUCCESS - Calculated from raw focal length:', focalLengthValue, 'mm');
          } else {
            console.log('[Photo Calibration Tier 1] ⚠️ FAILED - No EXIF focal length data found');
            console.log('[Photo Calibration Tier 1] Available tags:', Object.keys(tags).join(', '));
          }

          setOriginalImageSrc(objectURL);
          setResultImageSrc(objectURL);
          
          if (typeof focalLengthValue === 'number') {
            // Tier 1 SUCCESS - Use EXIF data
            setFocalLength(focalLengthValue);
            console.log('[Photo Calibration] 🎉 Tier 1 calibration complete - focal length:', focalLengthValue, 'mm');
            console.log('[Photo Calibration] Proceeding to distance entry...');
            setAppStatus('SESSION_AWAITING_DISTANCE'); 
            setInstructionText("Great! Now, please enter the distance to the tree's base.");
          } else {
            // Tier 1 FAILED - Check for existing calibration or proceed to manual
            console.log('[Photo Calibration] ⚠️ Tier 1 failed, checking for saved calibration...');
            
            // Import calibration utilities dynamically
            const { loadSavedCalibration } = await import('./utils/cameraCalibration');
            const savedCalibration = loadSavedCalibration();
            
            if (savedCalibration && (savedCalibration.focalLength35mm || savedCalibration.fovHorizontal)) {
              // Saved calibration found
              console.log('[Photo Calibration] ✅ Found saved calibration:', savedCalibration.calibrationMethod);
              console.log('[Photo Calibration] Data:', {
                focalLength35mm: savedCalibration.focalLength35mm,
                fovHorizontal: savedCalibration.fovHorizontal,
                timestamp: new Date(savedCalibration.timestamp).toLocaleString()
              });
              
              // Set focal length from saved calibration
              if (savedCalibration.focalLength35mm) {
                setFocalLength(savedCalibration.focalLength35mm);
                console.log('[Photo Calibration] Using saved focal length:', savedCalibration.focalLength35mm, 'mm');
              } else if (savedCalibration.fovHorizontal) {
                // Calculate fovRatio from saved FOV
                const fovRadians = (savedCalibration.fovHorizontal * Math.PI) / 180;
                const calculatedFovRatio = Math.tan(fovRadians / 2);
                setFovRatio(calculatedFovRatio);
                console.log('[Photo Calibration] Using saved FOV ratio:', calculatedFovRatio);
              }
              
              setPendingTreeFile(currentMeasurementFile);
              setAppStatus('SESSION_AWAITING_CALIBRATION_CHOICE');
              setInstructionText("No camera data in photo. Use your saved calibration or create a new one.");
            } else {
              // No saved calibration - go to manual calibration
              console.log('[Photo Calibration] ⚠️ No saved calibration found');
              console.log('[Photo Calibration] Tier 2 will be attempted during distance entry (if camera stream available)');
              console.log('[Photo Calibration] Redirecting to manual calibration view...');
              
              setPendingTreeFile(currentMeasurementFile);
              setCurrentView('CALIBRATION');
              setInstructionText("No camera calibration found. Please calibrate your camera for accurate measurements.");
            }
          }
        };
      } catch (error: any) {
        console.error('[Photo Calibration] ❌ ERROR during image processing:', error);
        setAppStatus('ERROR'); 
        setErrorMessage(error.message); 
        if (currentMeasurementFile) { 
          const objURL = URL.createObjectURL(currentMeasurementFile); 
          setOriginalImageSrc(objURL); 
          setResultImageSrc(objURL); 
        }
      }
    };
    
    processImage();
  }, [currentMeasurementFile, appStatus, fovRatio]);

  // --- TIER 2 CALIBRATION: AUTO-CALIBRATE FROM CAMERA STREAM (Photo Method Integration) ---
  useEffect(() => {
    // Only attempt Tier 2 if we're waiting for distance and don't have calibration yet
    if (appStatus !== 'SESSION_AWAITING_DISTANCE') return;
    if (focalLength || fovRatio) {
      console.log('[Photo Calibration Tier 2] ⏭️ SKIPPED - Calibration already available');
      return;
    }
    
    let isMounted = true;
    let stream: MediaStream | null = null;
    
    const attemptTier2Calibration = async () => {
      console.log('[Photo Calibration Tier 2] 🎥 Attempting camera stream calibration...');
      
      try {
        // Request camera access (for calibration purposes)
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        
        if (!isMounted) {
          console.log('[Photo Calibration Tier 2] Component unmounted, aborting');
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        console.log('[Photo Calibration Tier 2] 📹 Camera stream acquired, extracting calibration...');
        
        // Import calibration utility
        const { extractCameraIntrinsicsFromStream, saveCalibration } = await import('./utils/cameraCalibration');
        const streamCalibration = await extractCameraIntrinsicsFromStream(stream);
        
        // Stop stream immediately after extraction
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        
        if (!isMounted) return;
        
        if (streamCalibration && (streamCalibration.focalLength35mm || streamCalibration.fovHorizontal)) {
          console.log('[Photo Calibration Tier 2] ✅ SUCCESS - Method:', streamCalibration.calibrationMethod);
          console.log('[Photo Calibration Tier 2] Data:', {
            focalLength35mm: streamCalibration.focalLength35mm,
            fovHorizontal: streamCalibration.fovHorizontal
          });
          
          // Create complete calibration object
          const fullCalibration = {
            focalLength35mm: null,
            fovHorizontal: null,
            fovVertical: null,
            sensorWidth: null,
            sensorHeight: null,
            imageWidth: 1920,
            imageHeight: 1080,
            calibrationMethod: 'none' as const,
            deviceId: '',
            timestamp: Date.now(),
            ...streamCalibration
          };
          
          // Save to localStorage for future use
          saveCalibration(fullCalibration);
          console.log('[Photo Calibration Tier 2] 💾 Saved to localStorage for future sessions');
          
          // Apply to current session
          if (fullCalibration.focalLength35mm) {
            setFocalLength(fullCalibration.focalLength35mm);
            console.log('[Photo Calibration Tier 2] 🎯 Applied focal length:', fullCalibration.focalLength35mm, 'mm');
          } else if (fullCalibration.fovHorizontal) {
            const fovRadians = (fullCalibration.fovHorizontal * Math.PI) / 180;
            const calculatedFovRatio = Math.tan(fovRadians / 2);
            setFovRatio(calculatedFovRatio);
            console.log('[Photo Calibration Tier 2] 🎯 Applied FOV ratio:', calculatedFovRatio);
          }
          
          setInstructionText("Camera auto-calibrated! Enter distance to continue.");
        } else {
          console.log('[Photo Calibration Tier 2] ⚠️ FAILED - Insufficient data from camera stream');
          console.log('[Photo Calibration Tier 2] User will need to use manual calibration (Tier 3) if needed');
        }
      } catch (error: any) {
        if (!isMounted) return;
        
        console.log('[Photo Calibration Tier 2] ⚠️ FAILED - Error:', error.message);
        
        if (error.name === 'NotAllowedError') {
          console.log('[Photo Calibration Tier 2] Camera permission denied - user can still enter distance manually');
        } else if (error.name === 'NotFoundError') {
          console.log('[Photo Calibration Tier 2] No camera found - user can still enter distance manually');
        } else {
          console.error('[Photo Calibration Tier 2] Unexpected error:', error);
        }
        
        // Non-fatal - user can still enter distance manually
        // Manual calibration (Tier 3) remains available via calibration button
      } finally {
        // Ensure stream is stopped
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    };
    
    // Attempt Tier 2 calibration after a short delay (allow UI to settle)
    const timeout = setTimeout(() => {
      if (isMounted) {
        attemptTier2Calibration();
      }
    }, 500);
    
    // Cleanup on unmount
    return () => {
      isMounted = false;
      clearTimeout(timeout);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [appStatus, focalLength, fovRatio]);

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
      if (dbhGuideRect && imageDimensions) { const p = scaleCoords({x: dbhGuideRect.x, y: dbhGuideRect.y}); const rectHeight = (dbhGuideRect.height / imageDimensions.h) * canvas.height; const lineY = p.y + rectHeight / 2; ctx.beginPath(); ctx.setLineDash([10, 10]); ctx.moveTo(0, lineY); ctx.lineTo(canvas.width, lineY); ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]); }
      refinePoints.forEach(p => drawPoint(p, '#EF4444')); Object.values(manualPoints).flat().forEach(p => drawPoint(p, '#F97316')); if (transientPoint) drawPoint(transientPoint, '#3B82F6');
    };
  }, [resultImageSrc, dbhLine, dbhGuideRect, refinePoints, manualPoints, transientPoint, imageDimensions, isLocationPickerActive]);
  
  const handleStartSession = () => {
    setCurrentView('SESSION');
    setAppStatus('SESSION_AWAITING_PERMISSIONS');
    setInstructionText("Checking device permissions...");
    setIsPanelOpen(true);
    
    // Reset to CHECKING state for fresh session validation
    setPrereqStatus({ location: 'CHECKING', compass: 'CHECKING' });
    
    // Perform pre-check before showing permission modal
    checkPermissionsBeforeModal();
  };

  const checkPermissionsBeforeModal = async () => {
    // 1. Check if Geolocation API exists (browser support)
    if (!('geolocation' in navigator)) {
      setPrereqStatus({ location: 'NOT_SUPPORTED', compass: 'NOT_SUPPORTED' });
      setErrorMessage('Your browser does not support location services. Please use a modern browser like Chrome, Safari, or Firefox.');
      setInstructionText('Browser compatibility issue detected.');
      return;
    }

    // 2. Check if page is served over HTTPS (required for geolocation)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setPrereqStatus({ location: 'HTTPS_REQUIRED', compass: 'HTTPS_REQUIRED' });
      setErrorMessage('Location access requires a secure HTTPS connection.');
      setInstructionText('Please access this site using https://');
      return;
    }

    // 3. Attempt silent permission check (validates if already granted from browser)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // ✅ Permission already granted - set location immediately
        const userLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserGeoLocation(userLoc);
        setCurrentLocation(userLoc);
        setPrereqStatus(prev => ({ ...prev, location: 'GRANTED' }));
        setInstructionText('Location access granted. Please grant compass permission (iOS only).');
        
        // Check compass status
        checkCompassStatus();
      },
      (error) => {
        // Permission not yet granted or denied - determine state
        if (error.code === 1) {
          // PERMISSION_DENIED - User previously blocked
          setPrereqStatus(prev => ({ ...prev, location: 'DENIED' }));
          setInstructionText('Location access was denied. Please follow the instructions below to enable it.');
        } else if (error.code === 2) {
          // POSITION_UNAVAILABLE - GPS disabled
          setPrereqStatus(prev => ({ ...prev, location: 'UNAVAILABLE' }));
          setInstructionText('GPS is unavailable. Please enable location services in your device settings.');
        } else if (error.code === 3) {
          // TIMEOUT
          setPrereqStatus(prev => ({ ...prev, location: 'TIMEOUT' }));
          setInstructionText('Location request timed out. Please check your GPS signal.');
        } else {
          // Unknown error
          setPrereqStatus(prev => ({ ...prev, location: 'PENDING' }));
          setInstructionText('Ready to request location permission. Tap "Grant Permissions" below.');
        }
        
        // Check compass status
        checkCompassStatus();
      },
      { 
        enableHighAccuracy: true, 
        timeout: 5000,        // Quick 5-second check
        maximumAge: 60000     // Accept cached location up to 1 minute old (session-level)
      }
    );
  };

  const checkCompassStatus = () => {
    // @ts-ignore - Check if DeviceOrientationEvent permission is required (iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      setPrereqStatus(prev => ({ ...prev, compass: 'PENDING' }));
    } else {
      // Non-iOS or older iOS: Compass not required
      setPrereqStatus(prev => ({ ...prev, compass: 'NOT_REQUIRED' }));
    }
  };

  const handleRequestPermissions = async () => {
    // Set REQUESTING state to show loading indicator
    setPrereqStatus(prev => ({ ...prev, location: 'REQUESTING' }));
    setInstructionText("Waiting for your response to the location permission prompt...");
    
    // 1. LOCATION: Trigger native Geolocation API prompt
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve, 
          reject, 
          {
            enableHighAccuracy: true,
            timeout: 10000,      // 10 second timeout
            maximumAge: 0        // Force fresh location (no cache)
          }
        );
      });
      
      // ✅ SUCCESS: Permission granted + coordinates received
      const userLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
      setUserGeoLocation(userLoc);
      setCurrentLocation(userLoc);
      setPrereqStatus(prev => ({ ...prev, location: 'GRANTED' }));
      setInstructionText("Location access granted! Now requesting compass permission (iOS only)...");
      
    } catch (error: any) {
      // ❌ FAILED: Determine exact failure reason using GeolocationPositionError codes
      console.error('Geolocation error:', error);
      
      if (error.code === 1) { 
        // PERMISSION_DENIED - User clicked "Block" or "Don't Allow"
        setPrereqStatus(prev => ({ ...prev, location: 'DENIED' }));
        setInstructionText("Location access denied. Please follow the instructions below to enable it.");
      } else if (error.code === 2) { 
        // POSITION_UNAVAILABLE - GPS hardware issue or location services off
        setPrereqStatus(prev => ({ ...prev, location: 'UNAVAILABLE' }));
        setInstructionText("GPS is unavailable. Please enable location services in your device settings.");
        setErrorMessage("Your device's location services are turned off. Enable them in system settings to continue.");
      } else if (error.code === 3) { 
        // TIMEOUT - Took too long to get location
        setPrereqStatus(prev => ({ ...prev, location: 'TIMEOUT' }));
        setInstructionText("Location request timed out. Retrying automatically...");
        setErrorMessage("Could not get your location within 10 seconds. Retrying with a longer timeout...");
        
        // AUTO-RETRY: Try again with extended timeout and lower accuracy requirement
        setTimeout(async () => {
          try {
            const retryPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                  enableHighAccuracy: false, // Lower accuracy for faster response
                  timeout: 20000,            // Extended 20 second timeout
                  maximumAge: 120000         // Accept cached location up to 2 minutes old
                }
              );
            });
            
            // ✅ RETRY SUCCESS
            const userLoc = { lat: retryPosition.coords.latitude, lng: retryPosition.coords.longitude };
            setUserGeoLocation(userLoc);
            setCurrentLocation(userLoc);
            setPrereqStatus(prev => ({ ...prev, location: 'GRANTED' }));
            setInstructionText("Location access granted after retry!");
            setErrorMessage('');
          } catch (retryError: any) {
            // ❌ RETRY FAILED - Show manual retry option
            if (retryError.code === 3) {
              setPrereqStatus(prev => ({ ...prev, location: 'TIMEOUT' }));
              setInstructionText("Location still timing out. Please check your GPS signal or try manual entry.");
              setErrorMessage("Unable to get location. Make sure you're outdoors with clear sky view, or use manual coordinate entry.");
            } else {
              // Handle other errors from retry
              setPrereqStatus(prev => ({ ...prev, location: 'ERROR' }));
              setInstructionText("Could not get location after retry. Please try again manually.");
            }
          }
        }, 2000); // Wait 2 seconds before retry
      } else {
        // Unknown error
        setPrereqStatus(prev => ({ ...prev, location: 'ERROR' }));
        setInstructionText("An unexpected error occurred. Please try again.");
        setErrorMessage(`Location error: ${error.message || 'Unknown error'}`);
      }
    }

    // 2. COMPASS (iOS only): Trigger DeviceOrientationEvent permission
    // @ts-ignore
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        // @ts-ignore
        const permissionState = await DeviceOrientationEvent.requestPermission();
        
        if (permissionState === 'granted') {
          setPrereqStatus(prev => ({ ...prev, compass: 'GRANTED' }));
          setInstructionText("All permissions granted! You can now continue.");
          setErrorMessage(''); // Clear any error messages
        } else {
          setPrereqStatus(prev => ({ ...prev, compass: 'DENIED' }));
          setInstructionText("Compass access denied. This may affect location accuracy.");
        }
      } catch (err) {
        console.error('Compass permission error:', err);
        setPrereqStatus(prev => ({ ...prev, compass: 'DENIED' }));
        setInstructionText("Could not request compass permission. This may affect location accuracy.");
      }
    } else {
      // Non-iOS device - compass permission not required
      console.log('DeviceOrientationEvent.requestPermission not available (non-iOS device or older iOS version)');
      setPrereqStatus(prev => ({ ...prev, compass: 'NOT_REQUIRED' }));
      
      // If location was granted, user can continue
      if (prereqStatus.location === 'GRANTED') {
        setInstructionText("Location access granted! You can now continue.");
        setErrorMessage('');
      }
    }
  };
  
  const handlePermissionsConfirmed = () => {
    if (prereqStatus.location === 'GRANTED') {
      setAppStatus('SESSION_AWAITING_PHOTO');
      setInstructionText("Let's start with a photo of the tree.");
    }
  };


  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => { 
    const file = event.target.files?.[0]; 
    if (!file) return;

    setCapturedHeading(deviceHeading); 

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
      setInstructionText("Measurement complete. Review the results below and identify the species to save."); 
  };
  
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
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

    if (appStatus === 'ANALYSIS_AWAITING_INITIAL_CLICK') {
        setTransientPoint(clickPoint);
        setAppStatus('ANALYSIS_AWAITING_INITIAL_CLICK_CONFIRMATION');
        setInstructionText("Confirm the point on the trunk, or undo to select again.");
        setIsPanelOpen(false);
        setShowInstructionToast(true);
    } else if (appStatus === 'ANALYSIS_AWAITING_REFINE_POINTS') { 
        setRefinePoints(prev => [...prev, clickPoint]);
    } else if (isManualMode(appStatus)) { 
        handleManualPointCollection(clickPoint); 
    }
  };

  const handleConfirmInitialClick = async () => {
    if (!transientPoint || !scaleFactor || !session?.access_token) return;
    
    console.log('[SAM Measurement] 🎯 Starting automatic tree segmentation...');
    console.log('[SAM Measurement] Input parameters:', {
      clickPoint: transientPoint,
      scaleFactor: scaleFactor,
      distance: parseFloat(distance),
      view: currentView
    });
    
    setIsPanelOpen(true); 
    setInstructionText("Running automatic segmentation..."); 
    setAppStatus('ANALYSIS_PROCESSING'); 

    try {
        let response;
        if (currentView === 'SESSION' && currentMeasurementFile) {
            console.log('[SAM Measurement] Mode: Photo upload');
            console.log('[SAM Measurement] Sending to backend:', {
              file: currentMeasurementFile.name,
              distance: parseFloat(distance),
              scaleFactor: scaleFactor,
              clickPoint: transientPoint
            });
            response = await samAutoSegment(currentMeasurementFile, parseFloat(distance), scaleFactor, transientPoint);
        } else if (currentView === 'COMMUNITY_GROVE' && claimedTree) {
            console.log('[SAM Measurement] Mode: Community Grove');
            console.log('[SAM Measurement] Sending to backend:', {
              imageUrl: claimedTree.image_url,
              distance: claimedTree.distance_m,
              scaleFactor: scaleFactor,
              clickPoint: transientPoint
            });
            response = await samAutoSegmentFromUrl(claimedTree.image_url!, claimedTree.distance_m!, scaleFactor, transientPoint, session.access_token);
        } else {
            throw new Error("Invalid state for auto-segmentation.");
        }

        if (response.status !== 'success') throw new Error(response.message);
        
        console.log('[SAM Measurement] ✅ Segmentation complete!');
        console.log('[SAM Measurement] Results:', {
          height: response.metrics.height_m,
          canopy: response.metrics.canopy_m,
          dbh: response.metrics.dbh_cm,
          scaleFactor: response.scale_factor,
          performance: response.performance
        });
        
        setMaskGenerated(true);
        setScaleFactor(response.scale_factor); 
        setDbhLine(response.dbh_line_coords);
        setResultImageSrc(`data:image/png;base64,${response.result_image_base64}`);
        handleMeasurementSuccess(response.metrics);
    } catch (error: any) { 
        console.error('[SAM Measurement] ❌ Segmentation failed:', error);
        setAppStatus('ERROR'); 
        setErrorMessage(error.message); 
    } finally { 
        setTransientPoint(null); 
    }
  };
  
  const onCalibrationComplete = (newFovRatio: number) => {
    setFovRatio(newFovRatio);
    localStorage.setItem(CAMERA_FOV_RATIO_KEY, newFovRatio.toString());
    setCurrentView('SESSION');

    if (pendingTreeFile) {
      setCurrentMeasurementFile(pendingTreeFile);
      setAppStatus('SESSION_PROCESSING_PHOTO');
    } else {
      setAppStatus('SESSION_AWAITING_PHOTO');
      setInstructionText("Calibration complete! Please re-select your photo to begin.");
    }
  };

  const prepareMeasurementSession = (): number | null => {
    console.log('[Scale Factor] 📐 Calculating scale factor for measurement session...');
    
    const distForCalc = currentView === 'COMMUNITY_GROVE' ? claimedTree?.distance_m : parseFloat(distance);
    const dims = imageDimensions;
    
    console.log('[Scale Factor] Input data:', {
      distance: distForCalc,
      imageDimensions: dims,
      view: currentView
    });
    
    if (!distForCalc || !dims) {
        console.error('[Scale Factor] ❌ Missing required data:', {
          distance: distForCalc,
          dimensions: dims
        });
        setErrorMessage("Missing distance or image dimensions.");
        return null;
    }

    let cameraConstant: number | null = null;
    let calibrationSource: string = 'none';

    // Priority 1: Focal length (from EXIF or Tier 2)
    if (focalLength) {
        cameraConstant = 36.0 / focalLength;
        calibrationSource = 'focal_length_35mm';
        console.log('[Scale Factor] ✅ Using focal length calibration');
        console.log('[Scale Factor] Focal length:', focalLength, 'mm (35mm equivalent)');
        console.log('[Scale Factor] Camera constant:', cameraConstant);
    } 
    // Priority 2: FOV ratio (from saved calibration or Tier 2)
    else if (fovRatio) {
        cameraConstant = fovRatio;
        calibrationSource = 'fov_ratio';
        console.log('[Scale Factor] ✅ Using FOV ratio calibration');
        console.log('[Scale Factor] FOV ratio:', fovRatio);
    } 
    // Priority 3: Community Grove existing calibration
    else if (currentView === 'COMMUNITY_GROVE' && claimedTree?.scale_factor && claimedTree?.distance_m) {
        const horizontalPixels = Math.max(dims.w, dims.h);
        cameraConstant = (claimedTree.scale_factor * horizontalPixels) / (claimedTree.distance_m * 1000);
        calibrationSource = 'community_grove_reverse';
        console.log('[Scale Factor] ✅ Using Community Grove calibration (reverse-calculated)');
        console.log('[Scale Factor] Previous scale factor:', claimedTree.scale_factor);
        console.log('[Scale Factor] Camera constant (calculated):', cameraConstant);
    } 
    // No calibration available
    else {
        console.error('[Scale Factor] ❌ No calibration available!');
        console.log('[Scale Factor] Redirecting to manual calibration view...');
        setCurrentView('CALIBRATION');
        return null;
    }

    // Calculate scale factor using the standard formula
    const distMM = distForCalc * 1000;
    const horizontalPixels = Math.max(dims.w, dims.h);
    const finalScaleFactor = (distMM * cameraConstant) / horizontalPixels;
    
    console.log('[Scale Factor] ✅ CALCULATION COMPLETE:');
    console.log('[Scale Factor] =====================================');
    console.log('[Scale Factor] Calibration source:', calibrationSource);
    console.log('[Scale Factor] Distance (m):', distForCalc);
    console.log('[Scale Factor] Distance (mm):', distMM);
    console.log('[Scale Factor] Camera constant:', cameraConstant);
    console.log('[Scale Factor] Horizontal pixels:', horizontalPixels);
    console.log('[Scale Factor] Image dimensions:', dims.w, 'x', dims.h);
    console.log('[Scale Factor] FINAL SCALE FACTOR:', finalScaleFactor, 'mm/pixel');
    console.log('[Scale Factor] =====================================');
    console.log('[Scale Factor] Expected measurements for reference:');
    console.log('[Scale Factor]   - 10cm diameter ≈', (100 / finalScaleFactor).toFixed(0), 'pixels');
    console.log('[Scale Factor]   - 30cm diameter ≈', (300 / finalScaleFactor).toFixed(0), 'pixels');
    console.log('[Scale Factor]   - 50cm diameter ≈', (500 / finalScaleFactor).toFixed(0), 'pixels');
    console.log('[Scale Factor] =====================================');
    
    setScaleFactor(finalScaleFactor);
    return finalScaleFactor;
  };
  
  const handleStartAutoMeasurement = () => { if (prepareMeasurementSession()) { setAppStatus('ANALYSIS_AWAITING_INITIAL_CLICK'); setIsPanelOpen(false); setInstructionText("Tap the main trunk of the tree to begin."); setShowInstructionToast(true); } };
  
  const handleStartManualMeasurement = () => { 
      const imageToUse = currentView === 'COMMUNITY_GROVE' ? claimedTree?.image_url : originalImageSrc;
      if (prepareMeasurementSession() && imageToUse) { 
          setMaskGenerated(false);
          setResultImageSrc(imageToUse); setCurrentMetrics(null); setDbhLine(null); setRefinePoints([]); 
          setAppStatus('ANALYSIS_MANUAL_AWAITING_BASE_CLICK'); setIsPanelOpen(false); setInstructionText("Manual Mode: Click the exact base of the tree trunk."); setShowInstructionToast(true); 
      } 
  };

  const handleApplyRefinements = async () => {
    if (refinePoints.length === 0 || !currentMeasurementFile) return;
    
    try {
      setAppStatus('ANALYSIS_PROCESSING');
      setIsPanelOpen(true);
      setInstructionText(`Re-running segmentation...`);
      
      const response = await samRefineWithPoints(currentMeasurementFile, refinePoints, scaleFactor!);
      
      if (response.status !== 'success') throw new Error(response.message);
      
      setDbhLine(response.dbh_line_coords);
      setRefinePoints([]);
      setResultImageSrc(`data:image/png;base64,${response.result_image_base64}`);
      handleMeasurementSuccess(response.metrics);
    } catch(error: any) {
      setAppStatus('ERROR');
      setErrorMessage(error.message);
    }
  };
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
      softReset();

    } catch (error: any) {
      setErrorMessage(`Failed to save result: ${error.message}`);
      setAppStatus('ANALYSIS_COMPLETE');
      setInstructionText("An error occurred. Please try saving again.");
    }
  };

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
      softReset();

    } catch (error: any) {
      setErrorMessage(`Submission failed: ${error.message}`);
      setAppStatus('ERROR');
    }
  };

  const handleNavigateToGrove = async () => {
    if (!session?.access_token) return;
    setCurrentView('COMMUNITY_GROVE');
    setAppStatus('COMMUNITY_GROVE_LOADING'); 
    setInstructionText("Fetching pending saplings from the Community Grove...");
    try {
      const trees = await getPendingTrees(session.access_token);
      setPendingTrees(trees);
      setAppStatus('IDLE');
    } catch(e: any) {
      setErrorMessage(`Failed to load grove: ${e.message}`);
      setAppStatus('ERROR');
    }
  };

  const handleClaimTree = async (treeId: string) => {
    if (!session?.access_token) return;
    setAppStatus('ANALYSIS_PROCESSING'); 
    try {
      const res = await claimTree(treeId, session.access_token);
      const claimedData = res.data;

      if (!claimedData || claimedData.distance_m == null || claimedData.scale_factor == null) {
        throw new Error("Failed to claim tree: The record is missing essential measurement data.");
      }
      
      setClaimedTree(claimedData);

      const response = await fetch(claimedData.image_url);
      const blob = await response.blob();
      const fileName = claimedData.image_url.split('/').pop() || 'claimed-tree.jpg';
      const file = new File([blob], fileName, { type: blob.type });
      setCurrentMeasurementFile(file);
      setAdditionalData(initialAdditionalData); 

      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = claimedData.image_url;
      img.onload = () => {
        setImageDimensions({w: img.naturalWidth, h: img.naturalHeight});
        setOriginalImageSrc(claimedData.image_url);
        setResultImageSrc(claimedData.image_url);
        setCurrentLocation(claimedData.latitude && claimedData.longitude ? {lat: claimedData.latitude, lng: claimedData.longitude} : null);
        setDistance(claimedData.distance_m ? String(claimedData.distance_m) : '');

        setAppStatus('ANALYSIS_AWAITING_MODE_SELECTION');
        setIsPanelOpen(true);
        setInstructionText(`Tree claimed. You have 10 minutes to analyze. Start by selecting a measurement mode below.`);
      };
      img.onerror = () => { throw new Error("Could not load tree image."); }
    } catch(e: any) {
      setErrorMessage(e.message);
      handleReturnToHub();
    }
  };

  const handleSubmitCommunityAnalysis = async () => {
    if (!claimedTree || !currentMetrics || !session?.access_token) return;
    setAppStatus('ANALYSIS_SAVING');
    try {
      const payload: CommunityAnalysisPayload = {
        metrics: currentMetrics,
        species: currentIdentification?.bestMatch,
        ...additionalData,
      };
      await submitCommunityAnalysis(claimedTree.id, payload, session.access_token);
      softReset();
    } catch(e: any) {
      setErrorMessage(e.message);
      setAppStatus('ANALYSIS_COMPLETE');
    }
  };


  const softReset = () => {
    setCurrentView('HUB');
    setAppStatus('IDLE');
    setInstructionText( "Session complete! Ready to map another tree.");
    
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
    setIsPanelOpen(false);
    setClaimedTree(null);
    setMaskGenerated(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleManualPointCollection = async (point: Point) => { 
    if (!scaleFactor || !imageDimensions) return;
    const showNextInstruction = (text: string) => { setInstructionText(text); setShowInstructionToast(true); };
    if (appStatus === 'ANALYSIS_MANUAL_AWAITING_BASE_CLICK') {
      try { const response = await manualGetDbhRectangle(point, scaleFactor, imageDimensions.w, imageDimensions.h); setDbhGuideRect(response.rectangle_coords); setAppStatus('ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS'); showNextInstruction("STEP 1/3 (Height): Click highest and lowest points."); } catch (error: any) { setAppStatus('ERROR'); setErrorMessage(error.message); }
    } else if (appStatus === 'ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS') {
      setManualPoints(p => { const h = [...p.height, point]; if (h.length === 2) { setAppStatus('ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS'); showNextInstruction("STEP 2/3 (Canopy): Click widest points."); } return {...p, height: h}; }); 
    } else if (appStatus === 'ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS') {
      setManualPoints(p => { const c = [...p.canopy, point]; if (c.length === 2) { setAppStatus('ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS'); showNextInstruction("STEP 3/3 (Girth): Use the red dotted guide to click the trunk's width."); } return {...p, canopy: c}; }); 
    } else if (appStatus === 'ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS') {
      setManualPoints(p => { const g = [...p.girth, point]; if (g.length === 2) { setAppStatus('ANALYSIS_MANUAL_READY_TO_CALCULATE'); setIsPanelOpen(true); setInstructionText("All points collected. Click 'Calculate'."); } return {...p, girth: g}; }); 
    }
  };

  const handleUndo = () => {
    switch (appStatus) {
      case 'ANALYSIS_AWAITING_INITIAL_CLICK_CONFIRMATION':
        setTransientPoint(null);
        setAppStatus('ANALYSIS_AWAITING_INITIAL_CLICK');
        setInstructionText("Tap the main trunk of the tree to begin.");
        setShowInstructionToast(true);
        break;
      
      case 'ANALYSIS_AWAITING_REFINE_POINTS':
        setRefinePoints(p => p.slice(0, -1));
        break;

      case 'ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS':
        if (manualPoints.height.length > 0) {
          setManualPoints(p => ({ ...p, height: p.height.slice(0, -1) }));
        }
        break;
      
      case 'ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS':
        if (manualPoints.canopy.length > 0) {
          setManualPoints(p => ({ ...p, canopy: p.canopy.slice(0, -1) }));
        } else {
          setAppStatus('ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS');
          setInstructionText("STEP 1/3 (Height): Click highest and lowest points.");
        }
        break;
      
      case 'ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS':
        if (manualPoints.girth.length > 0) {
          setManualPoints(p => ({ ...p, girth: p.girth.slice(0, -1) }));
        } else {
          setAppStatus('ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS');
          setInstructionText("STEP 2/3 (Canopy): Click widest points.");
        }
        break;

      case 'ANALYSIS_MANUAL_READY_TO_CALCULATE':
        setAppStatus('ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS');
        setInstructionText("STEP 3/3 (Girth): Use the red dotted guide to click the trunk's width.");
        setManualPoints(p => ({ ...p, girth: p.girth.slice(0, -1) }));
        break;
    }
  };

  const handleDistanceEntered = () => {
    console.log('[Distance Entry] 📏 User entered distance:', distance, 'meters');
    console.log('[Distance Entry] Current calibration status:', {
      focalLength: focalLength,
      fovRatio: fovRatio,
      hasCalibration: !!(focalLength || fovRatio)
    });
    console.log('[Distance Entry] Proceeding to analysis choice...');
    
    setAppStatus('SESSION_AWAITING_ANALYSIS_CHOICE');
    setInstructionText("Choose how you want to proceed with the analysis.");
  }

  const handleConfirmLocation = (location: LocationData) => { setCurrentLocation(location); setIsLocationPickerActive(false); };
  
  if (currentView === 'CALIBRATION') { return <CalibrationView onCalibrationComplete={onCalibrationComplete} />; }
  if (currentView === 'LEADERBOARD') { return <LeaderboardView onBack={() => setCurrentView('HUB')} />; }
  if (currentView === 'COMMUNITY_GROVE' && !claimedTree) { return <CommunityGroveView pendingTrees={pendingTrees} isLoading={appStatus === 'COMMUNITY_GROVE_LOADING' || appStatus === 'ANALYSIS_PROCESSING'} onClaimTree={handleClaimTree} onBack={handleReturnToHub} /> }

  const isSessionActive = currentView === 'SESSION' || (currentView === 'COMMUNITY_GROVE' && !!claimedTree);
  const isBusy = ['ANALYSIS_PROCESSING', 'ANALYSIS_SAVING', 'SESSION_PROCESSING_PHOTO', 'COMMUNITY_GROVE_LOADING'].includes(appStatus) || isCO2Calculating || isHistoryLoading;

  const renderFloatingActionButton = () => {
    if (!isSessionActive || isPanelOpen || window.innerWidth >= 768) {
      return null;
    }

    let buttonText = "Show Panel";
    if (appStatus === 'ANALYSIS_COMPLETE') {
      buttonText = "Review Results & Save";
    }

    return (
      <button onClick={() => setIsPanelOpen(true)} className="fixed bottom-6 right-6 z-30 p-4 bg-brand-primary text-content-on-brand rounded-full shadow-lg hover:bg-brand-primary-hover active:scale-95 transition-transform flex items-center gap-2"> 
        <Menu size={24} /> 
        <span className="text-sm font-semibold">{buttonText}</span>
      </button> 
    );
  };

  const renderSessionView = () => {
    // 🎯 EXCLUSIVE RENDERING PATTERN (Google Meet/Zoom/Instagram)
    // When in modal modes (Live AR, AR Ruler), render ONLY that component
    // This prevents UI overlap bugs

    // PRIORITY 1: Live AR Mode (Full-Screen Exclusive)
    if (isLiveARModeActive) {
      return (
        <LiveARMeasureView
          fovRatio={fovRatio}
          focalLength={focalLength}
          onMeasurementComplete={(result) => {
            // PHASE F.3: Database Integration Complete - Handle navigation to Hub
            console.log('[App] Live AR measurement complete:', result);

            // Update results if data was saved
            if (result.updatedResults) {
              setAllResults(result.updatedResults);
            }

            // Navigate to HUB (matching Photo Method exactly)
            if (result.shouldNavigateToHub) {
              setCurrentView('HUB');
              setIsLiveARModeActive(false);
              setAppStatus('IDLE');

              // Show success message based on workflow
              if (result.success) {
                if (result.quickSave) {
                  setInstructionText("✅ Quick capture submitted successfully! Available in Community Grove.");
                } else if (result.fullAnalysis) {
                  setInstructionText("✅ Full analysis saved! Check your history below.");
                }
              } else {
                // Error occurred
                setInstructionText(`❌ Save failed: ${result.error || 'Unknown error'}`);
                setErrorMessage(result.error || 'Failed to save measurement');
              }

              // Reset session state (same as Photo Method)
              setCurrentMeasurementFile(null);
              setDistance('');
              setFocalLength(null);
              setScaleFactor(null);
              setCurrentMetrics(null);
              setCurrentIdentification(null);
              setCurrentCO2(null);
              setAdditionalData(initialAdditionalData);
              setIsPanelOpen(false);
            } else {
              // Stay in Live AR mode (error handling)
              setIsLiveARModeActive(false);
              if (!result.success) {
                setErrorMessage(result.error || 'An error occurred');
                setAppStatus('ERROR');
              }
            }
          }}
          onCancel={() => {
            setIsLiveARModeActive(false);
            setCurrentView('HUB');
            setAppStatus('IDLE');
            setInstructionText("Live AR measurement cancelled.");
          }}
        />
      );
    }

    // PRIORITY 3: AR Ruler Mode (Full-Screen Exclusive - WebXR Fallback)
    if (isArModeActive) {
      return (
        <ARMeasureView
          onDistanceMeasured={(measuredDistance) => {
            setDistance(measuredDistance.toFixed(2));
            setIsArModeActive(false);
            handleDistanceEntered();
          }}
          onCancel={() => {
            setIsArModeActive(false);
          }}
        />
      );
    }

    // PRIORITY 4: Photo-Based Workflow (Default Session View)
    return (
      <>
        {appStatus === 'SESSION_AWAITING_PERMISSIONS' && (
          <PermissionsCheckModal 
            locationStatus={prereqStatus.location}
            compassStatus={prereqStatus.compass}
            onRequestPermissions={handleRequestPermissions}
            onConfirm={handlePermissionsConfirmed}
          />
        )}

      <div id="display-panel" className="flex-1 bg-background-inset flex items-center justify-center relative">
          {(!originalImageSrc && !isLocationPickerActive) && <div className="hidden md:flex flex-col items-center text-content-subtle"><TreePine size={64}/><p className="mt-4 text-lg">Awaiting photo...</p></div>}
          {isLocationPickerActive ? ( <LocationPicker onConfirm={handleConfirmLocation} onCancel={() => setIsLocationPickerActive(false)} initialLocation={currentLocation} theme={theme} /> ) : (
            originalImageSrc && <canvas ref={canvasRef} id="image-canvas" onClick={handleCanvasClick} className={`max-w-full max-h-full ${appStatus.includes('AWAITING_CLICK') || appStatus.includes('AWAITING_POINTS') ? 'cursor-crosshair' : ''}`} />
          )}
          {(appStatus === 'ANALYSIS_AWAITING_REFINE_POINTS' || isManualMode(appStatus) || appStatus === 'ANALYSIS_AWAITING_INITIAL_CLICK_CONFIRMATION') && (
            <FloatingInteractionControls 
              onUndo={handleUndo}
              onConfirm={appStatus === 'ANALYSIS_AWAITING_INITIAL_CLICK_CONFIRMATION' ? handleConfirmInitialClick : handleApplyRefinements}
              showConfirm={appStatus === 'ANALYSIS_AWAITING_REFINE_POINTS' || appStatus === 'ANALYSIS_AWAITING_INITIAL_CLICK_CONFIRMATION'}
              undoDisabled={
                (appStatus === 'ANALYSIS_AWAITING_REFINE_POINTS' && refinePoints.length === 0) ||
                (isManualMode(appStatus) && manualPoints.height.length === 0 && manualPoints.canopy.length === 0 && manualPoints.girth.length === 0)
              }
              confirmDisabled={refinePoints.length === 0 && appStatus === 'ANALYSIS_AWAITING_REFINE_POINTS'}
            />
          )}
      </div>
      
      {renderFloatingActionButton()}

      {(!isLocationPickerActive || window.innerWidth >= 768) && (
        <div id="control-panel" className={`bg-background-default border-r border-stroke-default flex flex-col transition-transform duration-300 ease-in-out md:translate-y-0 md:relative md:w-[35%] md:max-w-xl md:flex-shrink-0 ${isPanelOpen ? 'translate-y-0' : 'translate-y-full'} max-md:fixed max-md:inset-0 max-md:z-20`} >
          <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-stroke-default md:hidden">
              <AuthComponent profile={userProfile} theme={theme} onThemeToggle={handleThemeToggle} /> 
              <button onClick={() => setIsPanelOpen(false)} className="flex items-center gap-2 px-3 py-2 text-brand-secondary hover:bg-brand-secondary/10 rounded-lg font-medium text-sm">
                <ImageIcon size={20} />
                Show Image
              </button>
          </div>

          <div className="flex-grow overflow-y-auto p-4 md:p-6">
            <div className="hidden md:flex justify-between items-center mb-6">
              <h1 className="text-2xl font-semibold text-content-default">{claimedTree ? 'Community Analysis' : 'New Measurement'}</h1>
              <AuthComponent profile={userProfile} theme={theme} onThemeToggle={handleThemeToggle} />
            </div>

            <button onClick={handleReturnToHub} className="flex items-center gap-1.5 text-sm font-medium text-brand-secondary hover:bg-brand-secondary/10 p-2 rounded-lg mb-4">
              <ArrowLeft size={16}/> Back to Homepage
            </button>
            
            <div className="p-4 rounded-lg mb-6 bg-background-subtle border border-stroke-subtle"><h3 className="font-bold text-content-default">Current Task</h3><div id="status-box" className="text-sm text-content-subtle"><p>{instructionText}</p></div>{errorMessage && <p className="text-sm text-status-error font-medium mt-1">{errorMessage}</p>}</div>
            {isBusy && ( <div className="mb-6"><div className="progress-bar-container"><div className="progress-bar-animated"></div></div>{ <p className="text-xs text-center text-content-subtle animate-pulse mt-1">{isHistoryLoading ? 'Loading history...' : appStatus === 'ANALYSIS_SAVING' ? 'Saving...' : isCO2Calculating ? 'Calculating CO₂...' : 'Processing...'}</p>}</div> )}
            
            {appStatus === 'SESSION_AWAITING_PHOTO' && ( <div> <label className="block text-sm font-medium text-content-default mb-2">1. Select Photo</label> <input ref={fileInputRef} type="file" id="image-upload" accept="image/*" onChange={handleImageUpload} className="hidden" /> <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-background-default border-2 border-dashed border-stroke-default rounded-lg hover:border-brand-primary hover:bg-brand-primary/10"> <Upload className="w-5 h-5 text-content-subtle" /> <span className="text-content-subtle">Choose Image File</span> </button> </div> )}

            {appStatus === 'SESSION_AWAITING_DISTANCE' && ( 
              <div>
                {/* --- START: LIVE AR MODE BUTTON --- */}
                {FeatureFlags.LIVE_AR_MODE && (
                  <>
                    <button 
                      onClick={() => setIsLiveARModeActive(true)} 
                      className="w-full mb-4 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <Camera className="w-5 h-5" />
                      Live AR Measurement (Beta)
                    </button>

                    <div className="relative my-4 flex items-center">
                      <div className="flex-grow border-t border-stroke-default"></div>
                      <span className="flex-shrink mx-4 text-content-subtle text-sm">OR</span>
                      <div className="flex-grow border-t border-stroke-default"></div>
                    </div>
                  </>
                )}
                {/* --- END: LIVE AR MODE BUTTON --- */}

                {/* --- START: AR RULER WITH PLATFORM DETECTION --- */}
                <button 
                  onClick={() => setIsArModeActive(true)} 
                  className="w-full mb-2 flex items-center justify-center gap-2 px-6 py-3 bg-brand-secondary text-white font-semibold rounded-lg hover:bg-brand-secondary-hover"
                >
                  <Move className="w-5 h-5" />
                  Measure with AR Ruler
                </button>
                
                {/* Platform-specific compatibility notes */}
                {(() => {
                  const ua = navigator.userAgent;
                  const isIOS = /iPad|iPhone|iPod/.test(ua);
                  const isAndroid = /Android/.test(ua);
                  
                  if (isIOS) {
                    return (
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex gap-2 items-start">
                          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            <p className="font-semibold mb-1">iOS Detected</p>
                            <p>WebXR is limited on iOS Safari. For best results:</p>
                            <ol className="mt-1 ml-4 list-decimal space-y-0.5">
                              <li>Open iPhone's built-in <strong>Measure</strong> app</li>
                              <li>Place first marker at tree's base</li>
                              <li>Place second marker at your feet</li>
                              <li>Note the distance shown</li>
                              <li>Return here and enter it manually below</li>
                            </ol>
                            <p className="mt-1 text-blue-600 dark:text-blue-400 font-medium">
                              Accuracy: ±1-2cm (LiDAR) / ±2-5cm (standard)
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (isAndroid) {
                    return (
                      <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex gap-2 items-start">
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-green-700 dark:text-green-300">
                            <p className="font-semibold mb-1">Android Chrome Detected</p>
                            <p>AR Ruler uses WebXR for in-browser measurement.</p>
                            <p className="mt-1 text-green-600 dark:text-green-400 font-medium">
                              Accuracy: ±10-15cm • Auto-returns distance to app
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                {/* --- END: AR RULER WITH PLATFORM DETECTION --- */}

                <div className="relative my-4 flex items-center">
                    <div className="flex-grow border-t border-stroke-default"></div>
                    <span className="flex-shrink mx-4 text-content-subtle text-sm">OR</span>
                    <div className="flex-grow border-t border-stroke-default"></div>
                </div>
                
                <label htmlFor="distance-input" className="block text-sm font-medium text-content-default mb-2">Manually Enter Distance (meters)</label>
                <div className="relative">
                  <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-subtle" />
                  <input type="number" id="distance-input" placeholder="e.g., 10.5" value={distance} onChange={(e) => setDistance(e.target.value)} className="w-full pl-10 pr-4 py-3 border rounded-lg bg-background-default border-stroke-default focus:ring-2 focus:ring-brand-primary" />
                </div>
                <ARLinks />
                <button onClick={handleDistanceEntered} disabled={!distance} className="w-full mt-4 px-6 py-3 bg-brand-primary text-white font-semibold hover:bg-brand-primary-hover disabled:bg-background-inset disabled:text-content-subtle">
                  Continue
                </button>
              </div>
            )}
            
            {appStatus === 'SESSION_AWAITING_CALIBRATION_CHOICE' && (
              <div className="space-y-4 pt-4 border-t border-stroke-subtle">
                <h3 className="text-base font-semibold text-center text-content-default">Use Existing Calibration?</h3>
                <button 
                  onClick={() => { setAppStatus('SESSION_AWAITING_DISTANCE'); setInstructionText("Using saved calibration. Please enter the distance."); }}
                  className="w-full text-left p-4 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-all flex items-center gap-4"
                >
                  <ShieldCheck className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Use Saved Calibration</p>
                    <p className="text-xs opacity-80">Proceed with your previously saved camera settings.</p>
                  </div>
                </button>
                <button 
                  onClick={() => setCurrentView('CALIBRATION')}
                  className="w-full text-left p-4 bg-brand-accent text-white rounded-lg hover:bg-brand-accent-hover transition-all flex items-center gap-4"
                >
                  <Navigation className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Recalibrate</p>
                    <p className="text-xs opacity-80">Perform a new calibration for maximum accuracy.</p>
                  </div>
                </button>
              </div>
            )}
            
            {appStatus === 'SESSION_AWAITING_ANALYSIS_CHOICE' && ( <div className="space-y-4 pt-4 border-t border-stroke-subtle"> <h3 className="text-base font-semibold text-center text-content-default">How would you like to proceed?</h3> <button onClick={handleSubmitForCommunity} className="w-full text-left p-4 bg-brand-secondary text-white rounded-lg hover:bg-brand-secondary-hover transition-all flex items-center gap-4"> <Navigation className="w-6 h-6 flex-shrink-0" /> <div><p className="font-semibold">Submit for Community <span className="text-xs font-bold bg-white text-brand-secondary px-1.5 py-0.5 rounded-full ml-1">+2 SP</span></p><p className="text-xs opacity-80">Quickly tag this tree for others to analyze.</p></div> </button> <button onClick={() => {setAppStatus('ANALYSIS_AWAITING_MODE_SELECTION'); setInstructionText("Select your preferred analysis method.");}} className="w-full text-left p-4 bg-brand-primary text-content-on-brand rounded-lg hover:bg-brand-primary-hover transition-all flex items-center gap-4"> <ShieldCheck className="w-6 h-6 flex-shrink-0" /> <div><p className="font-semibold">Analyze Myself <span className="text-xs font-bold bg-white text-brand-primary px-1.5 py-0.5 rounded-full ml-1">+15 SP</span></p><p className="text-xs opacity-80">Perform a detailed analysis for immediate results.</p></div> </button> </div> )}

            {appStatus === 'ANALYSIS_AWAITING_MODE_SELECTION' && (
               <div className="space-y-3 pt-6 border-t border-stroke-subtle mt-6"> 
                  <h3 className="text-base font-semibold text-center text-content-default mb-2">Choose Measurement Method</h3>
                  <button id="start-auto-btn" onClick={handleStartAutoMeasurement} className="w-full text-left p-4 bg-brand-primary text-content-on-brand rounded-lg hover:bg-brand-primary-hover disabled:bg-background-inset disabled:opacity-50 transition-all flex items-center gap-4"> <Zap className="w-6 h-6 flex-shrink-0" /> <div><p className="font-semibold">Automatic Measurement</p><p className="text-xs opacity-80">Tap the trunk once for a quick analysis.</p></div> </button> 
                  <button id="start-manual-btn" onClick={handleStartManualMeasurement} className="w-full text-left p-4 bg-brand-accent text-white rounded-lg hover:bg-brand-accent-hover disabled:bg-background-inset transition-all flex items-center gap-4"> <Ruler className="w-6 h-6 flex-shrink-0" /> <div><p className="font-semibold">Manual Measurement</p><p className="text-xs opacity-80">Mark all points yourself for maximum control.</p></div> </button> 
              </div>
            )}
            
            {appStatus === 'ANALYSIS_MANUAL_READY_TO_CALCULATE' && ( <div className="pt-6 mt-6 border-t border-stroke-subtle"> <button onClick={handleCalculateManual} disabled={isBusy} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-brand-accent text-white rounded-lg font-semibold hover:bg-brand-accent-hover disabled:bg-background-inset"> <Ruler className="w-5 h-5" /> Calculate Measurements </button> </div> )}

            {currentMetrics && (appStatus === 'ANALYSIS_COMPLETE') && ( <div className="space-y-4"> <div> <h2 className="text-lg font-semibold text-content-default">Measurement Results</h2> <div className="space-y-2 mt-2"> <div className="flex justify-between items-center p-3 bg-background-default rounded-lg border border-stroke-subtle"><label className="font-medium text-content-default">Height:</label><span className="font-mono text-lg text-content-default">{currentMetrics?.height_m?.toFixed(2) ?? '--'} m</span></div> <div className="flex justify-between items-center p-3 bg-background-default rounded-lg border border-stroke-subtle"><label className="font-medium text-content-default">Canopy:</label><span className="font-mono text-lg text-content-default">{currentMetrics?.canopy_m?.toFixed(2) ?? '--'} m</span></div> 
            <div className="flex justify-between items-center p-3 bg-background-default rounded-lg border border-stroke-subtle">
              <div className="flex items-center gap-2 relative group min-w-0">
                <label className="font-medium text-content-default truncate">Diameter at Breast Height (DBH):</label>
                <Info className="w-4 h-4 text-content-subtle cursor-pointer flex-shrink-0" />
                <div className="absolute bottom-full mb-2 w-60 bg-background-subtle text-content-default text-xs rounded-lg py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-stroke-default">
                  Diameter at Breast Height (1.37m or 4.5ft), a standard forestry measurement.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-background-subtle"></div>
                </div>
              </div>
              <span className="font-mono text-lg text-content-default">{currentMetrics?.dbh_cm?.toFixed(2) ?? '--'} cm</span>
            </div>
            </div> 
            {maskGenerated && <button onClick={() => setIsPanelOpen(false)} className="w-full mt-3 text-sm text-brand-secondary hover:underline">View Masked Image</button>}
            </div> 
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-stroke-subtle"> 
              {maskGenerated && <button onClick={() => { 
                setIsLocationPickerActive(false); 
                setAppStatus('ANALYSIS_AWAITING_REFINE_POINTS'); 
                setIsPanelOpen(false); 
                setInstructionText("Click points to fix the tree's outline."); 
                setShowInstructionToast(true); 
              }} className="px-4 py-2 bg-brand-secondary text-white rounded-lg hover:bg-brand-secondary-hover text-sm">Correct Outline</button>}
            <button onClick={() => { 
              if (currentMeasurementFile && scaleFactor) { 
                setIsLocationPickerActive(false); 
                setResultImageSrc(originalImageSrc); 
                setCurrentMetrics(null); 
                setDbhLine(null); 
                setRefinePoints([]); 
                setAppStatus('ANALYSIS_MANUAL_AWAITING_BASE_CLICK'); 
                setIsPanelOpen(false); 
                setInstructionText("Manual Mode: Click the exact base of the tree trunk."); 
                setShowInstructionToast(true); 
              } 
            }} className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent-hover text-sm">Restart in Manual</button> </div>
            <div className="space-y-4 border-t border-stroke-subtle pt-4"> 
              <SpeciesIdentifier onIdentificationComplete={setCurrentIdentification} onClear={() => setCurrentIdentification(null)} existingResult={currentIdentification} mainImageFile={currentMeasurementFile} mainImageSrc={originalImageSrc} analysisMode={currentView === 'COMMUNITY_GROVE' ? 'community' : 'session'} /> 
              <CO2ResultCard co2Value={currentCO2} isLoading={isCO2Calculating} /> 
              {currentView === 'SESSION' && <button onClick={() => setIsLocationPickerActive(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-background-default border border-stroke-default text-content-default rounded-lg hover:bg-background-subtle"> <MapPin className="w-5 h-5 text-brand-secondary" /> {currentLocation ? `Location Set: ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'Add/Edit Location'} </button>}
              {(currentView === 'SESSION' || currentView === 'COMMUNITY_GROVE') && <AdditionalDetailsForm data={additionalData} onUpdate={(field, value) => setAdditionalData(prev => ({ ...prev, [field]: value }))} />}
            </div> 
            <div className="pt-4 border-t border-stroke-subtle">
              {currentView === 'SESSION' && <button onClick={handleSaveResult} disabled={!currentMetrics || !currentIdentification} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-secondary text-content-on-brand rounded-lg font-medium hover:bg-brand-secondary-hover disabled:bg-background-inset disabled:text-content-subtle disabled:cursor-not-allowed"><Plus className="w-5 h-5" />Save to History</button>} 
              {currentView === 'COMMUNITY_GROVE' && <button onClick={handleSubmitCommunityAnalysis} disabled={!currentMetrics || !currentIdentification} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-secondary text-content-on-brand rounded-lg font-medium hover:bg-brand-secondary-hover disabled:bg-background-inset disabled:text-content-subtle disabled:cursor-not-allowed"><GitMerge className="w-5 h-5" />Submit Analysis</button>}
            </div>
            </div> )}
          </div>
        </div>
      )}
      </>
    );
  };

  return (
    <div className="h-screen w-screen bg-background-default font-inter flex flex-col md:flex-row overflow-hidden">
      {editingResult && ( <EditResultModal result={editingResult} onClose={() => setEditingResult(null)} onSave={handleUpdateResult} /> )}
      <InstructionToast message={instructionText} show={showInstructionToast} onClose={() => setShowInstructionToast(false)} />
      
      {isSessionActive ? renderSessionView() : (
        <div className="w-full flex flex-col h-full">
            <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-stroke-default bg-background-default/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3"><TreePine className="w-7 h-7 text-brand-primary" /><h1 className="text-xl font-semibold text-content-default">Elite Tree Measurement</h1></div>
                <AuthComponent profile={userProfile} theme={theme} onThemeToggle={handleThemeToggle} />
            </header>
            <main className="flex-grow overflow-y-auto p-4 md:p-6 bg-background-subtle">
              <div className="max-w-4xl mx-auto text-center py-8 md:py-16">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-content-default">Map the Planet's Trees</h1>
                <p className="mt-4 max-w-2xl mx-auto text-lg text-content-subtle">
                  Snap a photo, get instant measurements. Identify species, calculate carbon impact, and contribute to a global tree database.
                </p>
                
                {/* PRIMARY ACTION: Photo-Based Tree Measurement */}
                <button 
                  onClick={handleStartSession} 
                  className="mt-8 px-8 py-4 bg-brand-primary text-content-on-brand hover:bg-brand-primary-hover shadow-lg shadow-brand-primary/20 rounded-lg font-bold text-lg transition-transform active:scale-95 flex items-center justify-center gap-3 mx-auto"
                >
                  <Camera size={24} />
                  Measure a Tree Now
                </button>
              </div>

              <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button onClick={handleNavigateToGrove} className="text-left p-6 bg-background-default border border-stroke-default rounded-lg hover:border-brand-secondary/50 hover:shadow-xl transition-all hover:-translate-y-1">
                      <div className="flex items-center gap-3"><Users className="w-7 h-7 text-brand-secondary"/> <h3 className="text-lg font-semibold text-content-default">The Community Grove</h3></div>
                      <p className="text-sm text-content-subtle mt-2">Can't do a full measurement? Help our community by analyzing trees that others have submitted.</p>
                  </button>
                  <button onClick={() => setCurrentView('LEADERBOARD')} className="text-left p-6 bg-background-default border border-stroke-default rounded-lg hover:border-brand-accent/50 hover:shadow-xl transition-all hover:-translate-y-1">
                      <div className="flex items-center gap-3"><BarChart2 className="w-7 h-7 text-brand-accent"/> <h3 className="text-lg font-semibold text-content-default">Leaderboard</h3></div>
                      <p className="text-sm text-content-subtle mt-2">See how your contributions rank. Earn Sapling Points for each tree you map and analyze.</p>
                  </button>
              </div>
              <div className="max-w-7xl mx-auto">
                <ResultsTable results={allResults} onDeleteResult={handleDeleteResult} onEditResult={handleOpenEditModal} isLoading={isHistoryLoading} />
              </div>
            </main>
        </div>
      )}
    </div>
  );
}

export default App;