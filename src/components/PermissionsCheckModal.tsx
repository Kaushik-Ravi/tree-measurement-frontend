// src/components/PermissionsCheckModal.tsx
import { useState } from 'react';
import { MapPin, Compass, CheckCircle2, XCircle, Loader2, ShieldQuestion, AlertCircle, Smartphone, Chrome, Apple } from 'lucide-react';

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

interface PermissionsCheckModalProps {
  locationStatus: SensorStatus;
  compassStatus: SensorStatus;
  onRequestPermissions: () => void;
  onConfirm: () => void;
}

const StatusIcon = ({ status }: { status: SensorStatus }) => {
  switch (status) {
    case 'GRANTED':
      return <CheckCircle2 className="w-5 h-5 text-status-success" />;
    case 'DENIED':
    case 'UNAVAILABLE':
    case 'ERROR':
    case 'HTTPS_REQUIRED':
    case 'NOT_SUPPORTED':
      return <XCircle className="w-5 h-5 text-status-error" />;
    case 'TIMEOUT':
      return <AlertCircle className="w-5 h-5 text-status-warning" />;
    case 'CHECKING':
    case 'REQUESTING':
      return <Loader2 className="w-5 h-5 text-content-subtle animate-spin" />;
    case 'NOT_REQUIRED':
      return <CheckCircle2 className="w-5 h-5 text-content-subtle opacity-50" />;
    case 'PENDING':
    default:
      return <AlertCircle className="w-5 h-5 text-content-subtle" />;
  }
};

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

