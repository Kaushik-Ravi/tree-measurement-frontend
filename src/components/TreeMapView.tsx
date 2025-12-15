// src/components/TreeMapView.tsx
import { MapContainer, Marker, Popup, TileLayer, LayersControl, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { TreeResult } from '../apiService';
import { MapPin, Eye, FlaskConical, Locate, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { TreePine } from 'lucide-react';
import { getOptimizedImageUrl } from '../utils/imageOptimization';

interface TreeMapViewProps {
  trees: TreeResult[];
  onTreeClick: (tree: TreeResult) => void;
  onAnalyzeTree?: (treeId: string) => void; // NEW: Optional callback for analyzing pending trees
  theme?: 'light' | 'dark';
}

// Component to handle "Locate Me" functionality
function LocateControl() {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);

  const handleLocate = () => {
    setIsLocating(true);
    map.locate({ setView: true, maxZoom: 18 });
  };

  useMapEvents({
    locationfound(e) {
      setIsLocating(false);
    },
    locationerror(e) {
      setIsLocating(false);
      console.error("Location access denied or unavailable:", e.message);
      // Optional: Show a toast or alert here
    }
  });

  return (
    <div className="leaflet-bottom leaflet-right">
      <div className="leaflet-control leaflet-bar">
        <button
          onClick={handleLocate}
          className="bg-background-default p-2 hover:bg-background-subtle cursor-pointer flex items-center justify-center w-[34px] h-[34px] border border-stroke-default rounded-sm shadow-sm"
          title="Locate Me"
          disabled={isLocating}
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 text-brand-accent animate-spin" />
          ) : (
            <Locate className="w-5 h-5 text-content-default" />
          )}
        </button>
      </div>
    </div>
  );
}

// Custom tree marker icons by status using Tree icon from lucide-react
const createTreeIcon = (status?: string) => {
  const colorMap: Record<string, string> = {
    'COMPLETE': '#10b981',           // green-500 (verified)
    'VERIFIED': '#6366f1',           // indigo-500 (promoted)
    'PENDING_ANALYSIS': '#f59e0b',   // amber-500 (needs verification)
    'ANALYSIS_IN_PROGRESS': '#3b82f6', // blue-500 (analyzing)
    'DEFAULT': '#9ca3af',            // gray-400 (fallback)
  };
  
  const color = colorMap[status || 'DEFAULT'] || colorMap['DEFAULT'];
  
  // Create tree icon using lucide-react TreePine component
  const iconHtml = renderToString(
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      backgroundColor: 'white',
      borderRadius: '50%',
      border: `3px solid ${color}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <TreePine 
        size={24} 
        color={color}
        strokeWidth={2.5}
        fill={color}
        fillOpacity={0.2}
      />
    </div>
  );
  
  return new DivIcon({
    html: iconHtml,
    className: 'custom-tree-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

export function TreeMapView({ trees, onTreeClick, onAnalyzeTree, theme = 'light' }: TreeMapViewProps) {
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
    <div className="h-[400px] sm:h-[600px] rounded-lg overflow-hidden border border-stroke-default shadow-md relative">
      <MapContainer
        center={mapCenter}
        zoom={defaultZoom}
        className="h-full w-full"
        scrollWheelZoom={true}
        maxZoom={22} // Increased max zoom for better separation
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer name="Street Map (Carto)">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
              url={tileLayerUrl}
              maxNativeZoom={19}
              maxZoom={22}
            />
          </LayersControl.BaseLayer>
          
          <LayersControl.BaseLayer checked name="Satellite (Esri)">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={22}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxNativeZoom={19}
              maxZoom={22}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <LocateControl />
        
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={40} // Tighter clusters
          spiderfyOnMaxZoom={true} // Explode clusters when zoomed in max
        >
          {validTrees.map((tree) => (
            <Marker
              key={tree.id}
              position={[tree.latitude!, tree.longitude!]}
              icon={createTreeIcon(tree.status)}
            >
              <Popup className="tree-popup compact-popup" minWidth={220} maxWidth={280}>
                <div className="compact-tree-card">
                  {/* Thumbnail - CRITICAL FIX: Use small thumbnail instead of full image */}
                  {tree.image_url && (
                    <img 
                      src={getOptimizedImageUrl(tree.image_url, 'small')}
                      alt={tree.file_name}
                      className="popup-image"
                      loading="lazy"
                      decoding="async"
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
                  </div>
                  
                  {/* Action Buttons - Separate Row */}
                  <div className="popup-actions">
                    {tree.status === 'PENDING_ANALYSIS' && onAnalyzeTree && (
                      <button
                        onClick={() => onAnalyzeTree(tree.id)}
                        className="analyze-btn-full bg-brand-accent hover:bg-brand-accent/90 text-white" // Enhanced visibility
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        Complete Analysis
                      </button>
                    )}
                    <button
                      onClick={() => onTreeClick(tree)}
                      className="view-details-btn-full"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Details
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
      
      {/* Simple Legend Overlay */}
      <div className="absolute bottom-5 left-5 bg-background-default/90 p-3 rounded-md shadow-md text-xs z-[1000] border border-stroke-default backdrop-blur-sm">
        <h4 className="font-bold mb-2 text-content-default">Tree Status</h4>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#10b981] border border-stroke-default"></div>
            <span className="text-content-default">Complete</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#f59e0b] border border-stroke-default"></div>
            <span className="text-content-default">Pending Analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#6366f1] border border-stroke-default"></div>
            <span className="text-content-default">Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
