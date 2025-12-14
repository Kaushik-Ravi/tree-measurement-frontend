// src/components/LocationPicker.tsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Crosshair, MapPin, Layers, Check } from 'lucide-react';
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

// --- MAP CONTROLLER COMPONENTS ---

// 1. Center Listener: Updates parent state when map moves
function MapCenterListener({ onCenterChange }: { onCenterChange: (center: { lat: number, lng: number }) => void }) {
  const map = useMapEvents({
    move: () => {
      const center = map.getCenter();
      onCenterChange({ lat: center.lat, lng: center.lng });
    },
    moveend: () => {
      const center = map.getCenter();
      onCenterChange({ lat: center.lat, lng: center.lng });
    }
  });
  return null;
}

// 2. UI Controls (Locate Me & Layers) - Inside MapContainer to access map instance
function MapUIControls({ activeLayer, onLayerChange }: { activeLayer: string, onLayerChange: (layer: string) => void }) {
  const map = useMap();
  const [showLayers, setShowLayers] = useState(false);

  const handleLocateMe = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    map.locate({ setView: true, maxZoom: LOCATED_ZOOM });
  };

  return (
    <div className="absolute bottom-[180px] right-4 z-[1000] flex flex-col gap-3">
      {/* Layers FAB */}
      <div className="relative">
        {showLayers && (
          <div className="absolute bottom-full right-0 mb-3 bg-background-default rounded-xl shadow-xl border border-stroke-default p-2 min-w-[160px] flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2">
            {[
              { id: 'satellite', label: 'Satellite' },
              { id: 'street', label: 'Street' },
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
            ].map((layer) => (
              <button
                key={layer.id}
                onClick={() => { onLayerChange(layer.id); setShowLayers(false); }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeLayer === layer.id ? 'bg-brand-primary/10 text-brand-primary' : 'text-content-default hover:bg-background-subtle'}`}
              >
                {layer.label}
                {activeLayer === layer.id && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowLayers(!showLayers)}
          className="p-3 bg-background-default rounded-full shadow-lg hover:bg-background-inset transition-colors border border-stroke-default text-content-default"
          title="Change map layer"
        >
          <Layers className="w-6 h-6" />
        </button>
      </div>

      {/* Locate Me FAB */}
      <button
        onClick={handleLocateMe}
        className="p-3 bg-background-default rounded-full shadow-lg hover:bg-background-inset transition-colors border border-stroke-default text-content-default"
        title="Find my location"
      >
        <Crosshair className="w-6 h-6" />
      </button>
    </div>
  );
}

export function LocationPicker({ onCancel, onConfirm, initialLocation, theme }: LocationPickerProps) {
  // Default to Satellite as requested
  const [activeLayer, setActiveLayer] = useState('satellite');
  const [center, setCenter] = useState<{ lat: number, lng: number } | null>(
    initialLocation || null
  );

  // Initial center for MapContainer (only used on mount)
  const initialCenter: [number, number] = initialLocation 
    ? [initialLocation.lat, initialLocation.lng] 
    : DEFAULT_CENTER;
  
  const initialZoom = initialLocation ? LOCATED_ZOOM : DEFAULT_ZOOM;

  const handleLocationSelectedFromSearch = (loc: { lat: number, lng: number }) => {
    // MapFeatures handles the flyTo, we just update our state
    setCenter(loc);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background-default flex flex-col">
      {/* 1. Map Container (Full Screen) */}
      <div className="relative flex-grow w-full h-full">
        <MapContainer 
          center={initialCenter} 
          zoom={initialZoom} 
          zoomControl={false} // We'll use custom gestures
          style={{ height: '100%', width: '100%' }}
        >
          {/* Dynamic Tile Layer */}
          {activeLayer === 'satellite' && (
            <TileLayer attribution='Tiles © Esri' url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' />
          )}
          {activeLayer === 'street' && (
            <TileLayer attribution='© OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          )}
          {activeLayer === 'light' && (
            <TileLayer attribution='© CARTO' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          )}
          {activeLayer === 'dark' && (
            <TileLayer attribution='© CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          )}

          {/* Logic Components */}
          <MapFeatures onLocationSelected={handleLocationSelectedFromSearch} />
          <MapCenterListener onCenterChange={setCenter} />
          <MapUIControls activeLayer={activeLayer} onLayerChange={setActiveLayer} />
        </MapContainer>

        {/* 2. Fixed Center Pin (Overlay) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[900] flex flex-col items-center pb-8">
          <MapPin className="w-10 h-10 text-brand-primary drop-shadow-lg fill-current" />
          <div className="w-2 h-2 bg-black/50 rounded-full blur-[2px] mt-[-4px]" />
        </div>
      </div>

      {/* 3. Bottom Sheet (Fixed Action Area) */}
      <div className="absolute bottom-0 left-0 right-0 bg-background-default rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-[1000] pb-[env(safe-area-inset-bottom)]">
        <div className="p-4 flex flex-col gap-4">
          {/* Drag Handle / Coordinates */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-1.5 bg-stroke-subtle rounded-full mb-2" />
            <p className="text-xs font-medium text-content-subtle uppercase tracking-wider">
              Target Location
            </p>
            <p className="font-mono text-lg font-semibold text-content-default">
              {center 
                ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}` 
                : 'Move map to select'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-3.5 bg-background-subtle text-content-default font-semibold rounded-xl hover:bg-background-inset transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { if(center) onConfirm(center); }}
              disabled={!center}
              className="px-4 py-3.5 bg-brand-primary text-content-on-brand font-semibold rounded-xl hover:bg-brand-primary-hover shadow-lg shadow-brand-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