export function PermissionsCheckModal({
  locationStatus,
  compassStatus,
  onRequestPermissions,
  onConfirm,
}: PermissionsCheckModalProps) {
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [showCompassHelp, setShowCompassHelp] = useState(false);
  const deviceInfo = getDeviceInfo();
  
  const canContinue = locationStatus === 'GRANTED';
  const locationNeedsHelp = locationStatus === 'DENIED' || locationStatus === 'UNAVAILABLE' || locationStatus === 'TIMEOUT' || locationStatus === 'ERROR' || locationStatus === 'HTTPS_REQUIRED';

  // --- START: SURGICAL REPLACEMENT (ENHANCED UX) ---
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-down">
      <div className="bg-background-default rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <header className="sticky top-0 flex items-center gap-3 p-4 border-b border-stroke-default bg-background-default">
          <ShieldQuestion className="w-6 h-6 text-brand-secondary" />
          <h2 className="text-lg font-semibold text-content-default">Device Permissions Required</h2>
        </header>

        <main className="p-6 space-y-5">
          <div className="p-4 rounded-lg bg-status-info/10 border border-status-info/20">
            <p className="text-sm text-status-info font-medium mb-2">Why we need permissions:</p>
            <p className="text-xs text-content-subtle leading-relaxed">
              To accurately map and measure trees, this app needs access to your device's sensors. 
              Your location data is <strong>never stored</strong> without your explicit action to save a measurement.
            </p>
          </div>

          <div className="space-y-4">
            {/* Location Permission */}
            <div className="p-4 rounded-lg border border-stroke-default bg-background-subtle">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 pt-1">
                  <MapPin className="w-5 h-5 text-status-error" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-content-default">Location Access</h3>
                  <p className="text-xs text-content-subtle mt-1">
                    <strong>Required</strong> - Automatically tags the tree's GPS coordinates for mapping.
                  </p>
                  {/* Status message based on current state */}
                  {locationStatus === 'CHECKING' && (
                    <p className="text-xs text-brand-primary mt-1 font-medium">🔍 Checking location access...</p>
                  )}
                  {locationStatus === 'REQUESTING' && (
                    <p className="text-xs text-brand-primary mt-1 font-medium animate-pulse">⏳ Please respond to the browser prompt...</p>
                  )}
                  {locationStatus === 'GRANTED' && (
                    <p className="text-xs text-status-success mt-1 font-medium">✓ Location access granted</p>
                  )}
                  {locationStatus === 'DENIED' && (
                    <p className="text-xs text-status-error mt-1 font-medium">✗ Access denied - See instructions below</p>
                  )}
                  {locationStatus === 'UNAVAILABLE' && (
                    <p className="text-xs text-status-warning mt-1 font-medium">⚠ GPS is turned off in device settings</p>
                  )}
                  {locationStatus === 'TIMEOUT' && (
                    <p className="text-xs text-status-warning mt-1 font-medium">⏱ Location request timed out</p>
                  )}
                  {locationStatus === 'HTTPS_REQUIRED' && (
                    <p className="text-xs text-status-error mt-1 font-medium">🔒 HTTPS connection required</p>
                  )}
                  {locationStatus === 'NOT_SUPPORTED' && (
                    <p className="text-xs text-status-error mt-1 font-medium">✗ Browser doesn't support location</p>
                  )}
                </div>
                <div className="flex-shrink-0 pt-1">
                  <StatusIcon status={locationStatus} />
                </div>
              </div>
              
              {locationNeedsHelp && (
                <div className="mt-3 pt-3 border-t border-stroke-default">
                  <button 
                    onClick={() => setShowLocationHelp(!showLocationHelp)}
                    className="flex items-center gap-2 text-sm text-brand-primary hover:underline font-medium"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {showLocationHelp ? 'Hide' : 'Show'} setup instructions
                  </button>
                  
                  {showLocationHelp && (
                    <div className="mt-3 p-3 bg-background-default rounded-lg text-xs space-y-2 text-content-subtle">
                      <p className="font-semibold text-content-default">To enable location access:</p>
                      
                      {deviceInfo.isIOS && (
                        <>
                          <p className="font-medium text-status-warning flex items-start gap-2">
                            <Apple className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>iOS (Safari/Chrome):</span>
                          </p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Open iOS <strong>Settings</strong> app</li>
                            <li>Scroll to <strong>{deviceInfo.isSafari ? 'Safari' : 'Chrome'}</strong></li>
                            <li>Tap <strong>Location</strong></li>
                            <li>Select <strong>"While Using the App"</strong> or <strong>"Always"</strong></li>
                            <li>Return here and tap "Grant Permissions" again</li>
                          </ol>
                        </>
                      )}
                      
                      {deviceInfo.isAndroid && (
                        <>
                          <p className="font-medium text-status-success flex items-start gap-2">
                            <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>Android (Chrome/Brave):</span>
                          </p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Tap the <strong>🔒 lock icon</strong> or <strong>ⓘ info icon</strong> in the address bar</li>
                            <li>Tap <strong>"Permissions"</strong> or <strong>"Site settings"</strong></li>
                            <li>Find <strong>"Location"</strong> and set to <strong>"Allow"</strong></li>
                            <li>Refresh this page and try again</li>
                          </ol>
                          <p className="text-xs italic mt-2">Alternative: Android Settings → Apps → {deviceInfo.isChrome ? 'Chrome' : 'Browser'} → Permissions → Location → Allow</p>
                        </>
                      )}
                      
                      {!deviceInfo.isMobile && (
                        <>
                          <p className="font-medium flex items-start gap-2">
                            <Chrome className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>Desktop Browser:</span>
                          </p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Click the <strong>🔒 lock icon</strong> or <strong>ⓘ icon</strong> in the address bar (left of URL)</li>
                            <li>Find <strong>"Location"</strong> permission</li>
                            <li>Change from <strong>"Block"</strong> to <strong>"Allow"</strong></li>
                            <li>Refresh the page</li>
                          </ol>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Try Again Button - Shows after help instructions */}
                  {showLocationHelp && (
                    <button 
                      onClick={onRequestPermissions}
                      className="mt-3 w-full px-4 py-2 bg-brand-secondary text-white rounded-lg font-medium hover:bg-brand-secondary-hover transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Try Again
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Compass Permission */}
            <div className="p-4 rounded-lg border border-stroke-default bg-background-subtle">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 pt-1">
                  <Compass className="w-5 h-5 text-status-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-content-default">Compass/Orientation Access</h3>
                  <p className="text-xs text-content-subtle mt-1">
                    <strong className="text-status-warning">{deviceInfo.isIOS ? 'Highly Recommended (iOS)' : 'Optional'}</strong> - Improves location accuracy by calculating precise tree coordinates from your position using device orientation.
                  </p>
                  {deviceInfo.isIOS && (
                    <p className="text-xs text-status-info mt-1 flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>Enabling this provides more accurate tree locations on your map.</span>
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 pt-1">
                  <StatusIcon status={compassStatus} />
                </div>
              </div>
              
              {/* COMPASS DENIED - Show setup instructions */}
              {compassStatus === 'DENIED' && deviceInfo.isIOS && (
                <div className="mt-3 pt-3 border-t border-stroke-default">
                  <button 
                    onClick={() => setShowCompassHelp(!showCompassHelp)}
                    className="flex items-center gap-2 text-sm text-brand-primary hover:underline font-medium"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {showCompassHelp ? 'Hide' : 'Show'} setup instructions
                  </button>
                  
                  {showCompassHelp && (
                    <div className="mt-3 p-3 bg-background-default rounded-lg text-xs space-y-2 text-content-subtle">
                      <p className="font-semibold text-content-default flex items-center gap-2">
                        <Apple className="w-4 h-4" />
                        To enable Motion & Orientation on iPhone/iPad:
                      </p>
                      
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Open iPhone <strong>Settings</strong> app (⚙️)</li>
                        <li>Scroll down → Tap <strong>{deviceInfo.isSafari ? 'Safari' : 'Chrome'}</strong></li>
                        <li>Scroll to <strong>"Motion & Orientation Access"</strong></li>
                        <li>Toggle it <strong>ON</strong> (turn green)</li>
                        <li><strong>Return here</strong> and tap "Try Again" below</li>
                      </ol>
                      
                      <div className="mt-3 p-2 bg-status-info/10 border border-status-info/20 rounded">
                        <p className="text-xs text-status-info">
                          <strong>Note:</strong> This is optional but highly recommended for accurate tree positioning. If you skip this, we'll use basic GPS coordinates only.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Try Again Button for Compass */}
                  {showCompassHelp && (
                    <button 
                      onClick={onRequestPermissions}
                      className="mt-3 w-full px-4 py-2 bg-brand-secondary text-white rounded-lg font-medium hover:bg-brand-secondary-hover transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Try Again
                    </button>
                  )}
                </div>
              )}
              
              {/* COMPASS GRANTED - Show calibration tips */}
              {deviceInfo.isMobile && compassStatus === 'GRANTED' && (
                <div className="mt-3 pt-3 border-t border-stroke-default">
                  <button 
                    onClick={() => setShowCompassHelp(!showCompassHelp)}
                    className="flex items-center gap-2 text-sm text-brand-secondary hover:underline font-medium"
                  >
                    <Compass className="w-4 h-4" />
                    {showCompassHelp ? 'Hide' : 'Show'} compass calibration tips
                  </button>
                  
                  {showCompassHelp && (
                    <div className="mt-3 p-3 bg-status-success/10 border border-status-success/20 rounded-lg text-xs space-y-2">
                      <p className="font-semibold text-status-success">📍 Maximize compass accuracy:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2 text-content-subtle">
                        <li><strong>Calibrate your compass:</strong> Move your device in a figure-8 motion in the air</li>
                        <li><strong>Avoid interference:</strong> Stay away from metal objects, electronics, and magnets</li>
                        <li><strong>Stand outdoors:</strong> Compass works best in open areas away from buildings</li>
                        <li><strong>Hold steady:</strong> Keep device stable when taking measurements</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
        
        <footer className="sticky bottom-0 flex flex-col sm:flex-row justify-end gap-3 p-4 border-t border-stroke-default bg-background-default">
          {/* Show Grant Permissions button only if permissions haven't been requested yet */}
          {(locationStatus === 'PENDING' || locationStatus === 'CHECKING') && (
            <button
              onClick={onRequestPermissions}
              disabled={locationStatus === 'CHECKING'}
              className="w-full sm:w-auto px-6 py-2.5 bg-brand-secondary text-white rounded-lg font-medium hover:bg-brand-secondary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {locationStatus === 'CHECKING' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <ShieldQuestion className="w-4 h-4" />
                  Grant Permissions
                </>
              )}
            </button>
          )}
          
          {/* Continue button - enabled only when location is granted */}
          <button
            onClick={onConfirm}
            disabled={!canContinue}
            className="w-full sm:w-auto px-6 py-2.5 bg-brand-primary text-content-on-brand rounded-lg font-medium hover:bg-brand-primary-hover disabled:bg-background-inset disabled:text-content-subtle disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {canContinue ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Continue
              </>
            ) : locationStatus === 'REQUESTING' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Awaiting Permission...
              </>
            ) : (
              'Awaiting Location Permission'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
  // --- END: SURGICAL REPLACEMENT (ENHANCED UX) ----
}