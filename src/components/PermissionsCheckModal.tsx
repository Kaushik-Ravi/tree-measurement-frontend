// src/components/PermissionsCheckModal.tsx
import { useState } from 'react';
import { MapPin, Compass, CheckCircle2, XCircle, Loader2, ShieldQuestion, AlertCircle, Smartphone, Chrome, Apple } from 'lucide-react';

type SensorStatus = 'PENDING' | 'GRANTED' | 'DENIED' | 'BLOCKED';

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
    case 'BLOCKED':
      return <XCircle className="w-5 h-5 text-status-error" />;
    case 'PENDING':
    default:
      return <Loader2 className="w-5 h-5 text-content-subtle animate-spin" />;
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
  
  const allRequested = locationStatus !== 'PENDING' || compassStatus !== 'PENDING';
  const canContinue = locationStatus === 'GRANTED';
  const locationBlocked = locationStatus === 'DENIED' || locationStatus === 'BLOCKED';

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
                </div>
                <div className="flex-shrink-0 pt-1">
                  <StatusIcon status={locationStatus} />
                </div>
              </div>
              
              {locationBlocked && (
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
                    <strong>{deviceInfo.isIOS ? 'Required on iOS' : 'Optional'}</strong> - Improves location accuracy by calculating precise tree coordinates from your position using device orientation.
                  </p>
                </div>
                <div className="flex-shrink-0 pt-1">
                  <StatusIcon status={compassStatus} />
                </div>
              </div>
              
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
          {!allRequested && (
            <button
              onClick={onRequestPermissions}
              className="w-full sm:w-auto px-6 py-2.5 bg-brand-secondary text-white rounded-lg font-medium hover:bg-brand-secondary-hover transition-colors"
            >
              Grant Permissions
            </button>
          )}
          <button
            onClick={onConfirm}
            disabled={!canContinue}
            className="w-full sm:w-auto px-6 py-2.5 bg-brand-primary text-content-on-brand rounded-lg font-medium hover:bg-brand-primary-hover disabled:bg-background-inset disabled:text-content-subtle disabled:cursor-not-allowed transition-colors"
          >
            {canContinue ? 'Continue' : 'Awaiting Location Permission'}
          </button>
        </footer>
      </div>
    </div>
  );
  // --- END: SURGICAL REPLACEMENT (ENHANCED UX) ----
}