// src/App.tsx
import React, { useState, useRef, useEffect } from 'react';
// --- START: SURGICAL MODIFICATION (AR IMPORTS) ---
import { Upload, TreePine, Ruler, Zap, RotateCcw, Menu, Plus, MapPin, LogIn, LogOut, Navigation, ShieldCheck, Info, Check, Sun, Moon, Camera, Move, ArrowLeft, Users, BarChart2, GitMerge, ImageIcon, ChevronDown, User, ArrowRight, TreeDeciduous, Sparkles, GraduationCap, AlertTriangle } from 'lucide-react';
import { ARMeasureView } from './components/ARMeasureView';
// --- END: SURGICAL MODIFICATION (AR IMPORTS) ---
// --- START: LIVE AR INTEGRATION ---
import { LiveARMeasureView } from './components/live-ar/LiveARMeasureView_Enhanced';
import { FeatureFlags } from './config/featureFlags';
import { Magnifier } from './components/Magnifier';
import { useSessionPersistence } from './hooks/useSessionPersistence';
// --- END: LIVE AR INTEGRATION ---
import { TrainingHub } from './components/training/TrainingHub';
import ExifReader from 'exifreader';
import { 
  samRefineWithPoints, manualGetDbhRectangle, manualCalculation, calculateCO2, 
  Point, Metrics, IdentificationResponse, TreeResult, UpdateTreeResultPayload, PendingTree, CommunityAnalysisPayload,
  getResults, saveResult, deleteResult, updateResult, uploadImage, quickCapture,
  getPendingTrees, claimTree, submitCommunityAnalysis, samAutoSegmentFromUrl
} from './apiService';
import { CalibrationView } from './components/CalibrationView';
import { ResultsTable } from './components/ResultsTable';
import { SpeciesIdentifier } from './components/SpeciesIdentifier';
import { AdditionalDetailsForm, AdditionalData } from './components/AdditionalDetailsForm';
import { LocationPicker } from './components/LocationPicker';
import { ViewToggle } from './components/ViewToggle';
import { TreeMapView } from './components/TreeMapView';
import { TreeDetailModal } from './components/TreeDetailModal';
import { InstructionToast } from './components/InstructionToast';
import { useAuth } from './contexts/AuthContext';
import { EditResultModal } from './components/EditResultModal'; 
import { CommunityGroveView } from './components/CommunityGroveView';
import { supabase } from './supabaseClient';
import { LeaderboardView } from './components/LeaderboardView';
import { PermissionsCheckModal } from './components/PermissionsCheckModal';
import { ProcessingQuizModal } from './components/common/ProcessingQuizModal';
import { MissionsView } from './components/missions/MissionsView';
import { useLocationTracker } from './hooks/useLocationTracker';
import { SpeciesDetailCaptureModal } from './components/SpeciesDetailCaptureModal';

// --- START: DISTANCE CORRECTION HELPERS ---
// Helper to correct distance drift (Linear Model with Clamping)
const calculateCorrectedDistance = (rawDistance: number): number => {
  // If distance is less than 2m, trust the raw value (avoid negative correction)
  if (rawDistance < 2.0) {
    return rawDistance;
  }
  
  // Linear correction for distance > 2m
  // Based on empirical data: Error grows ~1.8% per meter
  // We reduce the effective distance to compensate for the overestimation
  const driftFactor = 0.018;
  const correction = 1.0 - (driftFactor * (rawDistance - 2.0));
  
  // Safety clamp: Don't let correction go below 0.8 (20% max reduction)
  const clampedCorrection = Math.max(0.8, correction);
  
  return rawDistance * clampedCorrection;
};

// --- END: DISTANCE CORRECTION HELPERS ---

type AppView = 'HUB' | 'SESSION' | 'COMMUNITY_GROVE' | 'LEADERBOARD' | 'CALIBRATION' | 'TRAINING' | 'MISSIONS';

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
  'ANALYSIS_AWAITING_CANOPY_POINTS' |
  'ANALYSIS_AWAITING_CANOPY_CONFIRMATION' |
  'ANALYSIS_PROCESSING' |
  'ANALYSIS_SAVING' |
  'ANALYSIS_COMPLETE' |
  'ANALYSIS_AWAITING_REFINE_POINTS' |
  'ANALYSIS_MANUAL_AWAITING_BASE_CLICK' |
  'ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS' |
  'ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS' |
  'ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS' |
  'ANALYSIS_MANUAL_AWAITING_CONFIRMATION' |
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
  isInteracting?: boolean;
}

