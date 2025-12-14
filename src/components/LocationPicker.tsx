// src/components/LocationPicker.tsx
import React, { useState } from 'react';
import { MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Crosshair } from 'lucide-react';
import MapFeatures from './MapFeatures';

interface LocationPickerProps {
  onCancel: () => void;
  onConfirm: (location: { lat: number; lng: number }) => void;
  initialLocation: { lat: number; lng: number } | null;
  // --- START: SURGICAL ADDITION (THEME PROP) ---
  theme: 'light' | 'dark';
  // --- END: SURGICAL ADDITION (THEME PROP) ---
}

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;
const LOCATED_ZOOM = 16;

function MapEventsHandler({ setPinnedPosition }: {
  setPinnedPosition: (pos: [number, number]) => void;
}) {
  const map = useMapEvents({
    click(e) {
      setPinnedPosition([e.latlng.lat, e.latlng.lng]);
    },
    locationfound(e) {
      map.flyTo(e.latlng, LOCATED_ZOOM);
      setPinnedPosition([e.latlng.lat, e.latlng.lng]);
    },
    locationerror(e) {
      console.error("[MapEventsHandler LOCATIONERROR] Location error:", e.message);
      alert('Could not access your location. Please check browser settings and permissions.');
    },
  });
  return null;
}

// --- START: SURGICAL REPLACEMENT (THEMING) ---
function LocateControl() {
  const map = useMap();
  const handleLocateMe = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    map.locate();
  };

  return (
    <div className="absolute top-4 right-4 z-[1000]">
       <button
        onClick={handleLocateMe}
        className="p-3 bg-background-default rounded-lg shadow-lg hover:bg-background-inset transition-colors border border-stroke-default text-brand-primary"
        title="Find my location"
        aria-label="Find my location"
      >
        <Crosshair className="w-6 h-6" />
      </button>
    </div>
  );
}

export function LocationPicker({ onCancel, onConfirm, initialLocation, theme }: LocationPickerProps) {
  const [pinnedPosition, setPinnedPosition] = useState<[number, number] | null>(
    initialLocation ? [initialLocation.lat, initialLocation.lng] : null
  );
  
  const mapCenter = pinnedPosition || (initialLocation ? [initialLocation.lat, initialLocation.lng] : null) || DEFAULT_CENTER;
  const mapZoom = pinnedPosition || initialLocation ? LOCATED_ZOOM : DEFAULT_ZOOM;

  const handleLocationSelect = (location: {lat: number, lng: number}) => {
    setPinnedPosition([location.lat, location.lng]);
  };

  return (
    <div className="w-full h-full bg-background-inset relative overflow-hidden flex flex-col">
      <div className="flex-grow relative">
        <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <MapFeatures onLocationSelected={handleLocationSelect} theme={theme} />
          <MapEventsHandler setPinnedPosition={setPinnedPosition} />
          
          <LocateControl />
          
          {pinnedPosition && (
            <Marker position={pinnedPosition}>
              <Popup>Tree Location</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      
      {/* Mobile-Optimized Bottom Panel with Safe Area Support */}
      <div className="bg-background-default border-t border-stroke-default p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-[1000]">
        <div className="max-w-md mx-auto space-y-3">
            <div className="flex items-center justify-between bg-background-subtle px-3 py-2 rounded-lg border border-stroke-subtle">
                <span className="text-xs font-medium text-content-subtle uppercase tracking-wide">Selected Location</span>
                <span className="text-sm font-mono text-content-default">
                    {pinnedPosition ? `${pinnedPosition[0].toFixed(5)}, ${pinnedPosition[1].toFixed(5)}` : "Tap map to select"}
                </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={onCancel}
                    className="px-4 py-3 bg-background-inset text-content-default font-medium rounded-lg hover:bg-background-subtle border border-stroke-default transition-colors active:scale-95"
                >
                    Cancel
                </button>
                <button
                    onClick={() => { if(pinnedPosition) onConfirm({ lat: pinnedPosition[0], lng: pinnedPosition[1] }) }}
                    disabled={!pinnedPosition}
                    className="px-4 py-3 bg-brand-primary text-content-on-brand font-bold rounded-lg hover:bg-brand-primary-hover disabled:bg-background-inset disabled:text-content-subtle disabled:cursor-not-allowed shadow-md shadow-brand-primary/20 transition-all active:scale-95"
                >
                    Confirm
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
// --- END: SURGICAL REPLACEMENT (THEMING) ---