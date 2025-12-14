// src/components/LocationPicker.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, useMap, useMapEvents } from 'react-leaflet';
import { MapPin, Crosshair, Loader2 } from 'lucide-react';
import MapFeatures from './MapFeatures';

interface LocationPickerProps {
  onCancel: () => void;
  onConfirm: (location: { lat: number; lng: number }) => void;
  initialLocation: { lat: number; lng: number } | null;
  theme: 'light' | 'dark';
}

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;
const LOCATED_ZOOM = 18;

function MapCenterUpdater({ 
  setCenterPosition, 
  isLocating,
  onLocationFound,
  onLocationError
}: { 
  setCenterPosition: (pos: [number, number]) => void;
  isLocating: boolean;
  onLocationFound: () => void;
  onLocationError: () => void;
}) {
  const map = useMap();
  const isFirstLoad = useRef(true);

  const onMove = () => {
    const center = map.getCenter();
    setCenterPosition([center.lat, center.lng]);
  };

  useMapEvents({
    move: onMove,
    moveend: onMove,
    locationfound(e) {
      map.flyTo(e.latlng, LOCATED_ZOOM);
      setCenterPosition([e.latlng.lat, e.latlng.lng]);
      onLocationFound();
    },
    locationerror(e) {
      console.error("Location error:", e.message);
      // Only alert if it's a genuine error, not just a timeout/interrupt
      if (e.code !== 3) { // 3 is timeout
         alert('Could not access your location. Please check browser settings.');
      }
      onLocationError();
    },
  });

  useEffect(() => {
    if (isFirstLoad.current) {
      const center = map.getCenter();
      setCenterPosition([center.lat, center.lng]);
      isFirstLoad.current = false;
    }
  }, [map, setCenterPosition]);

  useEffect(() => {
    if (isLocating) {
      map.locate({ enableHighAccuracy: true, timeout: 10000 });
    }
  }, [isLocating, map]);

  return null;
}

export function LocationPicker({ onCancel, onConfirm, initialLocation, theme }: LocationPickerProps) {
  const [centerPosition, setCenterPosition] = useState<[number, number]>(
    initialLocation ? [initialLocation.lat, initialLocation.lng] : DEFAULT_CENTER
  );
  const [isLocating, setIsLocating] = useState(false);
  
  const initialCenter = initialLocation ? [initialLocation.lat, initialLocation.lng] : DEFAULT_CENTER;
  const initialZoom = initialLocation ? LOCATED_ZOOM : DEFAULT_ZOOM;

  const handleLocateMe = () => {
    if (isLocating) return; // Prevent double clicks
    setIsLocating(true);
  };

  const handleLocationFound = () => {
    setIsLocating(false);
  };

  const handleLocationError = () => {
    setIsLocating(false);
  };

  const handleLocationSelectFromSearch = (location: {lat: number, lng: number}) => {
    // MapFeatures handles flyTo
  };

  // Theme classes
  const bgClass = theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const textClass = theme === 'dark' ? 'text-gray-100' : 'text-gray-700';
  const subTextClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const buttonBgClass = theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-gray-100' : 'bg-gray-100 hover:bg-gray-200 text-gray-700';
  const coordBgClass = theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-600';

  return (
    <div className="fixed inset-0 z-[50] bg-black flex flex-col h-[100dvh] w-screen">
      <div className="relative flex-1 w-full h-full">
        <MapContainer 
          center={initialCenter as [number, number]} 
          zoom={initialZoom} 
          scrollWheelZoom={true} 
          style={{ height: '100%', width: '100%' }} 
          zoomControl={false} 
        >
          <MapFeatures 
            onLocationSelected={handleLocationSelectFromSearch} 
            theme={theme} 
            defaultLayer="Satellite"
          />
          <MapCenterUpdater 
            setCenterPosition={setCenterPosition} 
            isLocating={isLocating}
            onLocationFound={handleLocationFound}
            onLocationError={handleLocationError}
          />
        </MapContainer>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none flex flex-col items-center justify-center pb-[38px]">
           <MapPin 
             size={48} 
             className="text-brand-primary drop-shadow-lg filter" 
             fill="#10b981" 
             color="#ffffff"
             strokeWidth={1.5}
           />
           <div className="w-2 h-2 bg-black/50 rounded-full blur-[1px] mt-[-8px]"></div>
        </div>

        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          className={`absolute bottom-6 right-4 z-[1000] p-3 rounded-full shadow-lg transition-colors border ${bgClass} ${textClass} ${isLocating ? 'opacity-80 cursor-wait' : ''}`}
          title="Find my location"
        >
          {isLocating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Crosshair className="w-6 h-6" />}
        </button>
      </div>
      
      <div className={`${bgClass} border-t p-4 pb-[env(safe-area-inset-bottom,20px)] flex flex-col gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-[1001]`}>
        <div className="flex items-center justify-center">
          <div className={`${coordBgClass} px-3 py-1.5 rounded-full text-xs font-mono border flex items-center gap-2`}>
             <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span>
             {centerPosition[0].toFixed(6)}, {centerPosition[1].toFixed(6)}
          </div>
        </div>

        <div className="flex gap-3 w-full">
            <button
                onClick={onCancel}
                className={`flex-1 px-4 py-3 font-semibold rounded-lg transition-colors text-sm active:scale-95 transform ${buttonBgClass}`}
            >
                Cancel
            </button>
            <button
                onClick={() => onConfirm({ lat: centerPosition[0], lng: centerPosition[1] })}
                className="flex-1 px-4 py-3 bg-brand-primary text-white font-semibold rounded-lg hover:opacity-90 transition-colors text-sm shadow-md active:scale-95 transform"
            >
                Confirm Location
            </button>
        </div>
      </div>
    </div>
  );
}