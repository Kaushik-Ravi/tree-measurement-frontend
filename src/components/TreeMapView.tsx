// src/components/TreeMapView.tsx
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TreeResult } from '../apiService';
import { MapPin, Eye, FlaskConical } from 'lucide-react';
import { useMemo } from 'react';
import { renderToString } from 'react-dom/server';
import { TreePine } from 'lucide-react';
import { getOptimizedImageUrl } from '../utils/imageOptimization';

interface TreeMapViewProps {
  trees: TreeResult[];
  onTreeClick: (tree: TreeResult) => void;
  onAnalyzeTree?: (treeId: string) => void; // NEW: Optional callback for analyzing pending trees
  theme?: 'light' | 'dark';
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
            <Popup minWidth={260} maxWidth={280} closeButton={false} className="!m-0">
              <div className="bg-background-default rounded-lg overflow-hidden shadow-sm border border-stroke-default font-sans text-left -m-[13px] w-[260px]">
                {/* Thumbnail */}
                {tree.image_url && (
                  <div className="relative h-32 w-full bg-gray-100 dark:bg-gray-800">
                    <img 
                      src={getOptimizedImageUrl(tree.image_url, 'small')}
                      alt={tree.file_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute top-2 right-2">
                       <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm ${
                        tree.status === 'COMPLETE' ? 'bg-green-500' :
                        tree.status === 'VERIFIED' ? 'bg-indigo-500' :
                        tree.status === 'PENDING_ANALYSIS' ? 'bg-amber-500' :
                        'bg-blue-500'
                       }`}>
                         {tree.status === 'PENDING_ANALYSIS' ? 'PENDING' : tree.status}
                       </span>
                    </div>
                  </div>
                )}
                
                <div className="p-3 space-y-3">
                    {/* Header */}
                    <div>
                        <h3 className="font-bold text-content-default text-sm leading-tight truncate">
                            {tree.species?.scientificName || 'Unidentified Species'}
                        </h3>
                        <p className="text-xs text-content-subtle mt-0.5 truncate">
                            {tree.species?.commonNames?.[0] || 'No common name'}
                        </p>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-stroke-subtle">
                        <div className="text-center">
                            <p className="text-[10px] text-content-subtle uppercase">Height</p>
                            <p className="text-xs font-mono font-semibold text-content-default">{tree.metrics?.height_m?.toFixed(1) ?? '--'}m</p>
                        </div>
                        <div className="text-center border-l border-stroke-subtle">
                            <p className="text-[10px] text-content-subtle uppercase">Canopy</p>
                            <p className="text-xs font-mono font-semibold text-content-default">{tree.metrics?.canopy_m?.toFixed(1) ?? '--'}m</p>
                        </div>
                        <div className="text-center border-l border-stroke-subtle">
                            <p className="text-[10px] text-content-subtle uppercase">DBH</p>
                            <p className="text-xs font-mono font-semibold text-content-default">{tree.metrics?.dbh_cm?.toFixed(0) ?? '--'}cm</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        {tree.status === 'PENDING_ANALYSIS' && onAnalyzeTree && (
                            <button
                                onClick={() => onAnalyzeTree(tree.id)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-brand-secondary/10 text-brand-secondary hover:bg-brand-secondary/20 rounded-md text-xs font-semibold transition-colors"
                            >
                                <FlaskConical className="w-3 h-3" />
                                Analyze
                            </button>
                        )}
                        <button
                            onClick={() => onTreeClick(tree)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-brand-primary text-content-on-brand hover:bg-brand-primary-hover rounded-md text-xs font-semibold transition-colors shadow-sm"
                        >
                            <Eye className="w-3 h-3" />
                            Details
                        </button>
                    </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
