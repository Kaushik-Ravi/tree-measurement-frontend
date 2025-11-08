// src/components/live-ar/LiveARPreFlightCheck.tsx
/**
 * Pre-Flight Permissions and Capability Check for Live AR
 * Checks all required permissions and device capabilities before starting AR workflow
 * Loads calibration early to avoid delays later
 */

import { useState, useEffect } from 'react';
import { 
  Camera, MapPin, Compass, Smartphone, CheckCircle2, XCircle, 
  Loader2, AlertCircle, Chrome, Apple, Shield, Sparkles 
} from 'lucide-react';
import type { CameraCalibration } from '../../utils/cameraCalibration';

type PermissionStatus = 'CHECKING' | 'GRANTED' | 'DENIED' | 'BLOCKED' | 'NOT_REQUIRED';

interface LiveARPreFlightCheckProps {
  /** Callback when all checks complete and user confirms */
  onComplete: (result: {
    cameraGranted: boolean;
    locationGranted: boolean;
    arAvailable: boolean;
    motionGranted: boolean;
    calibration: CameraCalibration | null;
  }) => void;
  /** Callback if user cancels */
  onCancel: () => void;
  /** Pre-loaded calibration (optional) */
  existingCalibration?: CameraCalibration | null;
}

interface CheckResults {
  camera: PermissionStatus;
  location: PermissionStatus;
  ar: PermissionStatus;
  motion: PermissionStatus;
  calibration: CameraCalibration | null;
}

// Detect device type and browser
const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);
  const isMobile = isIOS || isAndroid;
  
  return { isIOS, isAndroid, isSafari, isChrome, isMobile };
};

const StatusIcon = ({ status }: { status: PermissionStatus }) => {
  switch (status) {
    case 'GRANTED':
    case 'NOT_REQUIRED':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'DENIED':
    case 'BLOCKED':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'CHECKING':
    default:
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
  }
};

