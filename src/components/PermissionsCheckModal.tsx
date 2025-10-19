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
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'DENIED':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'PENDING':
    default:
      return <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />;
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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-down">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <header className="flex items-center gap-3 p-4 border-b">
          <ShieldQuestion className="w-6 h-6 text-brand-indigo" />
          <h2 className="text-lg font-semibold text-gray-800">Device Permissions Required</h2>
        </header>

        <main className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            To accurately map and measure trees, this app needs access to some of your device's sensors. Your data is not stored or shared without your explicit action to save a measurement.
          </p>
          <div className="space-y-3 pt-2">
            {/* Location Check */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 pt-1">
                <MapPin className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Location Access</h3>
                <p className="text-xs text-gray-500">
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
                <Compass className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Compass Access</h3>
                <p className="text-xs text-gray-500">
                  Optional, but improves location accuracy by calculating the tree's precise coordinates from your position. Some browsers (like Safari on iOS) will prompt for this.
                </p>
              </div>
              <div className="ml-auto flex-shrink-0 pt-1">
                <StatusIcon status={compassStatus} />
              </div>
            </div>
          </div>
          {locationStatus === 'DENIED' && (
             <div className="p-3 bg-red-50 border-l-4 border-red-400 text-red-800 text-sm">
                <p><span className="font-bold">Location is required.</span> Please enable location access for this site in your browser's settings to continue.</p>
             </div>
          )}
        </main>
        
        <footer className="flex flex-col sm:flex-row justify-end gap-3 p-4 border-t bg-gray-50">
          {!allRequested && (
            <button
              onClick={onRequestPermissions}
              className="w-full sm:w-auto px-6 py-2.5 bg-brand-indigo text-white rounded-lg font-medium hover:bg-brand-indigo-dark"
            >
              Grant Permissions
            </button>
          )}
           <button
            onClick={onConfirm}
            disabled={!canContinue}
            className="w-full sm:w-auto px-6 py-2.5 bg-brand-green text-white rounded-lg font-medium hover:bg-brand-green-dark disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </footer>
      </div>
    </div>
  );
}