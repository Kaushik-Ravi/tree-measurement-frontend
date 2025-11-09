// src/components/TreeMapView.tsx
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TreeResult } from '../apiService';
import { MapPin, Eye } from 'lucide-react';
import { useMemo } from 'react';

interface TreeMapViewProps {
  trees: TreeResult[];
  onTreeClick: (tree: TreeResult) => void;
  theme?: 'light' | 'dark';
}

// Custom tree marker icons by status
const createTreeIcon = (status?: string) => {
  const colorMap: Record<string, string> = {
    'COMPLETE': '#10b981',           // green-500 (verified)
    'VERIFIED': '#6366f1',           // indigo-500 (promoted)
    'PENDING_ANALYSIS': '#f59e0b',   // amber-500 (needs verification)
    'ANALYSIS_IN_PROGRESS': '#3b82f6', // blue-500 (analyzing)
    'DEFAULT': '#9ca3af',            // gray-400 (fallback)
  };
  
  const color = colorMap[status || 'DEFAULT'] || colorMap['DEFAULT'];
  
  const svgIcon = `
    <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.716 0 0 6.716 0 15c0 8.284 15 25 15 25s15-16.716 15-25c0-8.284-6.716-15-15-15z" 
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="15" cy="15" r="5" fill="white"/>
    </svg>
  `;
  
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
  });
};

export function TreeMapView({ trees, onTreeClick, theme = 'light' }: TreeMapViewProps) {
  // Filter trees with valid GPS coordinates
  const validTrees = useMemo(() => 
    trees.filter(t => t.latitude && t.longitude && 
                     !isNaN(t.latitude) && !isNaN(t.longitude)),
    [trees]
  );

  // Calculate map center from tree locations
  const mapCenter: [number, number] = useMemo(() => {
    if (validTrees.length === 0) return [0, 0];
    
    const avgLat = validTrees.reduce((sum, t) => sum + (t.latitude || 0), 0) / validTrees.length;
    const avgLng = validTrees.reduce((sum, t) => sum + (t.longitude || 0), 0) / validTrees.length;
    
    return [avgLat, avgLng];
  }, [validTrees]);

  // Determine default zoom based on tree spread
  const defaultZoom = useMemo(() => {
    if (validTrees.length === 0) return 2;
    if (validTrees.length === 1) return 15;
    
    const lats = validTrees.map(t => t.latitude || 0);
    const lngs = validTrees.map(t => t.longitude || 0);
    const latDiff = Math.max(...lats) - Math.min(...lats);
    const lngDiff = Math.max(...lngs) - Math.min(...lngs);
    const maxDiff = Math.max(latDiff, lngDiff);
    
    if (maxDiff < 0.01) return 14;  // ~1km
    if (maxDiff < 0.1) return 11;   // ~10km
    if (maxDiff < 1) return 8;      // ~100km
    return 5;                       // >100km
  }, [validTrees]);

  const tileLayerUrl = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  if (validTrees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] sm:h-[600px] bg-background-subtle rounded-lg border border-stroke-default">
        <MapPin className="w-12 h-12 text-content-subtle mb-4" />
        <p className="text-content-subtle text-center">
          No trees with GPS coordinates yet.
          <br />
          <span className="text-sm">Add location data to see them on the map.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="h-[400px] sm:h-[600px] rounded-lg overflow-hidden border border-stroke-default shadow-md">
      <MapContainer
        center={mapCenter}
        zoom={defaultZoom}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileLayerUrl}
        />
        
        {validTrees.map((tree) => (
          <Marker
            key={tree.id}
            position={[tree.latitude!, tree.longitude!]}
            icon={createTreeIcon(tree.status)}
          >
            <Popup className="tree-popup compact-popup" minWidth={220} maxWidth={280}>
              <div className="compact-tree-card">
                {/* Thumbnail */}
                {tree.image_url && (
                  <img 
                    src={tree.image_url} 
                    alt={tree.file_name}
                    className="popup-image"
                  />
                )}
                
                {/* Species Info - More Compact */}
                <div className="popup-header">
                  <h3 className="popup-scientific-name">
                    {tree.species?.scientificName || 'Unidentified'}
                  </h3>
                  {tree.species?.commonNames && tree.species.commonNames.length > 0 && (
                    <p className="popup-common-name">
                      {tree.species.commonNames[0]}
                    </p>
                  )}
                </div>
                
                {/* Compact Metrics Grid */}
                <div className="popup-metrics">
                  <div className="metric-item">
                    <span className="metric-label">Height</span>
                    <span className="metric-value">{tree.metrics?.height_m?.toFixed(1) ?? '--'} m</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Canopy</span>
                    <span className="metric-value">{tree.metrics?.canopy_m?.toFixed(1) ?? '--'} m</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">DBH</span>
                    <span className="metric-value">{tree.metrics?.dbh_cm?.toFixed(1) ?? '--'} cm</span>
                  </div>
                </div>
                
                {/* Compact Footer */}
                <div className="popup-footer">
                  <span className={`status-badge ${
                    tree.status === 'COMPLETE' 
                      ? 'status-complete'
                      : tree.status === 'VERIFIED'
                      ? 'status-verified'
                      : tree.status === 'PENDING_ANALYSIS'
                      ? 'status-pending'
                      : tree.status === 'ANALYSIS_IN_PROGRESS'
                      ? 'status-progress'
                      : 'status-unknown'
                  }`}>
                    {tree.status || 'UNKNOWN'}
                  </span>
                  
                  <button
                    onClick={() => onTreeClick(tree)}
                    className="view-details-btn"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
