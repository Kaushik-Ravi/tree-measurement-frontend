// src/components/LocationPicker.tsx
import React, { useState } from 'react';
import { MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Crosshair } from 'lucide-react';
import MapFeatures from './MapFeatures';

interface LocationPickerProps {
  onCancel: () => void;
  onConfirm: (location: { lat: number; lng: number }) => void;
  initialLocation: { lat: number; lng: number } | null;
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

function LocateControl() {
  const map = useMap();
  const handleLocateMe = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    map.locate();
  };

  return (
    <div className="absolute top-20 right-4 z-[1000]">
       <button
        onClick={handleLocateMe}
        className="p-3 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
        title="Find my location"
        aria-label="Find my location"
      >
        <Crosshair className="w-5 h-5 text-gray-800" />
      </button>
    </div>
  );
}

export function LocationPicker({ onCancel, onConfirm, initialLocation }: LocationPickerProps) {
  const [pinnedPosition, setPinnedPosition] = useState<[number, number] | null>(
    initialLocation ? [initialLocation.lat, initialLocation.lng] : null
  );
  
  const mapCenter = pinnedPosition || (initialLocation ? [initialLocation.lat, initialLocation.lng] : null) || DEFAULT_CENTER;
  const mapZoom = pinnedPosition || initialLocation ? LOCATED_ZOOM : DEFAULT_ZOOM;

  const handleLocationSelect = (location: {lat: number, lng: number}) => {
    setPinnedPosition([location.lat, location.lng]);
  };

  return (
    <div className="w-full h-full bg-gray-200 rounded-lg shadow-inner relative overflow-hidden">
      <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }} zoomControl={true}>
        <MapFeatures onLocationSelected={handleLocationSelect} />
        <MapEventsHandler setPinnedPosition={setPinnedPosition} />
        
        <LocateControl />
        
        {pinnedPosition && (
          <Marker position={pinnedPosition}>
            <Popup>Tree Location</Popup>
          </Marker>
        )}
      </MapContainer>
      
      {/* --- MODIFIED BLOCK FOR RESPONSIVENESS --- */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col items-center z-[1000] pointer-events-none gap-3">
        <p className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg text-sm text-gray-600 pointer-events-auto w-full text-center">
            {pinnedPosition ? `Selected: ${pinnedPosition[0].toFixed(4)}, ${pinnedPosition[1].toFixed(4)}` : "Click on the map or use search"}
        </p>
        <div className="bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-lg flex flex-col sm:flex-row items-center gap-2 pointer-events-auto w-full">
            <button
                onClick={onCancel}
                className="w-full sm:w-auto flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 text-sm"
            >
                Cancel
            </button>
            <button
                onClick={() => { if(pinnedPosition) onConfirm({ lat: pinnedPosition[0], lng: pinnedPosition[1] }) }}
                disabled={!pinnedPosition}
                className="w-full sm:w-auto flex-1 px-6 py-3 bg-green-700 text-white font-medium rounded-md hover:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
            >
                Confirm Location
            </button>
        </div>
      </div>
       {/* --- END MODIFIED BLOCK --- */}
    </div>
  );
}