export function LiveARPreFlightCheck({
  onComplete,
  onCancel,
  existingCalibration = null,
}: LiveARPreFlightCheckProps) {
  const [results, setResults] = useState<CheckResults>({
    camera: 'CHECKING',
    location: 'CHECKING',
    ar: 'CHECKING',
    motion: 'CHECKING',
    calibration: existingCalibration,
  });
  
  const [showCameraHelp, setShowCameraHelp] = useState(false);
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [checksStarted, setChecksStarted] = useState(false);
  const deviceInfo = getDeviceInfo();

  // Run permission checks
  useEffect(() => {
    if (checksStarted) return;
    setChecksStarted(true);
    
    const runChecks = async () => {
      const newResults: CheckResults = { ...results };

      // 1. Check Camera Permission (query only, don't request stream)
      try {
        if ('permissions' in navigator) {
          const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          newResults.camera = cameraPermission.state === 'granted' ? 'GRANTED' : 
                             cameraPermission.state === 'denied' ? 'BLOCKED' : 'DENIED';
        } else {
          // Fallback: assume we need to request
          newResults.camera = 'DENIED';
        }
      } catch (err) {
        console.warn('[Pre-Flight] Camera permission check failed:', err);
        newResults.camera = 'DENIED';
      }

      // 2. Check Location Permission
      try {
        if ('permissions' in navigator) {
          const locationPermission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          newResults.location = locationPermission.state === 'granted' ? 'GRANTED' : 
                               locationPermission.state === 'denied' ? 'BLOCKED' : 'DENIED';
        } else {
          newResults.location = 'DENIED';
        }
      } catch (err) {
        console.warn('[Pre-Flight] Location permission check failed:', err);
        newResults.location = 'DENIED';
      }

      // 3. Check AR Capability (WebXR)
      try {
        if ('xr' in navigator && navigator.xr) {
          const supported = await navigator.xr.isSessionSupported('immersive-ar');
          newResults.ar = supported ? 'GRANTED' : 'NOT_REQUIRED';
        } else {
          newResults.ar = 'NOT_REQUIRED'; // Not available, but not required for manual mode
        }
      } catch (err) {
        console.warn('[Pre-Flight] AR capability check failed:', err);
        newResults.ar = 'NOT_REQUIRED';
      }

      // 4. Check Motion Sensors (iOS DeviceOrientation)
      try {
        if (deviceInfo.isIOS && typeof DeviceOrientationEvent !== 'undefined') {
          // On iOS 13+, need to request permission
          if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
            newResults.motion = 'DENIED'; // Will request when user taps button
          } else {
            newResults.motion = 'GRANTED'; // Older iOS or already granted
          }
        } else {
          newResults.motion = 'NOT_REQUIRED'; // Not iOS or not needed
        }
      } catch (err) {
        console.warn('[Pre-Flight] Motion sensor check failed:', err);
        newResults.motion = 'NOT_REQUIRED';
      }

      // 5. Load Calibration (if not already provided)
      if (!newResults.calibration) {
        try {
          const { loadSavedCalibration } = await import('../../utils/cameraCalibration');
          const savedCalibration = loadSavedCalibration();
          if (savedCalibration) {
            console.log('[Pre-Flight] ✅ Loaded saved calibration:', savedCalibration.method);
            newResults.calibration = savedCalibration;
          } else {
            console.log('[Pre-Flight] ⚠️ No saved calibration found');
          }
        } catch (err) {
          console.error('[Pre-Flight] Failed to load calibration:', err);
        }
      }

      setResults(newResults);
      console.log('[Pre-Flight] Check results:', newResults);
    };

    runChecks();
  }, [checksStarted, deviceInfo.isIOS]);

  // Request permissions when user clicks button
  const requestPermissions = async () => {
    const newResults = { ...results };

    // Request Camera Permission
    if (results.camera !== 'GRANTED') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(track => track.stop()); // Immediately release
        newResults.camera = 'GRANTED';
        console.log('[Pre-Flight] ✅ Camera permission granted');
      } catch (err: any) {
        console.error('[Pre-Flight] Camera permission denied:', err);
        newResults.camera = err.name === 'NotAllowedError' ? 'BLOCKED' : 'DENIED';
      }
    }

    // Request Location Permission
    if (results.location !== 'GRANTED') {
      try {
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              newResults.location = 'GRANTED';
              console.log('[Pre-Flight] ✅ Location permission granted');
              resolve();
            },
            (err) => {
              console.error('[Pre-Flight] Location permission denied:', err);
              newResults.location = err.code === 1 ? 'BLOCKED' : 'DENIED';
              reject(err);
            },
            { timeout: 10000 }
          );
        });
      } catch (err) {
        // Already handled in error callback
      }
    }

    // Request Motion Sensors (iOS only)
    if (results.motion === 'DENIED' && deviceInfo.isIOS) {
      try {
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          newResults.motion = permission === 'granted' ? 'GRANTED' : 'BLOCKED';
          console.log('[Pre-Flight] Motion sensor permission:', permission);
        }
      } catch (err) {
        console.error('[Pre-Flight] Motion sensor permission denied:', err);
        newResults.motion = 'BLOCKED';
      }
    }

    setResults(newResults);
  };

  // Check if we can proceed
  const cameraRequired = results.camera === 'GRANTED';
  const locationRequired = results.location === 'GRANTED';
  const canContinue = cameraRequired && locationRequired;
  const allChecked = results.camera !== 'CHECKING' && 
                     results.location !== 'CHECKING' && 
                     results.ar !== 'CHECKING' &&
                     results.motion !== 'CHECKING';

  const handleContinue = () => {
    onComplete({
      cameraGranted: results.camera === 'GRANTED',
      locationGranted: results.location === 'GRANTED',
      arAvailable: results.ar === 'GRANTED',
      motionGranted: results.motion === 'GRANTED' || results.motion === 'NOT_REQUIRED',
      calibration: results.calibration,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-800">
        {/* Header */}
        <header className="sticky top-0 flex items-center gap-3 p-6 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
          <Shield className="w-7 h-7 text-green-500" />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">System Check</h2>
            <p className="text-sm text-gray-400">Preparing Live AR Measurement</p>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6 space-y-5">
          {/* Info Banner */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-300 font-medium mb-1">Why we need these permissions:</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Live AR measurement requires camera access for photo capture, location for GPS tagging, 
                  and AR capability for distance measurement. Your data is private and never shared.
                </p>
              </div>
            </div>
          </div>

          {/* Permission Checks */}
          <div className="space-y-3">
            {/* Camera Permission */}
            <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 pt-1">
                  <Camera className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white">Camera Access</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    <strong className="text-red-400">Required</strong> - Capture photos for tree measurement and analysis
                  </p>
                  {results.calibration && (
                    <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Calibration loaded: {results.calibration.method}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 pt-1">
                  <StatusIcon status={results.camera} />
                </div>
              </div>
              
              {(results.camera === 'DENIED' || results.camera === 'BLOCKED') && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <button 
                    onClick={() => setShowCameraHelp(!showCameraHelp)}
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {showCameraHelp ? 'Hide' : 'Show'} setup instructions
                  </button>
                  
                  {showCameraHelp && (
                    <div className="mt-3 p-3 bg-gray-900 rounded-lg text-xs space-y-2 text-gray-300">
                      <p className="font-semibold text-white">To enable camera access:</p>
                      
                      {deviceInfo.isIOS && (
                        <>
                          <p className="font-medium text-yellow-400 flex items-start gap-2">
                            <Apple className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>iOS (Safari/Chrome):</span>
                          </p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Open iOS <strong>Settings</strong> app</li>
                            <li>Scroll to <strong>{deviceInfo.isSafari ? 'Safari' : 'Chrome'}</strong></li>
                            <li>Tap <strong>Camera</strong></li>
                            <li>Enable camera access</li>
                            <li>Return here and try again</li>
                          </ol>
                        </>
                      )}
                      
                      {deviceInfo.isAndroid && (
                        <>
                          <p className="font-medium text-green-400 flex items-start gap-2">
                            <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>Android:</span>
                          </p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Tap the <strong>🔒 lock icon</strong> in the address bar</li>
                            <li>Tap <strong>"Permissions"</strong> or <strong>"Site settings"</strong></li>
                            <li>Find <strong>"Camera"</strong> and set to <strong>"Allow"</strong></li>
                            <li>Refresh and try again</li>
                          </ol>
                        </>
                      )}
                      
                      {!deviceInfo.isMobile && (
                        <>
                          <p className="font-medium flex items-start gap-2">
                            <Chrome className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>Desktop:</span>
                          </p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Click the <strong>camera icon</strong> in the address bar</li>
                            <li>Select <strong>"Always allow"</strong></li>
                            <li>Refresh the page</li>
                          </ol>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Location Permission */}
            <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 pt-1">
                  <MapPin className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white">Location Access</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    <strong className="text-red-400">Required</strong> - Tag GPS coordinates for mapping
                  </p>
                </div>
                <div className="flex-shrink-0 pt-1">
                  <StatusIcon status={results.location} />
                </div>
              </div>
              
              {(results.location === 'DENIED' || results.location === 'BLOCKED') && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <button 
                    onClick={() => setShowLocationHelp(!showLocationHelp)}
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {showLocationHelp ? 'Hide' : 'Show'} setup instructions
                  </button>
                  
                  {showLocationHelp && (
                    <div className="mt-3 p-3 bg-gray-900 rounded-lg text-xs space-y-2 text-gray-300">
                      <p className="font-semibold text-white">To enable location access:</p>
                      <p className="text-gray-400">Follow the same steps as camera, but select <strong>Location</strong> permission instead.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AR Capability */}
            <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 pt-1">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white">AR Capability (WebXR)</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    <strong className="text-yellow-400">Optional</strong> - Enables AR distance measurement
                  </p>
                  {results.ar === 'NOT_REQUIRED' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Not available - Manual distance input will be used
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 pt-1">
                  <StatusIcon status={results.ar} />
                </div>
              </div>
            </div>

            {/* Motion Sensors */}
            {deviceInfo.isIOS && (
              <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 pt-1">
                    <Compass className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white">Motion & Orientation</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      <strong className="text-yellow-400">Optional</strong> - Improves location accuracy
                    </p>
                  </div>
                  <div className="flex-shrink-0 pt-1">
                    <StatusIcon status={results.motion} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Calibration Status */}
          {results.calibration && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-green-300 font-medium">Camera Calibrated</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Method: <strong>{results.calibration.method}</strong>
                    {results.calibration.focalLength35mm && ` • ${results.calibration.focalLength35mm}mm`}
                    {results.calibration.fovHorizontal && ` • ${results.calibration.fovHorizontal}° FOV`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
        
        {/* Footer */}
        <footer className="sticky bottom-0 flex flex-col gap-3 p-6 border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm">
          {!allChecked && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Checking system capabilities...</span>
            </div>
          )}
          
          {allChecked && !canContinue && (
            <button
              onClick={requestPermissions}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg"
            >
              Grant Required Permissions
            </button>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-gray-800 text-gray-300 rounded-xl font-semibold hover:bg-gray-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              disabled={!canContinue}
              className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {canContinue ? 'Continue to Measurement' : 'Waiting for Permissions'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
