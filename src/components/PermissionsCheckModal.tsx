// src/components/PermissionsCheckModal.tsx
import React from 'react';
import { MapPin, Compass, CheckCircle2, XCircle, Loader2, ShieldQuestion } from 'lucide-react';

type SensorStatus = 'PENDING' | 'GRANTED' | 'DENIED';

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
      return <XCircle className="w-5 h-5 text-status-error" />;
    case 'PENDING':
    default:
      return <Loader2 className="w-5 h-5 text-content-subtle animate-spin" />;
  }
};

export function PermissionsCheckModal({
  locationStatus,
  compassStatus,
  onRequestPermissions,
  onConfirm,
}: PermissionsCheckModalProps) {
  const allRequested = locationStatus !== 'PENDING' || compassStatus !== 'PENDING';
  const canContinue = locationStatus === 'GRANTED';

  // --- START: SURGICAL REPLACEMENT (THEMING & CONTENT REFINEMENT) ---
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-down">
      <div className="bg-background-default rounded-lg shadow-xl w-full max-w-md">
        <header className="flex items-center gap-3 p-4 border-b border-stroke-default">
          <ShieldQuestion className="w-6 h-6 text-brand-secondary" />
          <h2 className="text-lg font-semibold text-content-default">Device Permissions Required</h2>
        </header>

        <main className="p-6 space-y-4">
          <p className="text-sm text-content-subtle">
            To accurately map and measure trees, this app needs access to some of your device's sensors. Your data is not stored or shared without your explicit action to save a measurement.
          </p>
          <div className="space-y-3 pt-2">
            {/* Location Check */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 pt-1">
                <MapPin className="w-5 h-5 text-status-info" />
              </div>
              <div>
                <h3 className="font-medium text-content-default">Location Access</h3>
                <p className="text-xs text-content-subtle">
                  Required to automatically tag the tree's location.
                </p>
              </div>
              <div className="ml-auto flex-shrink-0 pt-1">
                <StatusIcon status={locationStatus} />
              </div>
            </div>
            {/* Compass Check */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 pt-1">
                <Compass className="w-5 h-5 text-status-warning" />
              </div>
              <div>
                <h3 className="font-medium text-content-default">Compass Access (iOS)</h3>
                <p className="text-xs text-content-subtle">
                  Optional, but improves location accuracy by calculating the tree's precise coordinates from your position. Some browsers (like Safari on iOS) will prompt for this.
                </p>
              </div>
              <div className="ml-auto flex-shrink-0 pt-1">
                <StatusIcon status={compassStatus} />
              </div>
            </div>
          </div>
          {locationStatus === 'DENIED' && (
             <div className="p-3 bg-status-error/10 border-l-4 border-status-error text-status-error text-sm rounded-r-md">
                <p><span className="font-bold">Location Access is Required.</span> To fix this, please go to your browser's settings for this website and change the Location permission to "Allow".</p>
             </div>
          )}
        </main>
        
        <footer className="flex flex-col sm:flex-row justify-end gap-3 p-4 border-t border-stroke-default bg-background-subtle">
          {!allRequested && (
            <button
              onClick={onRequestPermissions}
              className="w-full sm:w-auto px-6 py-2.5 bg-brand-secondary text-white rounded-lg font-medium hover:bg-brand-secondary-hover"
            >
              Grant Permissions
            </button>
          )}
           <button
            onClick={onConfirm}
            disabled={!canContinue}
            className="w-full sm:w-auto px-6 py-2.5 bg-brand-primary text-content-on-brand rounded-lg font-medium hover:bg-brand-primary-hover disabled:bg-background-inset disabled:text-content-subtle disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </footer>
      </div>
    </div>
  );
  // --- END: SURGICAL REPLACEMENT (THEMING & CONTENT REFINEMENT) ---
}