/**
 * Premium AR Distance Measurement Orchestrator
 * 
 * Automatically selects the best AR measurement method based on device:
 * - iOS: ARKit via Model-Viewer (±2-5cm accuracy)
 * - Android: ARCore via Scene Viewer (±2-10cm accuracy)
 * - Fallback: WebXR or Manual entry
 * 
 * This is the PREMIUM tier - maximum accuracy for both platforms.
 */

import React, { useState, useEffect } from 'react';
import { IOSARKitDistance } from './IOSARKitDistance';
import { AndroidARCoreDistance } from './AndroidARCoreDistance';
import { Loader2, Smartphone } from 'lucide-react';

interface PremiumARDistanceProps {
  onDistanceMeasured: (distance: number, method: string, accuracy: number) => void;
  onCancel: () => void;
}

type ARMethod = 
  | 'arkit'     // iOS ARKit via Model-Viewer
  | 'arcore'    // Android ARCore via Scene Viewer
  | 'webxr'     // WebXR fallback
  | 'manual'    // Manual entry
  | 'unsupported';

interface DeviceCapabilities {
  platform: 'ios' | 'android' | 'other';
  method: ARMethod;
  accuracy: number; // Expected accuracy in meters
  name: string;     // Display name for method
}

export const PremiumARDistance: React.FC<PremiumARDistanceProps> = ({
  onDistanceMeasured,
  onCancel
}) => {
  const [detecting, setDetecting] = useState(true);
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);

  useEffect(() => {
    detectARCapabilities();
  }, []);

  const detectARCapabilities = async () => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);

    let caps: DeviceCapabilities;

    if (isIOS) {
      // iOS devices - Use ARKit via Model-Viewer
      caps = {
        platform: 'ios',
        method: 'arkit',
        accuracy: 0.025, // ±2.5cm average
        name: 'ARKit (iOS)'
      };
    } else if (isAndroid) {
      // Android devices - Use ARCore via Scene Viewer
      // Check Android version (ARCore requires 7.0+)
      const androidVersion = parseAndroidVersion(ua);
      
      if (androidVersion >= 7.0) {
        caps = {
          platform: 'android',
          method: 'arcore',
          accuracy: 0.05, // ±5cm average
          name: 'ARCore (Android)'
        };
      } else {
        // Old Android - fallback to manual
        caps = {
          platform: 'android',
          method: 'manual',
          accuracy: 0.5, // ±50cm (manual estimation)
          name: 'Manual Entry'
        };
      }
    } else {
      // Desktop or unsupported platform
      caps = {
        platform: 'other',
        method: 'manual',
        accuracy: 0.5,
        name: 'Manual Entry'
      };
    }

    console.log('[Premium AR] Detected capabilities:', caps);
    setCapabilities(caps);
    setDetecting(false);
  };

  const parseAndroidVersion = (ua: string): number => {
    const match = ua.match(/Android\s+([\d.]+)/);
    return match ? parseFloat(match[1]) : 0;
  };

  const handleDistanceMeasured = (distance: number, accuracy: number) => {
    const method = capabilities?.method || 'unknown';
    onDistanceMeasured(distance, method, accuracy);
  };

  if (detecting) {
    return (
      <div className="fixed inset-0 z-50 bg-background-default flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-primary animate-spin mx-auto mb-4" />
          <p className="text-content-default font-medium">Detecting AR Capabilities...</p>
          <p className="text-content-subtle text-sm mt-2">Optimizing for your device</p>
        </div>
      </div>
    );
  }

  if (!capabilities) {
    return (
      <div className="fixed inset-0 z-50 bg-background-default flex items-center justify-center p-6">
        <div className="bg-background-subtle rounded-xl p-8 max-w-md">
          <Smartphone className="w-16 h-16 text-status-error mx-auto mb-4" />
          <h3 className="text-xl font-bold text-content-default text-center mb-2">
            Detection Failed
          </h3>
          <p className="text-content-subtle text-center mb-6">
            Could not detect device capabilities. Please use manual entry.
          </p>
          <button
            onClick={onCancel}
            className="w-full py-3 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary-hover"
          >
            Use Manual Entry
          </button>
        </div>
      </div>
    );
  }

  // Render the appropriate AR component based on platform
  switch (capabilities.method) {
    case 'arkit':
      return (
        <IOSARKitDistance
          onDistanceMeasured={handleDistanceMeasured}
          onCancel={onCancel}
        />
      );

    case 'arcore':
      return (
        <AndroidARCoreDistance
          onDistanceMeasured={handleDistanceMeasured}
          onCancel={onCancel}
        />
      );

    case 'webxr':
      // Future: Could implement WebXR fallback here
      // For now, redirect to manual
      onCancel();
      return null;

    case 'manual':
    case 'unsupported':
    default:
      // Unsupported platform - redirect to manual entry
      onCancel();
      return null;
  }
};