const FloatingInteractionControls = ({ onUndo, onConfirm, showConfirm, undoDisabled, confirmDisabled, isInteracting = false }: FloatingInteractionControlsProps) => {
  return (
    <div 
      className={`fixed left-6 z-50 flex items-center gap-3 bg-background-subtle/95 text-content-default p-2 rounded-xl shadow-2xl backdrop-blur-md border border-stroke-default transition-opacity duration-200 ${isInteracting ? 'opacity-10' : 'opacity-100'}`}
      style={{
        // CRITICAL FIX: Multi-layer mobile browser UI safety + Left positioning to avoid "Show Panel" button
        // Layer 1: env(safe-area-inset-bottom) handles iOS notches & Android gesture bars
        // Layer 2: max(80px, ...) ensures clearance above mobile browser bottom nav (48-56px)
        // Layer 3: Left-aligned (left-6) to avoid overlapping with "Show Panel" button on right
        bottom: 'max(80px, calc(1.5rem + env(safe-area-inset-bottom, 0px)))',
      }}
    >
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

  // Magnifier State
  const [magnifierState, setMagnifierState] = useState<{x: number, y: number, show: boolean, isSnapped: boolean}>({x: 0, y: 0, show: false, isSnapped: false});
  const [isDragging, setIsDragging] = useState(false);

  // --- END: SURGICAL REPLACEMENT (SIMPLIFIED AR STATE) ---
  
  // --- START: DUAL-VIEW STATE ---
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedTreeForModal, setSelectedTreeForModal] = useState<TreeResult | null>(null);
  // --- END: DUAL-VIEW STATE ---

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
  
  // --- START: SENSITIVITY ANALYSIS STATE ---
  const [heightTolerance, setHeightTolerance] = useState<number | null>(null);
  const [canopyTolerance, setCanopyTolerance] = useState<number | null>(null);
  const [dbhTolerance, setDbhTolerance] = useState<number | null>(null);
  const [co2Tolerance, setCo2Tolerance] = useState<number | null>(null);
  // --- END: SENSITIVITY ANALYSIS STATE ---

  const [isCO2Calculating, setIsCO2Calculating] = useState(false);
  const [additionalData, setAdditionalData] = useState<AdditionalData>(initialAdditionalData);
  const [isLocationPickerActive, setIsLocationPickerActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData>(null);
  
  const [originalImageSrc, setOriginalImageSrc] = useState<string>('');
  const [resultImageSrc, setResultImageSrc] = useState<string>('');
  const [imageDimensions, setImageDimensions] = useState<{w: number, h: number} | null>(null);
  const [refinePoints, setRefinePoints] = useState<Point[]>([]);
  const [initialPoints, setInitialPoints] = useState<Point[]>([]);  // Trunk + canopy points for SAM
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
  const [showSpeciesDetailModal, setShowSpeciesDetailModal] = useState(false);

  // Collapsible sections state for results panel
  const [expandedSections, setExpandedSections] = useState({
    measurements: true,
    species: false,
    location: false,
    additionalDetails: false
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRectRef = useRef<DOMRect | null>(null); // Optimization: Cache canvas rect during drag

  // --- START: MISSION CONTROL HEARTBEAT ---
  // This hook runs in the background and updates the user's location in Supabase
  // It only runs if the user is logged in.
  useLocationTracker();
  // --- END: MISSION CONTROL HEARTBEAT ---

  // --- START: SESSION PERSISTENCE ---
  const { isRestoring, restoredSession, saveSession, clearSession } = useSessionPersistence();

  // 1. Restore Session
  useEffect(() => {
    if (restoredSession) {
      console.log('[App] ♻️ Restoring saved session...');
      const { state, imageFile, pendingImageFile } = restoredSession;
      
      // Restore State
      setAppStatus(state.appStatus as AppStatus);
      setCurrentView(state.currentView as AppView);
      setInstructionText(state.instructionText);
      setDistance(state.distance);
      setFocalLength(state.focalLength);
      setScaleFactor(state.scaleFactor);
      setInitialPoints(state.initialPoints);
      setRefinePoints(state.refinePoints);
      setManualPoints(state.manualPoints);
      setTransientPoint(state.transientPoint);
      setImageDimensions(state.imageDimensions);
      setDeviceHeading(state.deviceHeading);
      setCapturedHeading(state.capturedHeading);
      if (state.fovRatio) setFovRatio(state.fovRatio);

      // Restore Images
      if (imageFile) {
        setCurrentMeasurementFile(imageFile);
        const url = URL.createObjectURL(imageFile);
        setOriginalImageSrc(url);
        setResultImageSrc(url); 
        console.log('[App] 📸 Restored main image');
      }
      
      if (pendingImageFile) {
        setPendingTreeFile(pendingImageFile);
        console.log('[App] 📸 Restored pending image');
      }
      
      // If we were in a session, ensure panel is open if needed
      if (state.currentView === 'SESSION' && state.appStatus !== 'IDLE') {
        setIsPanelOpen(true);
      }
    }
  }, [restoredSession]);

  // 2. Auto-Save Session
  useEffect(() => {
    if (isRestoring) return;
    
    saveSession({
      appStatus,
      currentView,
      instructionText,
      distance,
      focalLength,
      scaleFactor,
      initialPoints,
      refinePoints,
      manualPoints,
      transientPoint,
      imageDimensions,
      deviceHeading,
      capturedHeading,
      fovRatio
    }, currentMeasurementFile, pendingTreeFile);
  }, [
    isRestoring, saveSession, appStatus, currentView, instructionText, distance, 
    focalLength, scaleFactor, initialPoints, refinePoints, manualPoints, 
    transientPoint, imageDimensions, deviceHeading, capturedHeading, fovRatio,
    currentMeasurementFile, pendingTreeFile
  ]);
  // --- END: SESSION PERSISTENCE ---

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


  // --- START: PHASE 1 ENHANCEMENT (Visibility API Listener) ---
  // Auto-retry permissions when user returns from Settings
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Only re-check if we're in permission modal AND in an error state
      if (appStatus === 'SESSION_AWAITING_PERMISSIONS' &&
          document.visibilityState === 'visible' && 
          (prereqStatus.location === 'TIMEOUT' || 
           prereqStatus.location === 'DENIED' ||
           prereqStatus.location === 'UNAVAILABLE' ||
           prereqStatus.location === 'ERROR')) {
        
        console.log('[Permission Monitor] 👀 Tab visible - auto-checking if location enabled...');
        
        // Silent check - doesn't trigger new permission prompt
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // ✅ Location now available - update state
            console.log('[Permission Monitor] ✅ Location now available!');
            const userLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
            setUserGeoLocation(userLoc);
            setCurrentLocation(userLoc);
            setPrereqStatus(prev => ({ ...prev, location: 'GRANTED' }));
            setInstructionText('Location access granted!');
            setErrorMessage('');
          },
          (error) => {
            // Still unavailable - keep current error state
            console.log('[Permission Monitor] ⏳ Still unavailable:', error.code);
          },
          {
            enableHighAccuracy: false,
            timeout: 3000,
            maximumAge: 0
          }
        );
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [appStatus, prereqStatus.location]);
  // --- END: PHASE 1 ENHANCEMENT ---

  // --- START: PHASE 1 ENHANCEMENT (Polling for Error States) ---
  // Continuously check permission when in TIMEOUT/ERROR/UNAVAILABLE
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    
    // Start polling when in error state AND permission modal is active
    if (appStatus === 'SESSION_AWAITING_PERMISSIONS' &&
        (prereqStatus.location === 'TIMEOUT' || 
         prereqStatus.location === 'ERROR' ||
         prereqStatus.location === 'UNAVAILABLE')) {
      
      console.log('[Permission Poll] 🔄 Starting 3-second polling...');
      
      pollInterval = setInterval(() => {
        console.log('[Permission Poll] Checking if location enabled...');
        
        // Silent check - doesn't trigger new permission prompt
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // ✅ Location now available - update state and stop polling
            console.log('[Permission Poll] ✅ Location detected!');
            const userLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
            setUserGeoLocation(userLoc);
            setCurrentLocation(userLoc);
            setPrereqStatus(prev => ({ ...prev, location: 'GRANTED' }));
            setInstructionText('Location access granted!');
            setErrorMessage('');
          },
          (error) => {
            // Still unavailable - continue polling
            console.log('[Permission Poll] Still unavailable - code:', error.code);
          },
          {
            enableHighAccuracy: false,
            timeout: 3000,
            maximumAge: 0
          }
        );
      }, 3000); // Poll every 3 seconds
    }
    
    return () => {
      if (pollInterval) {
        console.log('[Permission Poll] 🛑 Stopping polling');
        clearInterval(pollInterval);
      }
    };
  }, [appStatus, prereqStatus.location]);
  // --- END: PHASE 1 ENHANCEMENT ---

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

  // --- START: SENSITIVITY / TOLERANCE CALCULATION ---
  useEffect(() => {
    if (currentMetrics && scaleFactor) {
      // 1. Calculate Input Sensitivities (1% distance error + 5px touch error)
      // Scale factor is in mm/pixel
      const metersPerPixel = scaleFactor / 1000;
      const cmPerPixel = scaleFactor / 10;

      // Formula: Tolerance = (Value * 0.01) + (UnitsPerPixel * 5)
      const h_tol = (currentMetrics.height_m * 0.01) + (metersPerPixel * 5);
      const c_tol = (currentMetrics.canopy_m * 0.01) + (metersPerPixel * 5);
      const d_tol = (currentMetrics.dbh_cm * 0.01) + (cmPerPixel * 5);

      setHeightTolerance(h_tol);
      setCanopyTolerance(c_tol);
      setDbhTolerance(d_tol);

      // 2. Calculate CO2 Error Propagation
      // Formula: Error_CO2% ≈ 0.976 * (Error_H% + 2 * Error_D%)
      // Derived from Chave et al. (2014): AGB = p * (D^2 * H)^0.976
      if (currentCO2) {
        const rel_err_h = h_tol / currentMetrics.height_m;
        const rel_err_d = d_tol / currentMetrics.dbh_cm;
        
        // Error propagation for power law
        const rel_err_co2 = 0.976 * (rel_err_h + (2 * rel_err_d));
        const co2_tol = currentCO2 * rel_err_co2;
        
        setCo2Tolerance(co2_tol);
      } else {
        setCo2Tolerance(null);
      }
    } else {
      setHeightTolerance(null);
      setCanopyTolerance(null);
      setDbhTolerance(null);
      setCo2Tolerance(null);
    }
  }, [currentMetrics, scaleFactor, currentCO2]);
  // --- END: SENSITIVITY / TOLERANCE CALCULATION ---

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
          
          console.log('[Photo Calibration] ✅ IMAGE SOURCES SET:', {
            originalImageSrc: objectURL.substring(0, 50) + '...',
            resultImageSrc: objectURL.substring(0, 50) + '...',
            timestamp: new Date().toISOString()
          });
          
          if (typeof focalLengthValue === 'number') {
            // Tier 1 SUCCESS - Use EXIF data
            setFocalLength(focalLengthValue);
            console.log('[Photo Calibration] 🎉 Tier 1 calibration complete - focal length:', focalLengthValue, 'mm');
            console.log('[Photo Calibration] Proceeding to distance entry...');
            setAppStatus('SESSION_AWAITING_DISTANCE'); 
            setIsPanelOpen(true);
            setInstructionText("Great! Now, please enter the distance to the tree's base.");
          } else {
            // Tier 1 FAILED - Check for existing calibration or proceed to manual
            console.log('[Photo Calibration] ⚠️ Tier 1 failed, checking for saved calibration...');
            
            // Import calibration utilities dynamically
            const { loadSavedCalibration } = await import('./utils/cameraCalibration');
            const savedCalibration = loadSavedCalibration();
            
            // --- START: SURGICAL FIX ---
            // Check for simple V2 calibration factor as well (The "Top Engineering" Key)
            const savedCalibrationV2 = localStorage.getItem('device_calibration_factor_v2');
            
            if (savedCalibrationV2) {
                 const fovRatioV2 = parseFloat(savedCalibrationV2);
                 setFovRatio(fovRatioV2);
                 console.log('[Photo Calibration] ✅ Found saved V2 calibration factor:', fovRatioV2);
                 
                 setPendingTreeFile(currentMeasurementFile);
                 // PAUSE: Ask user if they want to use saved calibration or redo
                 setAppStatus('SESSION_AWAITING_CALIBRATION_CHOICE');
                 setIsPanelOpen(true);
                 setInstructionText("Saved calibration found. Continue or redo?");
            }
            else if (savedCalibration && (savedCalibration.focalLength35mm || savedCalibration.fovHorizontal)) {
              // Saved calibration found (Legacy/Tier 3)
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
              // PAUSE: Ask user if they want to use saved calibration or redo
              setAppStatus('SESSION_AWAITING_CALIBRATION_CHOICE');
              setIsPanelOpen(true);
              setInstructionText("Saved calibration found. Continue or redo?");
            } else {
              // No saved calibration - go to manual calibration
              console.log('[Photo Calibration] ⚠️ No saved calibration found');
              console.log('[Photo Calibration] Tier 2 will be attempted during distance entry (if camera stream available)');
              console.log('[Photo Calibration] Redirecting to manual calibration view...');
              
              setPendingTreeFile(currentMeasurementFile);
              setCurrentView('CALIBRATION');
              setInstructionText("No camera calibration found. Please calibrate your camera for accurate measurements.");
            }
            // --- END: SURGICAL FIX ---
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
    if (isLocationPickerActive) {
      console.log('[CANVAS RENDER] ⏭️ Skipped - location picker active');
      return;
    }
    
    const canvas = canvasRef.current;
    
    console.log('[CANVAS RENDER] 🎨 Attempting to render canvas...', {
      hasCanvas: !!canvas,
      resultImageSrc: resultImageSrc ? 'SET (' + resultImageSrc.substring(0, 30) + '...)' : 'EMPTY',
      originalImageSrc: originalImageSrc ? 'SET (' + originalImageSrc.substring(0, 30) + '...)' : 'EMPTY',
      willUseSource: resultImageSrc ? 'resultImageSrc' : (originalImageSrc ? 'originalImageSrc (fallback)' : 'NONE')
    });
    
    // FALLBACK FIX: Use originalImageSrc if resultImageSrc is not available
    // This handles cases where image display is lost (e.g., returning from calibration)
    const imageSource = resultImageSrc || originalImageSrc;
    if (!canvas || !imageSource) {
      console.log('[CANVAS RENDER] ❌ Cannot render - missing:', {
        canvas: !!canvas,
        imageSource: !!imageSource
      });
      return;
    }
    
    console.log('[CANVAS RENDER] ✅ Rendering with source:', imageSource.substring(0, 50) + '...');
    
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const img = new Image(); img.src = imageSource;
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
      
      // --- ENHANCED VISUALIZATION HELPERS ---
      const drawPoint = (p: Point, color: string, label?: string, isCrosshair: boolean = false) => { 
        const sp = scaleCoords(p); 
        
        if (isCrosshair) {
            // Draw Target Crosshair (For Base/Anchor points)
            ctx.beginPath();
            ctx.moveTo(sp.x - 12, sp.y); ctx.lineTo(sp.x + 12, sp.y);
            ctx.moveTo(sp.x, sp.y - 12); ctx.lineTo(sp.x, sp.y + 12);
            ctx.strokeStyle = 'white'; ctx.lineWidth = 4; ctx.stroke(); // Outer stroke for contrast
            ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();   // Inner color
            
            ctx.beginPath(); 
            ctx.arc(sp.x, sp.y, 6, 0, 2 * Math.PI); 
            ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
        } else {
            // Draw Standard Point
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 6, 0, 2 * Math.PI); 
            ctx.fillStyle = color; ctx.fill(); 
            ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke(); 
        }

        // Draw Label with Shadow for Readability
        if (label) {
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.strokeText(label, sp.x + 10, sp.y - 8);
            ctx.fillStyle = 'white';
            ctx.fillText(label, sp.x + 10, sp.y - 8);
        }
      };

      const drawConnector = (p1: Point, p2: Point, color: string, dashed: boolean = false) => {
          const sp1 = scaleCoords(p1);
          const sp2 = scaleCoords(p2);
          ctx.beginPath();
          ctx.moveTo(sp1.x, sp1.y);
          ctx.lineTo(sp2.x, sp2.y);
          ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 4; ctx.stroke(); // Shadow
          ctx.strokeStyle = color; ctx.lineWidth = 2; 
          if (dashed) ctx.setLineDash([6, 4]); else ctx.setLineDash([]);
          ctx.stroke();
          ctx.setLineDash([]);
      };

      // --- AUTO MODE RENDERING ---
      if (initialPoints.length > 0) {
          // Trunk Point -> Fuchsia Crosshair
          drawPoint(initialPoints[0], '#D946EF', 'Trunk', true);
      }
      if (initialPoints.length > 1) {
          // Canopy Points -> Red
          initialPoints.slice(1).forEach((p, i) => drawPoint(p, '#EF4444', `Canopy ${i+1}`));
          if (initialPoints.length === 3) {
              drawConnector(initialPoints[1], initialPoints[2], '#EF4444', true);
          }
      }

      // --- MANUAL MODE RENDERING ---
      // 1. Height (Yellow - High Contrast)
      if (manualPoints.height.length > 0) {
          manualPoints.height.forEach((p, i) => {
              // Draw Base point (H1) as a Crosshair for better visibility/precision
              const isBase = i === 0;
              drawPoint(p, '#FACC15', `H${i+1}`, isBase);
          });
          // NOTE: User requested NO lines connecting points for simplicity.
          // Just points (H1, H2) are sufficient.
      }
      
      // 2. Canopy (Red - High Contrast)
      if (manualPoints.canopy.length > 0) {
          manualPoints.canopy.forEach((p, i) => drawPoint(p, '#EF4444', `C${i+1}`));
          // NOTE: User requested NO lines connecting points for simplicity.
      }

      // 3. Girth (Cyan - High Contrast)
      if (manualPoints.girth.length > 0) {
          manualPoints.girth.forEach((p, i) => drawPoint(p, '#06B6D4', `G${i+1}`));
          // NOTE: User requested NO lines connecting points for simplicity.
      }

      // Transient Point (Blue Crosshair for active selection)
      if (transientPoint) drawPoint(transientPoint, '#3B82F6', 'Select...', true);

      // Existing Overlays
      if (dbhLine) { const p1 = scaleCoords({x: dbhLine.x1, y: dbhLine.y1}); const p2 = scaleCoords({x: dbhLine.x2, y: dbhLine.y2}); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 4; ctx.stroke(); }
      if (dbhGuideRect && imageDimensions && (appStatus === 'ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS' || appStatus === 'ANALYSIS_MANUAL_AWAITING_CONFIRMATION')) { 
          const p = scaleCoords({x: dbhGuideRect.x, y: dbhGuideRect.y}); 
          const rectHeight = (dbhGuideRect.height / imageDimensions.h) * canvas.height; 
          const lineY = p.y + rectHeight / 2; 
          
          // OPTION A: "Magnetic Band" (Cyan Glow)
          // Draw a semi-transparent band instead of a thin red line
          const bandHeight = canvas.height * 0.05; // 5% of screen height
          ctx.fillStyle = 'rgba(6, 182, 212, 0.15)'; // Cyan with low opacity
          ctx.fillRect(0, lineY - bandHeight/2, canvas.width, bandHeight);
          
          // Draw a subtle center guide (white dashed)
          ctx.beginPath(); 
          ctx.setLineDash([5, 5]); 
          ctx.moveTo(0, lineY); 
          ctx.lineTo(canvas.width, lineY); 
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; 
          ctx.lineWidth = 1.5; 
          ctx.stroke(); 
          ctx.setLineDash([]); 
      }
      
      // Refine Points
      refinePoints.forEach(p => drawPoint(p, '#EF4444'));
    };
  }, [resultImageSrc, originalImageSrc, dbhLine, dbhGuideRect, initialPoints, refinePoints, manualPoints, transientPoint, imageDimensions, isLocationPickerActive, isArModeActive, appStatus]);
  
  // CRITICAL FIX: Restore image sources after returning from AR mode
  // When AR Ruler is used, the photo view unmounts. When returning, we need to restore the image.
  useEffect(() => {
    console.log('[AR RETURN FIX] Checking if image restoration needed...', {
      isArModeActive,
      isLiveARModeActive,
      hasCurrentMeasurementFile: !!currentMeasurementFile,
      currentMeasurementFileName: currentMeasurementFile?.name,
      hasOriginalImageSrc: !!originalImageSrc,
      currentView
    });
    
    // Only restore if:
    // 1. Not in AR mode anymore
    // 2. We have a measurement file (photo was uploaded)
    // 3. Image sources are missing
    // 4. Not in calibration view
    if (!isArModeActive && !isLiveARModeActive && currentMeasurementFile && !originalImageSrc && currentView === 'SESSION') {
      console.log('[AR RETURN FIX] ⚠️ RESTORING IMAGE SOURCES - originalImageSrc was missing!');
      const objURL = URL.createObjectURL(currentMeasurementFile);
      console.log('[AR RETURN FIX] Created new object URL:', objURL.substring(0, 50) + '...');
      setOriginalImageSrc(objURL);
      setResultImageSrc(objURL);
      console.log('[AR RETURN FIX] ✅ Image sources restored');
    } else {
      console.log('[AR RETURN FIX] ℹ️ No restoration needed');
    }
  }, [isArModeActive, isLiveARModeActive, currentMeasurementFile, originalImageSrc, currentView]);
  
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

    console.log('[IMAGE UPLOAD] 📸 Photo uploaded:', file.name);
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
    console.log('[IMAGE UPLOAD] ✅ File set, waiting for processing useEffect...');
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
  
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Only enable magnifier for point selection states
    const isSelectionState = 
      appStatus === 'ANALYSIS_AWAITING_INITIAL_CLICK' || 
      appStatus === 'ANALYSIS_AWAITING_CANOPY_POINTS' || 
      appStatus === 'ANALYSIS_AWAITING_REFINE_POINTS' || 
      isManualMode(appStatus);

    if (isSelectionState) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      
      // Optimization: Cache rect on down to avoid reflows during move
      const rect = e.currentTarget.getBoundingClientRect();
      dragRectRef.current = rect;
      
      // Check for snap immediately on down
      let isSnapped = false;
      if (appStatus === 'ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS' && dbhGuideRect && imageDimensions) {
          const canvas = e.currentTarget;
          // Use cached rect
          const scaleY = canvas.height / rect.height;
          const canvasClickY = (e.clientY - rect.top) * scaleY;
          const imageClickY = (canvasClickY / canvas.height) * imageDimensions.h;
          
          const guideLineY = dbhGuideRect.y + (dbhGuideRect.height / 2);
          const threshold = imageDimensions.h * 0.05;
          
          if (Math.abs(imageClickY - guideLineY) < threshold) {
              isSnapped = true;
          }
      }
      
      setMagnifierState({ x: e.clientX, y: e.clientY, show: true, isSnapped });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      // Check for snap during drag
      let isSnapped = false;
      if (appStatus === 'ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS' && dbhGuideRect && imageDimensions) {
          const canvas = e.currentTarget;
          // Use cached rect if available, else fallback (should be available during drag)
          const rect = dragRectRef.current || canvas.getBoundingClientRect();
          const scaleY = canvas.height / rect.height;
          const canvasClickY = (e.clientY - rect.top) * scaleY;
          const imageClickY = (canvasClickY / canvas.height) * imageDimensions.h;
          
          const guideLineY = dbhGuideRect.y + (dbhGuideRect.height / 2);
          const threshold = imageDimensions.h * 0.05;
          
          if (Math.abs(imageClickY - guideLineY) < threshold) {
              isSnapped = true;
          }
      }
      
      setMagnifierState({ x: e.clientX, y: e.clientY, show: true, isSnapped });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
      dragRectRef.current = null; // Clear cache
      setMagnifierState(prev => ({ ...prev, show: false, isSnapped: false }));
      
      // Process the click at the final position
      processCanvasClick(e.clientX, e.clientY, e.currentTarget);
    } else {
      // Fallback for simple clicks
      processCanvasClick(e.clientX, e.clientY, e.currentTarget);
    }
  };

  const processCanvasClick = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    setShowInstructionToast(false);
    if (!imageDimensions || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasClickX = (clientX - rect.left) * scaleX;
    const canvasClickY = (clientY - rect.top) * scaleY;
    const imageClickX = (canvasClickX / canvas.width) * imageDimensions.w;
    const imageClickY = (canvasClickY / canvas.height) * imageDimensions.h;
    const clickPoint: Point = { x: Math.round(imageClickX), y: Math.round(imageClickY) };

    if (appStatus === 'ANALYSIS_AWAITING_INITIAL_CLICK') {
        // Step 1: Collect trunk click
        setTransientPoint(clickPoint);
        setAppStatus('ANALYSIS_AWAITING_INITIAL_CLICK_CONFIRMATION');
        setInstructionText("Confirm the trunk point, or undo to select again.");
        setIsPanelOpen(false);
        setShowInstructionToast(true);
    } else if (appStatus === 'ANALYSIS_AWAITING_CANOPY_POINTS') {
        // Step 2: Collect canopy points (help SAM understand tree boundaries)
        const newInitialPoints = [...initialPoints, clickPoint];
        setInitialPoints(newInitialPoints);
        
        if (newInitialPoints.length === 3) {  // 1 trunk + 2 canopy = 3 total
            setAppStatus('ANALYSIS_AWAITING_CANOPY_CONFIRMATION');
            setInstructionText("Review all points. Click OK to analyze, or undo to adjust.");
            setIsPanelOpen(false);
            setShowInstructionToast(true);
        } else if (newInitialPoints.length === 2) {
            // Just collected first canopy point, need one more
            setInstructionText("Good! Now click the second canopy point.");
            setShowInstructionToast(true);
        }
    } else if (appStatus === 'ANALYSIS_AWAITING_REFINE_POINTS') { 
        setRefinePoints(prev => [...prev, clickPoint]);
    } else if (isManualMode(appStatus)) { 
        handleManualPointCollection(clickPoint); 
    }
  };

  const handleConfirmInitialClick = async () => {
    if (!transientPoint) return;
    
    // Add trunk point to initialPoints and move to canopy collection
    setInitialPoints([transientPoint]);
    setTransientPoint(null);
    setAppStatus('ANALYSIS_AWAITING_CANOPY_POINTS');
    setInstructionText("Great! Now click 2 points on the canopy edges.");
    setIsPanelOpen(false);
    setShowInstructionToast(true);
  };

  const handleConfirmAllInitialPoints = async () => {
    if (initialPoints.length !== 3 || !scaleFactor || !session?.access_token) return;
    
    console.log('[SAM Measurement] 🎯 Starting automatic tree segmentation with multi-point input...');
    console.log('[SAM Measurement] Input parameters:', {
      trunkPoint: initialPoints[0],
      canopyPoint1: initialPoints[1],
      canopyPoint2: initialPoints[2],
      totalPoints: initialPoints.length,
      scaleFactor: scaleFactor,
      distance: parseFloat(distance),
      view: currentView
    });
    
    setIsPanelOpen(true); 
    setInstructionText("Running automatic segmentation with your marked points..."); 
    setAppStatus('ANALYSIS_PROCESSING'); 

    try {
        let response;
        // Use samRefineWithPoints which accepts multiple points for better accuracy
        if (currentView === 'SESSION' && currentMeasurementFile) {
            console.log('[SAM Measurement] Mode: Photo upload with multi-point input');
            response = await samRefineWithPoints(currentMeasurementFile, initialPoints, scaleFactor);
        } else if (currentView === 'COMMUNITY_GROVE' && claimedTree) {
            console.log('[SAM Measurement] Mode: Community Grove with multi-point input');
            // For community grove, we'll need to use the single-point API for now
            // TODO: Backend should support multi-point for URL-based images
            response = await samAutoSegmentFromUrl(claimedTree.image_url!, claimedTree.distance_m!, scaleFactor, initialPoints[0], session.access_token);
        } else {
            throw new Error("Invalid state for auto-segmentation.");
        }

        if (response.status !== 'success') throw new Error(response.message);
        
        console.log('[SAM Measurement] ✅ Segmentation complete with multi-point input!');
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
        setInitialPoints([]);
    }
  };
  
  const onCalibrationComplete = (newFovRatio: number) => {
    setFovRatio(newFovRatio);
    localStorage.setItem(CAMERA_FOV_RATIO_KEY, newFovRatio.toString());
    // --- START: SURGICAL UPDATE ---
    // Also save to the new "Top Engineering" key to ensure it is picked up by calculateScaleFactor
    // V2 MIGRATION: We renamed this to _v2 to flush old/bad calibrations from before the 4:3 fix.
    localStorage.setItem('device_calibration_factor_v2', newFovRatio.toString());
    console.log('[App] Saved new calibration factor to device_calibration_factor_v2:', newFovRatio);
    // --- END: SURGICAL UPDATE ---
    setCurrentView('SESSION');

    if (pendingTreeFile) {
      // CRITICAL FIX: Restore image sources when returning from calibration
      // This ensures the tree photo is visible again after calibration view
      const objURL = URL.createObjectURL(pendingTreeFile);
      setOriginalImageSrc(objURL);
      setResultImageSrc(objURL);
      
      setCurrentMeasurementFile(pendingTreeFile);
      // --- START: SURGICAL FIX ---
      // Skip 'SESSION_PROCESSING_PHOTO' to avoid re-triggering EXIF check loop.
      // We have calibration now, so go straight to distance entry.
      setAppStatus('SESSION_AWAITING_DISTANCE');
      setIsPanelOpen(true); // Ensure panel is open so user sees the distance input
      setInstructionText("Calibration saved! Now enter the distance to the tree.");
      // --- END: SURGICAL FIX ---
    } else {
      setAppStatus('SESSION_AWAITING_PHOTO');
      setInstructionText("Calibration complete! Please re-select your photo to begin.");
    }
  };

  const prepareMeasurementSession = (): number | null => {
    console.log('[Scale Factor] 📐 Calculating scale factor for measurement session...');
    
    const distForCalcRaw = currentView === 'COMMUNITY_GROVE' ? claimedTree?.distance_m : parseFloat(distance);
    const dims = imageDimensions;
    
    console.log('[Scale Factor] Input data:', {
      distanceRaw: distForCalcRaw,
      imageDimensions: dims,
      view: currentView
    });
    
    if (!distForCalcRaw || !dims) {
        console.error('[Scale Factor] ❌ Missing required data:', {
          distance: distForCalcRaw,
          dimensions: dims
        });
        setErrorMessage("Missing distance or image dimensions.");
        return null;
    }

    // --- START: DISTANCE CORRECTION ---
    // NOTE: We are keeping the confidence UI, but disabling the "hardcoded" correction
    // because we are moving to a robust Calibration Factor approach.
    // The user correctly pointed out that hardcoding 0.018 is not device-agnostic.
    const distForCalc = distForCalcRaw; // Trust the raw distance for now, rely on Calibration Factor
    // --- END: DISTANCE CORRECTION ---

    let cameraConstant: number | null = null;
    let calibrationSource: string = 'none';

    // Priority 0: User-Specific Device Calibration (The "Top Engineering" Solution)
    // V2 MIGRATION: We check _v2 to ensure we don't use old/bad calibrations.
    const savedCalibration = localStorage.getItem('device_calibration_factor_v2');
    if (savedCalibration) {
        cameraConstant = parseFloat(savedCalibration);
        calibrationSource = 'device_calibration_storage_v2';
        console.log('[Scale Factor] ✅ Using SAVED DEVICE CALIBRATION (V2)');
        console.log('[Scale Factor] This overrides EXIF and handles device-specific sensor geometry.');
        console.log('[Scale Factor] Calibration Factor (K):', cameraConstant);
    }
    // Priority 1: Focal length (from EXIF or Tier 2)
    else if (focalLength) {
        // CORRECTION: Universal 4:3 Sensor Geometry Fix (See AR_MARKET_VALIDATION.md)
        // Standard 35mm film is 36mm wide (3:2), but smartphones are 4:3.
        // Effective sensor width for 4:3 is ~34.616mm.
        const SENSOR_WIDTH_MM = 34.616;
        cameraConstant = SENSOR_WIDTH_MM / focalLength;
        calibrationSource = 'focal_length_smartphone_corrected';
        console.log('[Scale Factor] ✅ Using focal length calibration (Sensor Corrected)');
        console.log('[Scale Factor] Focal length:', focalLength, 'mm (35mm equivalent)');
        console.log('[Scale Factor] Sensor Width:', SENSOR_WIDTH_MM, 'mm (4:3 Standard)');
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
        // Instead of forcing calibration immediately, we might want to warn the user
        // But for now, let's default to a standard wide angle if absolutely nothing else exists
        // to prevent crash, but warn heavily.
        console.warn('[Scale Factor] Fallback to generic wide angle (approx 26mm equiv)');
        cameraConstant = 36.0 / 26.0; 
        calibrationSource = 'fallback_generic';
        setErrorMessage("Warning: Uncalibrated Device. Results may be 5-10% off. Please calibrate in Settings.");
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
  
  const handleStartAutoMeasurement = () => { if (prepareMeasurementSession()) { setAppStatus('ANALYSIS_AWAITING_INITIAL_CLICK'); setIsPanelOpen(false); setInstructionText("Tap the main trunk of the tree (1 point) to begin."); setShowInstructionToast(true); } };
  
  const handleStartManualMeasurement = () => { 
      const imageToUse = currentView === 'COMMUNITY_GROVE' ? claimedTree?.image_url : originalImageSrc;
      if (prepareMeasurementSession() && imageToUse) { 
          setMaskGenerated(false);
          setResultImageSrc(imageToUse); setCurrentMetrics(null); setDbhLine(null); setRefinePoints([]); 
          setAppStatus('ANALYSIS_MANUAL_AWAITING_BASE_CLICK'); setIsPanelOpen(false); setInstructionText("Manual Mode: Click the exact base of the tree trunk (1 point)."); setShowInstructionToast(true); 
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
  const handleCalculateManual = async () => { 
      try { 
          setAppStatus('ANALYSIS_PROCESSING'); 
          setIsPanelOpen(true); 
          setInstructionText("Calculating manual results..."); 
          
          // --- MULTI-SEGMENT GIRTH LOGIC ---
          // If we have more than 2 girth points (multi-stem), we need to sum the widths
          // and send a "proxy" pair of points that represents the total width.
          let finalGirthPoints = manualPoints.girth;
          
          if (manualPoints.girth.length > 2) {
              let totalWidthPixels = 0;
              // Iterate in pairs (0-1, 2-3, etc.)
              for (let i = 0; i < manualPoints.girth.length - 1; i += 2) {
                  const p1 = manualPoints.girth[i];
                  const p2 = manualPoints.girth[i+1];
                  // Calculate horizontal width of this segment
                  totalWidthPixels += Math.abs(p2.x - p1.x);
              }
              
              console.log(`[Manual Calc] Multi-segment girth detected. Total width: ${totalWidthPixels}px from ${manualPoints.girth.length} points.`);
              
              // Create two virtual points separated by totalWidthPixels
              // We'll place them at (0,0) and (totalWidth, 0) just for the calculation
              finalGirthPoints = [
                  { x: 0, y: 0 },
                  { x: totalWidthPixels, y: 0 }
              ];
          }
          
          const response = await manualCalculation(manualPoints.height, manualPoints.canopy, finalGirthPoints, scaleFactor!); 
          if (response.status !== 'success') throw new Error(response.message); 
          setManualPoints({ height: [], canopy: [], girth: [] }); 
          setDbhGuideRect(null); 
          handleMeasurementSuccess(response.metrics); 
      } catch(error: any) { 
          setAppStatus('ERROR'); 
          setErrorMessage(error.message); 
      } 
  };
  
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
      
      // --- LIVE MAP SYNC ---
      // Push to Supabase for real-time visualization on the Mission Map
      if (currentLocation?.lat && currentLocation?.lng && user?.id) {
        try {
          await supabase.from('mapped_trees').insert({
            user_id: user.id,
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            species_name: currentIdentification?.bestMatch?.scientificName || 'Unknown',
            height_m: currentMetrics.height_m,
            dbh_cm: currentMetrics.dbh_cm,
            status: 'verified'
          });
        } catch (err) {
          console.error("Failed to sync to live map:", err);
          // Non-blocking error
        }
      }
      // ---------------------

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
    // Show the modal instead of submitting immediately
    setShowSpeciesDetailModal(true);
  };

  const handleConfirmCommunitySubmit = async (closeupFile: File | null, organ: string | null) => {
    setShowSpeciesDetailModal(false);
    setAppStatus('ANALYSIS_SAVING');
    setInstructionText("Submitting tree for community analysis...");

    const calculatedScaleFactor = prepareMeasurementSession();
    if (!calculatedScaleFactor) {
      setAppStatus('ERROR');
      return;
    }
    
    try {
      await quickCapture(
        currentMeasurementFile!,
        parseFloat(distance),
        calculatedScaleFactor,
        capturedHeading, 
        userGeoLocation!.lat,
        userGeoLocation!.lng,
        session!.access_token,
        closeupFile || undefined,
        organ || undefined
      );
      
      const updatedResults = await getResults(session!.access_token);
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

  // NEW: Navigate to Community Grove and auto-select a specific tree for analysis
  const handleAnalyzePendingTree = async (treeId: string) => {
    if (!session?.access_token) return;
    
    // First navigate to Community Grove
    setCurrentView('COMMUNITY_GROVE');
    setAppStatus('COMMUNITY_GROVE_LOADING');
    setInstructionText("Loading tree for analysis...");
    
    try {
      // Fetch all pending trees
      const trees = await getPendingTrees(session.access_token);
      setPendingTrees(trees);
      
      // Auto-claim the specific tree
      setAppStatus('ANALYSIS_PROCESSING');
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
        setInstructionText(`Tree ready for analysis. Select a measurement mode to begin.`);
      };
      img.onerror = () => { throw new Error("Could not load tree image."); }
    } catch(e: any) {
      setErrorMessage(`Failed to load tree: ${e.message}`);
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
      const isOwner = user?.id === claimedTree.user_id;
      const payload: CommunityAnalysisPayload = {
        metrics: currentMetrics,
        species: currentIdentification?.bestMatch,
        ...additionalData,
        force_complete: isOwner, // If owner, request immediate completion
      };
      await submitCommunityAnalysis(claimedTree.id, payload, session.access_token);
      
      if (isOwner) {
          setInstructionText("✅ Analysis complete! Your tree has been updated.");
          // Refresh results so it appears in "Your Mapped Trees" immediately
          const updatedResults = await getResults(session.access_token);
          setAllResults(updatedResults);
      } else {
          setInstructionText("✅ Analysis submitted! Thank you for contributing.");
      }
      
      softReset();
    } catch(e: any) {
      setErrorMessage(e.message);
      setAppStatus('ANALYSIS_COMPLETE');
    }
  };


  const softReset = () => {
    clearSession(); // Clear persisted session
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
    setInitialPoints([]);
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
    setExpandedSections({ measurements: true, species: false, location: false, additionalDetails: false });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleManualPointCollection = async (point: Point) => { 
    if (!scaleFactor || !imageDimensions) return;
    const showNextInstruction = (text: string) => { setInstructionText(text); setShowInstructionToast(true); };
    if (appStatus === 'ANALYSIS_MANUAL_AWAITING_BASE_CLICK') {
      try { 
          const response = await manualGetDbhRectangle(point, scaleFactor, imageDimensions.w, imageDimensions.h); 
          setDbhGuideRect(response.rectangle_coords); 
          
          // AUTO-ADD BASE POINT: User just clicked the base, so let's use it as the first Height point
          setManualPoints(prev => ({ ...prev, height: [point] }));
          
          setAppStatus('ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS'); 
          showNextInstruction("STEP 1/3 (Height): Base set. Now click the TOP of the tree."); 
      } catch (error: any) { 
          setAppStatus('ERROR'); 
          setErrorMessage(error.message); 
      }
    } else if (appStatus === 'ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS') {
      setManualPoints(p => { const h = [...p.height, point]; if (h.length === 2) { setAppStatus('ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS'); showNextInstruction("STEP 2/3 (Canopy): Click 2 points on the canopy edges."); } return {...p, height: h}; }); 
    } else if (appStatus === 'ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS') {
      setManualPoints(p => { const c = [...p.canopy, point]; if (c.length === 2) { setAppStatus('ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS'); showNextInstruction("STEP 3/3 (Girth): Click 2 points on the Cyan Magnetic Band. The crosshair will snap green when locked on."); } return {...p, canopy: c}; }); 
    } else if (appStatus === 'ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS' || appStatus === 'ANALYSIS_MANUAL_AWAITING_CONFIRMATION') {
      // --- SNAP TO GUIDE LINE LOGIC ---
      let finalPoint = point;
      if (dbhGuideRect) {
          // Calculate the Y-coordinate of the guide line center
          // dbhGuideRect.y is the top-left Y. The line is at y + height/2
          const guideLineY = dbhGuideRect.y + (dbhGuideRect.height / 2);
          
          // Check if click is within a reasonable threshold (e.g., 5% of image height)
          const threshold = imageDimensions.h * 0.05;
          if (Math.abs(point.y - guideLineY) < threshold) {
              // SNAP!
              finalPoint = { x: point.x, y: guideLineY };
              console.log('⚡ Snapped point to DBH guide line!');
          }
      }

      setManualPoints(p => { 
          const g = [...p.girth, finalPoint]; 
          // Allow multiple pairs (2, 4, 6...)
          // If we have an even number of points, we *could* be done, but let user decide.
          // We'll update the instruction to indicate they can add more or finish.
          if (g.length >= 2 && g.length % 2 === 0) { 
              setAppStatus('ANALYSIS_MANUAL_AWAITING_CONFIRMATION'); 
              setInstructionText("Trunk segment added. Add more segments (for forked trees) or click 'Calculate'."); 
              // Panel should NOT open automatically here. User must click Calculate manually.
              setShowInstructionToast(true); 
          } else {
              // Odd number of points - waiting for the second point of the pair
              setAppStatus('ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS');
              showNextInstruction("Click the other side of this trunk segment.");
          }
          return {...p, girth: g}; 
      }); 
    }
  };

  const handleConfirmManualPoints = () => {
    setAppStatus('ANALYSIS_MANUAL_READY_TO_CALCULATE');
    setIsPanelOpen(true);
    setInstructionText("All points collected. Click 'Calculate'.");
  };

  const handleUndo = () => {
    switch (appStatus) {
      case 'ANALYSIS_AWAITING_INITIAL_CLICK_CONFIRMATION':
        setTransientPoint(null);
        setAppStatus('ANALYSIS_AWAITING_INITIAL_CLICK');
        setInstructionText("Tap the main trunk of the tree to begin.");
        setShowInstructionToast(true);
        break;
      
      case 'ANALYSIS_AWAITING_CANOPY_POINTS':
        if (initialPoints.length > 1) {
          // Remove last canopy point
          setInitialPoints(prev => prev.slice(0, -1));
          setInstructionText("Click 2 points on the canopy edges.");
          setShowInstructionToast(true);
        } else {
          // Go back to trunk confirmation
          setTransientPoint(initialPoints[0]);
          setInitialPoints([]);
          setAppStatus('ANALYSIS_AWAITING_INITIAL_CLICK_CONFIRMATION');
          setInstructionText("Confirm the trunk point, or undo to select again.");
          setShowInstructionToast(true);
        }
        break;

      case 'ANALYSIS_AWAITING_CANOPY_CONFIRMATION':
        // Remove last canopy point and go back to collecting
        setInitialPoints(prev => prev.slice(0, -1));
        setAppStatus('ANALYSIS_AWAITING_CANOPY_POINTS');
        setInstructionText("Click 2 points on the canopy edges.");
        setShowInstructionToast(true);
        break;
      
      case 'ANALYSIS_AWAITING_REFINE_POINTS':
        setRefinePoints(p => p.slice(0, -1));
        break;

      case 'ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS':
        // We are here because we have 1 point (Base). Waiting for Top.
        // Undo should clear Base and go back to BASE_CLICK state immediately.
        setManualPoints(p => ({ ...p, height: [] }));
        setDbhGuideRect(null);
        setAppStatus('ANALYSIS_MANUAL_AWAITING_BASE_CLICK');
        setInstructionText("Manual Mode: Click the exact base of the tree trunk (1 point).");
        setShowInstructionToast(true);
        break;
      
      case 'ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS':
        if (manualPoints.canopy.length > 0) {
          setManualPoints(p => ({ ...p, canopy: p.canopy.slice(0, -1) }));
          setInstructionText("STEP 2/3 (Canopy): Click 2 points on the canopy edges.");
        } else {
          // Go back to Height, remove the 2nd height point
          setAppStatus('ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS');
          setManualPoints(p => ({ ...p, height: p.height.slice(0, -1) }));
          setInstructionText("STEP 1/3 (Height): Base set. Now click the TOP of the tree.");
        }
        break;
      
      case 'ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS':
        if (manualPoints.girth.length > 0) {
          setManualPoints(p => ({ ...p, girth: p.girth.slice(0, -1) }));
          setInstructionText("STEP 3/3 (Girth): Click 2 points on the Cyan Magnetic Band.");
        } else {
          // Go back to Canopy, remove the 2nd canopy point
          setAppStatus('ANALYSIS_MANUAL_AWAITING_CANOPY_POINTS');
          setManualPoints(p => ({ ...p, canopy: p.canopy.slice(0, -1) }));
          setInstructionText("STEP 2/3 (Canopy): Click 2 points on the canopy edges.");
        }
        break;

      case 'ANALYSIS_MANUAL_AWAITING_CONFIRMATION':
        setManualPoints(p => ({ ...p, girth: p.girth.slice(0, -1) }));
        setAppStatus('ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS');
        setInstructionText("STEP 3/3 (Girth): Click the other side of this trunk segment.");
        break;

      case 'ANALYSIS_MANUAL_READY_TO_CALCULATE':
        setAppStatus('ANALYSIS_MANUAL_AWAITING_GIRTH_POINTS');
        setInstructionText("STEP 3/3 (Girth): Click 2 points on the Cyan Magnetic Band.");
        setManualPoints(p => ({ ...p, girth: p.girth.slice(0, -1) }));
        break;
    }
  };

  const handleDistanceEntered = (measuredDistanceOverride?: number) => {
    const actualDistance = measuredDistanceOverride?.toFixed(2) || distance;
    console.log('[Distance Entry] 📏 User entered distance:', actualDistance, 'meters');
    console.log('[Distance Entry] measuredDistanceOverride:', measuredDistanceOverride);
    console.log('[Distance Entry] distance state:', distance);
    console.log('[Distance Entry] Current calibration status:', {
      focalLength: focalLength,
      fovRatio: fovRatio,
      hasCalibration: !!(focalLength || fovRatio)
    });
    console.log('[Distance Entry] 🖼️ Image sources status:', {
      originalImageSrc: originalImageSrc ? 'SET (' + originalImageSrc.substring(0, 30) + '...)' : 'EMPTY',
      resultImageSrc: resultImageSrc ? 'SET (' + resultImageSrc.substring(0, 30) + '...)' : 'EMPTY',
      currentMeasurementFile: currentMeasurementFile?.name || 'NONE'
    });
    console.log('[Distance Entry] Proceeding to analysis choice...');
    
    // If we have an override distance from AR, set it in state
    if (measuredDistanceOverride !== undefined) {
      setDistance(actualDistance);
    }
    
    setAppStatus('SESSION_AWAITING_ANALYSIS_CHOICE');
    setInstructionText("Choose how you want to proceed with the analysis.");
  }

  const handleConfirmLocation = (location: LocationData) => { setCurrentLocation(location); setIsLocationPickerActive(false); };
  
  if (currentView === 'CALIBRATION') { return <CalibrationView onCalibrationComplete={onCalibrationComplete} />; }
  if (currentView === 'LEADERBOARD') { return <LeaderboardView onBack={() => setCurrentView('HUB')} />; }
  if (currentView === 'TRAINING') { return <TrainingHub onBack={() => setCurrentView('HUB')} />; }
  if (currentView === 'MISSIONS') { return <MissionsView onBack={() => setCurrentView('HUB')} />; }
  if (currentView === 'COMMUNITY_GROVE' && !claimedTree) { return <CommunityGroveView pendingTrees={pendingTrees} isLoading={appStatus === 'COMMUNITY_GROVE_LOADING' || appStatus === 'ANALYSIS_PROCESSING'} onClaimTree={handleClaimTree} onBack={handleReturnToHub} currentUserId={user?.id} /> }

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
      <button 
        onClick={() => setIsPanelOpen(true)} 
        className={`fixed right-6 z-50 p-4 bg-brand-primary text-content-on-brand rounded-full shadow-2xl hover:bg-brand-primary-hover active:scale-95 transition-all duration-200 flex items-center gap-2 ${magnifierState.show ? 'opacity-10' : 'opacity-100'}`}
        style={{
          // CRITICAL FIX: Multi-layer mobile browser UI safety (same as FloatingInteractionControls)
          bottom: 'max(80px, calc(1.5rem + env(safe-area-inset-bottom, 0px)))',
        }}
      > 
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
      console.log('[AR MODE] 🎯 AR Mode is ACTIVE - rendering ARMeasureView');
      return (
        <ARMeasureView
          onDistanceMeasured={(measuredDistance) => {
            console.log('[AR MODE] ✅ Distance measured:', measuredDistance, 'meters');
            console.log('[AR MODE] 🖼️ Image sources BEFORE handleDistanceEntered:', {
              originalImageSrc: originalImageSrc ? 'SET' : 'EMPTY',
              resultImageSrc: resultImageSrc ? 'SET' : 'EMPTY',
              currentMeasurementFile: currentMeasurementFile?.name || 'NONE'
            });
            setIsArModeActive(false);
            // CRITICAL FIX: Pass measured distance directly to avoid React state sync issues
            handleDistanceEntered(measuredDistance);
          }}
          onCancel={() => {
            console.log('[AR MODE] ❌ AR measurement cancelled');
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
            originalImageSrc && (
              <>
                <canvas 
                  ref={canvasRef} 
                  id="image-canvas" 
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={`max-w-full max-h-full touch-none ${appStatus.includes('AWAITING_CLICK') || appStatus.includes('AWAITING_POINTS') ? 'cursor-crosshair' : ''}`} 
                />
                {magnifierState.show && (
                  <Magnifier 
                    x={magnifierState.x} 
                    y={magnifierState.y} 
                    imageSrc={originalImageSrc} 
                    canvas={canvasRef.current}
                    isSnapped={magnifierState.isSnapped}
                  />
                )}
              </>
            )
          )}
          {(!isPanelOpen || window.innerWidth >= 768) && (appStatus === 'ANALYSIS_AWAITING_REFINE_POINTS' || 
            appStatus === 'ANALYSIS_AWAITING_INITIAL_CLICK_CONFIRMATION' ||
            appStatus === 'ANALYSIS_AWAITING_CANOPY_POINTS' ||
            appStatus === 'ANALYSIS_AWAITING_CANOPY_CONFIRMATION' ||
            isManualMode(appStatus)) && (
            <FloatingInteractionControls 
              onUndo={handleUndo}
              onConfirm={
                appStatus === 'ANALYSIS_AWAITING_INITIAL_CLICK_CONFIRMATION' 
                  ? handleConfirmInitialClick 
                  : appStatus === 'ANALYSIS_AWAITING_CANOPY_CONFIRMATION'
                  ? handleConfirmAllInitialPoints
                  : appStatus === 'ANALYSIS_MANUAL_AWAITING_CONFIRMATION'
                  ? handleConfirmManualPoints
                  : handleApplyRefinements
              }
              showConfirm={
                appStatus === 'ANALYSIS_AWAITING_REFINE_POINTS' || 
                appStatus === 'ANALYSIS_AWAITING_INITIAL_CLICK_CONFIRMATION' ||
                appStatus === 'ANALYSIS_AWAITING_CANOPY_CONFIRMATION' ||
                appStatus === 'ANALYSIS_MANUAL_AWAITING_CONFIRMATION'
              }
              undoDisabled={
                (appStatus === 'ANALYSIS_AWAITING_REFINE_POINTS' && refinePoints.length === 0) ||
                (appStatus === 'ANALYSIS_MANUAL_AWAITING_BASE_CLICK') ||
                (appStatus === 'ANALYSIS_AWAITING_CANOPY_POINTS' && initialPoints.length <= 1) ||
                (isManualMode(appStatus) && 
                 appStatus !== 'ANALYSIS_MANUAL_AWAITING_HEIGHT_POINTS' && 
                 manualPoints.height.length === 0 && 
                 manualPoints.canopy.length === 0 && 
                 manualPoints.girth.length === 0)
              }
              confirmDisabled={
                (refinePoints.length === 0 && appStatus === 'ANALYSIS_AWAITING_REFINE_POINTS') ||
                (initialPoints.length !== 3 && appStatus === 'ANALYSIS_AWAITING_CANOPY_CONFIRMATION')
              }
              isInteracting={magnifierState.show}
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
            
            {/* Interactive Quiz - Shows during SAM processing */}
            {(appStatus === 'ANALYSIS_PROCESSING' || appStatus === 'SESSION_PROCESSING_PHOTO') && (
              <ProcessingQuizModal
                isOpen={true}
                estimatedSeconds={50}
                title={
                  appStatus === 'ANALYSIS_PROCESSING' 
                    ? 'Processing Tree Measurements' 
                    : 'Analyzing Photo'
                }
              />
            )}
            
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
                
                <h3 className="text-lg font-bold text-content-default mb-4">Distance from Camera to Tree Base</h3>

                {/* Platform-specific compatibility notes */}
                {(() => {
                  const ua = navigator.userAgent;
                  const isIOS = /iPad|iPhone|iPod/.test(ua);
                  const isAndroid = /Android/.test(ua);
                  
                  if (isIOS) {
                    return (
                      <div className="mb-6 space-y-4">
                        <div className="flex items-center justify-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                           {/* Visual Diagram */}
                           <div className="flex items-center gap-4 text-blue-800 dark:text-blue-200">
                              <User className="w-8 h-8" />
                              <div className="flex flex-col items-center">
                                <ArrowRight className="w-6 h-6" />
                                <span className="text-xs font-mono font-bold">DISTANCE</span>
                              </div>
                              <TreeDeciduous className="w-8 h-8" />
                           </div>
                        </div>
                        
                        <div className="p-4 bg-background-subtle rounded-lg border border-stroke-subtle">
                           <h4 className="font-semibold text-content-default mb-2 flex items-center gap-2">
                             <Info className="w-4 h-4 text-brand-primary" />
                             How to Measure
                           </h4>
                           <ol className="text-sm text-content-default space-y-2 list-decimal ml-4">
                             <li>Open the <strong>Measure</strong> app on your iPhone.</li>
                             <li>Tap points at your feet and the tree's base.</li>
                             <li>Enter the number below.</li>
                           </ol>
                        </div>

                        <a 
                          href="https://apps.apple.com/us/app/measure/id1383426740" 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-content-default text-background-default rounded-lg font-semibold hover:opacity-90 transition-opacity"
                        >
                          <Ruler className="w-5 h-5" />
                          Open iPhone Measure App
                        </a>
                      </div>
                    );
                  } else if (isAndroid) {
                    return (
                      <div className="mb-6 space-y-4">
                         <div className="flex items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
                           {/* Visual Diagram */}
                           <div className="flex items-center gap-4 text-green-800 dark:text-green-200">
                              <User className="w-8 h-8" />
                              <div className="flex flex-col items-center">
                                <ArrowRight className="w-6 h-6" />
                                <span className="text-xs font-mono font-bold">DISTANCE</span>
                              </div>
                              <TreeDeciduous className="w-8 h-8" />
                           </div>
                        </div>

                         {/* Android AR Button */}
                         <button 
                            onClick={() => setIsArModeActive(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-brand-accent text-white rounded-xl font-bold text-lg hover:bg-brand-accent-hover shadow-lg transition-all"
                         >
                            <Sparkles className="w-5 h-5" />
                            Measure with AR (Beta)
                         </button>
                         <p className="text-xs text-center text-content-subtle">
                           Uses WebXR. Auto-fills distance upon completion.
                         </p>
                      </div>
                    );
                  }
                  return null;
                })()}
                {/* --- END: AR RULER WITH PLATFORM DETECTION --- */}

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-stroke-default"></div>
                    </div>
                    <div className="relative flex justify-center">
                        <span className="px-2 bg-background-default text-sm text-content-subtle">OR ENTER MANUALLY</span>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <label htmlFor="distance-input" className="block text-sm font-bold text-content-default">
                        Enter Distance (meters)
                    </label>
                    <div className="relative">
                        <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-subtle" />
                        <input 
                            type="number" 
                            id="distance-input" 
                            placeholder="e.g., 10.5" 
                            value={distance} 
                            onChange={(e) => setDistance(e.target.value)} 
                            className="w-full pl-10 pr-12 py-3 border rounded-lg bg-background-default border-stroke-default focus:ring-2 focus:ring-brand-primary font-mono text-lg" 
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-content-subtle font-medium">meters</span>
                    </div>
                    <p className="text-xs text-content-subtle">
                        Measure from where you are standing to the trunk of the tree.
                    </p>
                </div>
                <ARLinks />
                <button onClick={() => handleDistanceEntered()} disabled={!distance} className="w-full mt-4 px-6 py-3 bg-brand-primary text-white font-semibold hover:bg-brand-primary-hover disabled:bg-background-inset disabled:text-content-subtle">
                  Continue
                </button>
              </div>
            )}
            
            {appStatus === 'SESSION_AWAITING_CALIBRATION_CHOICE' && (
              <div className="space-y-4 pt-4 border-t border-stroke-subtle">
                <h3 className="text-base font-semibold text-center text-content-default">Saved Calibration Found</h3>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                    We found a saved calibration profile for this device.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
                    <Check className="w-4 h-4" />
                    <span>Ready to use</span>
                  </div>
                </div>

                <button 
                  onClick={() => { 
                    setAppStatus('SESSION_AWAITING_DISTANCE'); 
                    setIsPanelOpen(true); 
                    setInstructionText("Using saved calibration. Please enter the distance."); 
                  }}
                  className="w-full text-left p-4 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-all flex items-center gap-4 shadow-md"
                >
                  <Check className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Continue with Saved Profile</p>
                    <p className="text-xs opacity-80">Use your previous calibration settings.</p>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    // Clear old calibration to ensure a fresh start
                    setFovRatio(null);
                    setFocalLength(null);
                    setCurrentView('CALIBRATION');
                  }}
                  className="w-full text-left p-4 bg-background-subtle text-content-default rounded-lg hover:bg-background-inset transition-all flex items-center gap-4 border border-stroke-default"
                >
                  <RotateCcw className="w-6 h-6 flex-shrink-0 text-content-subtle" />
                  <div>
                    <p className="font-semibold">Redo Calibration</p>
                    <p className="text-xs opacity-80">Re-calibrate if you switched devices or results are off.</p>
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

            {currentMetrics && (appStatus === 'ANALYSIS_COMPLETE') && (
              <div className="space-y-3">
                {/* Measurements Section - Open by default, always has checkmark */}
                <div className="border border-stroke-default rounded-lg overflow-hidden">
                  <button 
                    onClick={() => toggleSection('measurements')} 
                    className="w-full flex items-center justify-between px-4 py-3 bg-background-default hover:bg-background-subtle transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="font-semibold text-content-default">Measurements</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-content-subtle transition-transform ${expandedSections.measurements ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSections.measurements && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-3 bg-background-subtle rounded-lg border border-stroke-subtle">
                          <label className="font-medium text-content-default">Height:</label>
                          <div className="text-right">
                            <span className="font-mono text-lg text-content-default block">{currentMetrics?.height_m?.toFixed(2) ?? '--'} m</span>
                            {heightTolerance && <span className="text-xs text-content-subtle">± {heightTolerance.toFixed(2)} m</span>}
                          </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-background-subtle rounded-lg border border-stroke-subtle">
                          <label className="font-medium text-content-default">Canopy:</label>
                          <div className="text-right">
                            <span className="font-mono text-lg text-content-default block">{currentMetrics?.canopy_m?.toFixed(2) ?? '--'} m</span>
                            {canopyTolerance && <span className="text-xs text-content-subtle">± {canopyTolerance.toFixed(2)} m</span>}
                          </div>
                        </div>
                        <div className="flex justify-between items-start p-3 bg-background-subtle rounded-lg border border-stroke-subtle">
                          <div className="flex items-start gap-2 flex-1">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <label className="font-medium text-content-default whitespace-nowrap">Diameter at Breast Height</label>
                                <div className="relative group">
                                  <Info className="w-4 h-4 text-content-subtle cursor-pointer flex-shrink-0" />
                                  <div className="absolute right-0 bottom-full mb-2 w-64 bg-background-default text-content-default text-xs rounded-lg py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-stroke-default shadow-lg z-10">
                                    Diameter at Breast Height (1.37m or 4.5ft), a standard forestry measurement.
                                    <div className="absolute top-full right-4 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-background-default"></div>
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs text-content-subtle">(DBH)</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-lg text-content-default block">{currentMetrics?.dbh_cm?.toFixed(2) ?? '--'} cm</span>
                            {dbhTolerance && <span className="text-xs text-content-subtle">± {dbhTolerance.toFixed(2)} cm</span>}
                          </div>
                        </div>
                      </div>
                      
                      {maskGenerated && (
                        <button 
                          onClick={() => setIsPanelOpen(false)} 
                          className="w-full mt-2 text-sm text-brand-secondary hover:underline"
                        >
                          View Masked Image
                        </button>
                      )}
                      <div className="grid grid-cols-2 gap-3 pt-3">
                        {maskGenerated && (
                          <button 
                            onClick={() => { 
                              setIsLocationPickerActive(false); 
                              setAppStatus('ANALYSIS_AWAITING_REFINE_POINTS'); 
                              setIsPanelOpen(false); 
                              setInstructionText("Click points to fix the tree's outline."); 
                              setShowInstructionToast(true); 
                            }} 
                            className="px-4 py-2 bg-brand-secondary text-white rounded-lg hover:bg-brand-secondary-hover text-sm"
                          >
                            Correct Outline
                          </button>
                        )}
                        <button 
                          onClick={() => { 
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
                          }} 
                          className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent-hover text-sm"
                        >
                          Restart in Manual
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Species Section - Checkmark when identified */}
                <div className="border border-stroke-default rounded-lg overflow-hidden">
                  <button 
                    onClick={() => toggleSection('species')} 
                    className="w-full flex items-center justify-between px-4 py-3 bg-background-default hover:bg-background-subtle transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {currentIdentification ? (
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-stroke-default flex-shrink-0" />
                      )}
                      <span className="font-semibold text-content-default">Species Identification</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-content-subtle transition-transform ${expandedSections.species ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSections.species && (
                    <div className="px-4 pb-4">
                      <SpeciesIdentifier 
                        onIdentificationComplete={setCurrentIdentification} 
                        onClear={() => setCurrentIdentification(null)} 
                        existingResult={currentIdentification} 
                        mainImageFile={currentMeasurementFile} 
                        mainImageSrc={originalImageSrc} 
                        analysisMode={currentView === 'COMMUNITY_GROVE' ? 'community' : 'session'}
                        co2Value={currentCO2}
                        tolerance={co2Tolerance}
                        isCO2Loading={isCO2Calculating}
                        closeupImageUrl={currentView === 'COMMUNITY_GROVE' ? claimedTree?.species_detail_image_url : undefined}
                        closeupOrgan={currentView === 'COMMUNITY_GROVE' ? claimedTree?.species_detail_organ : undefined}
                      />
                    </div>
                  )}
                </div>

                {/* Location Section - Checkmark when set, Warning if no compass */}
                {currentView === 'SESSION' && (
                  <div className="border border-stroke-default rounded-lg overflow-hidden">
                    <button 
                      onClick={() => toggleSection('location')} 
                      className="w-full flex items-center justify-between px-4 py-3 bg-background-default hover:bg-background-subtle transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {currentLocation ? (
                          prereqStatus.compass === 'GRANTED' ? (
                            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                          )
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-stroke-default flex-shrink-0" />
                        )}
                        <span className="font-semibold text-content-default">Location</span>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-content-subtle transition-transform ${expandedSections.location ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSections.location && (
                      <div className="px-4 pb-4 space-y-3">
                        {currentLocation && prereqStatus.compass !== 'GRANTED' && (
                           <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                              <div className="text-xs text-amber-800 dark:text-amber-200">
                                 <p className="font-bold">Motion Sensors Not Detected</p>
                                 <p>Location accuracy may be lower. Please verify the pin on the map.</p>
                              </div>
                           </div>
                        )}
                        <p className="text-sm text-content-subtle">
                          Location and compass heading are used for precise tree mapping.
                        </p>
                        <button 
                          onClick={() => setIsLocationPickerActive(true)} 
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-background-default border border-stroke-default text-content-default rounded-lg hover:bg-background-subtle"
                        >
                          <MapPin className="w-5 h-5 text-brand-secondary" />
                          {currentLocation ? `Location Set: ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'Add/Edit Location'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Additional Details Section - Checkmark when any field filled */}
                {(currentView === 'SESSION' || currentView === 'COMMUNITY_GROVE') && (
                  <div className="border border-stroke-default rounded-lg overflow-hidden">
                    <button 
                      onClick={() => toggleSection('additionalDetails')} 
                      className="w-full flex items-center justify-between px-4 py-3 bg-background-default hover:bg-background-subtle transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {(additionalData.condition || additionalData.ownership || additionalData.remarks) ? (
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-stroke-default flex-shrink-0" />
                        )}
                        <span className="font-semibold text-content-default">Additional Details <span className="text-xs font-normal text-content-subtle">(Optional)</span></span>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-content-subtle transition-transform ${expandedSections.additionalDetails ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSections.additionalDetails && (
                      <div className="px-4 pb-4">
                        <AdditionalDetailsForm 
                          data={additionalData} 
                          onUpdate={(field, value) => setAdditionalData(prev => ({ ...prev, [field]: value }))} 
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Save/Submit Button */}
                <div className="pt-2">
                  {currentView === 'SESSION' && (
                    <button 
                      onClick={handleSaveResult} 
                      disabled={!currentMetrics || !currentIdentification} 
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-secondary text-content-on-brand rounded-lg font-medium hover:bg-brand-secondary-hover disabled:bg-background-inset disabled:text-content-subtle disabled:cursor-not-allowed"
                    >
                      <Plus className="w-5 h-5" />
                      Save to History
                    </button>
                  )}
                  {currentView === 'COMMUNITY_GROVE' && (
                    <button 
                      onClick={handleSubmitCommunityAnalysis} 
                      disabled={!currentMetrics || !currentIdentification} 
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-secondary text-content-on-brand rounded-lg font-medium hover:bg-brand-secondary-hover disabled:bg-background-inset disabled:text-content-subtle disabled:cursor-not-allowed"
                    >
                      <GitMerge className="w-5 h-5" />
                      Submit Analysis
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </>
    );
  };

  return (
    <div className="h-screen w-screen bg-background-default font-inter flex flex-col md:flex-row overflow-hidden">
      {editingResult && ( <EditResultModal result={editingResult} onClose={() => setEditingResult(null)} onSave={handleUpdateResult} theme={theme} /> )}
      <SpeciesDetailCaptureModal 
        isOpen={showSpeciesDetailModal}
        onClose={() => setShowSpeciesDetailModal(false)}
        onConfirm={handleConfirmCommunitySubmit}
      />
      <InstructionToast 
        message={instructionText} 
        show={showInstructionToast} 
        onClose={() => setShowInstructionToast(false)} 
        isInteracting={magnifierState.show}
      />
      
      {isSessionActive ? renderSessionView() : (
        <div className="w-full flex flex-col h-full">
            <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-stroke-default bg-background-default/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3"><TreePine className="w-7 h-7 text-brand-primary" /><h1 className="text-xl font-semibold text-content-default">Roots</h1></div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setCurrentView('TRAINING')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                  >
                    <GraduationCap size={16} />
                    <span className="hidden sm:inline">Training</span>
                  </button>
                  <AuthComponent profile={userProfile} theme={theme} onThemeToggle={handleThemeToggle} />
                </div>
            </header>
            <main className="flex-grow overflow-y-auto p-4 md:p-6 bg-background-subtle">
              <div className="max-w-4xl mx-auto text-center py-8 md:py-16">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-content-default">Nature's Fingerprints</h1>
                <p className="text-xl text-brand-primary font-medium mt-2">
                  Every tree tells a story
                </p>
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

              <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                  <button onClick={handleNavigateToGrove} className="text-left p-6 bg-background-default border border-stroke-default rounded-lg hover:border-brand-secondary/50 hover:shadow-xl transition-all hover:-translate-y-1">
                      <div className="flex items-center gap-3"><Users className="w-7 h-7 text-brand-secondary"/> <h3 className="text-lg font-semibold text-content-default">Community Grove</h3></div>
                      <p className="text-sm text-content-subtle mt-2">Can't do a full measurement? Help our community by analyzing trees that others have submitted.</p>
                  </button>
                  <button onClick={() => setCurrentView('LEADERBOARD')} className="text-left p-6 bg-background-default border border-stroke-default rounded-lg hover:border-brand-accent/50 hover:shadow-xl transition-all hover:-translate-y-1">
                      <div className="flex items-center gap-3"><BarChart2 className="w-7 h-7 text-brand-accent"/> <h3 className="text-lg font-semibold text-content-default">Leaderboard</h3></div>
                      <p className="text-sm text-content-subtle mt-2">See how your contributions rank. Earn Sapling Points for each tree you map and analyze.</p>
                  </button>
                  <button onClick={() => setCurrentView('MISSIONS')} className="text-left p-6 bg-background-default border border-stroke-default rounded-lg hover:border-blue-500/50 hover:shadow-xl transition-all hover:-translate-y-1">
                      <div className="flex items-center gap-3"><MapPin className="w-7 h-7 text-blue-600"/> <h3 className="text-lg font-semibold text-content-default">Field Missions</h3></div>
                      <p className="text-sm text-content-subtle mt-2">Join a squad or patrol solo. Select street segments to map and earn rewards.</p>
                  </button>
              </div>
              
              {/* YOUR MAPPED TREES - DUAL VIEW */}
              <div className="max-w-7xl mx-auto mt-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-content-default">Your Mapped Trees</h2>
                  <ViewToggle viewMode={viewMode} onViewChange={setViewMode} />
                </div>
                
                {viewMode === 'list' ? (
                  <ResultsTable 
                    results={allResults} 
                    onDeleteResult={handleDeleteResult} 
                    onEditResult={handleOpenEditModal}
                    onAnalyzeTree={handleAnalyzePendingTree}
                    isLoading={isHistoryLoading} 
                  />
                ) : (
                  <TreeMapView 
                    trees={allResults} 
                    onTreeClick={setSelectedTreeForModal}
                    onAnalyzeTree={handleAnalyzePendingTree}
                    theme={theme}
                  />
                )}
              </div>
              
              {/* TREE DETAIL MODAL */}
              <TreeDetailModal 
                tree={selectedTreeForModal}
                onClose={() => setSelectedTreeForModal(null)}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteResult}
                onAnalyze={handleAnalyzePendingTree}
              />
            </main>
        </div>
      )}
    </div>
  );
}

export default App;