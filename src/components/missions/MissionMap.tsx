import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, LayersControl, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import 'leaflet-control-geocoder';
import { Crosshair } from 'lucide-react';

// Fix for default marker icons in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Search Control Component
const SearchControl = () => {
  const map = useMap();

  useEffect(() => {
    // Use Photon for better autocomplete/suggestions
    // @ts-ignore
    const geocoder = L.Control.Geocoder.photon();
    
    // @ts-ignore
    L.Control.geocoder({
      query: "",
      placeholder: "Search location (e.g. City, Hospital)...",
      defaultMarkGeocode: false,
      geocoder,
      suggestMinLength: 3, // Start suggesting after 3 chars
      suggestTimeout: 250 // Wait 250ms after typing stops
    })
    .on('markgeocode', function(e: any) {
      const bbox = e.geocode.bbox;
      const poly = L.polygon([
        bbox.getSouthEast(),
        bbox.getNorthEast(),
        bbox.getNorthWest(),
        bbox.getSouthWest()
      ]);
      map.fitBounds(poly.getBounds());
    })
    .addTo(map);
  }, [map]);

  return null;
};

// Locate Me Control Component
const LocateControl = () => {
  const map = useMap();
  const [isLocating, setIsLocating] = React.useState(false);

  const handleLocate = () => {
    setIsLocating(true);
    // Don't set view automatically, we'll handle it in locationfound
    map.locate({ setView: false, watch: false, enableHighAccuracy: true });
  };

  useMapEvents({
    locationfound(e) {
      setIsLocating(false);
      // Fly to location at high zoom (18)
      map.flyTo(e.latlng, 18, {
        animate: true,
        duration: 1.5
      });
      
      // Add a marker or circle
      L.circle(e.latlng, { radius: e.accuracy / 2 }).addTo(map);
    },
    locationerror(e) {
      setIsLocating(false);
      alert("Could not access location: " + e.message);
    }
  });

  return (
    <div className="leaflet-bottom leaflet-right" style={{ marginBottom: '20px', marginRight: '10px', pointerEvents: 'auto' }}>
      <div className="leaflet-control">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLocate();
          }}
          className="bg-white hover:bg-gray-100 text-gray-800 p-2 rounded-lg shadow-md border border-gray-300 flex items-center justify-center transition-colors"
          title="Locate Me"
          style={{ width: '34px', height: '34px' }}
        >
          <Crosshair className={`w-5 h-5 ${isLocating ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>
    </div>
  );
};

// Theme Controller to handle Dark/Light mode classes on the map container
const ThemeController = ({ activeLayer }: { activeLayer: string }) => {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (activeLayer === 'Dark Mode') {
      L.DomUtil.addClass(container, 'dark-theme-map');
    } else {
      L.DomUtil.removeClass(container, 'dark-theme-map');
    }
  }, [map, activeLayer]);
  return null;
};

// Optimized Layer Component that handles updates without full re-renders
const StreetLayer = ({ data, onSegmentSelect, activeLayer, selectedSegments }: { data: any, onSegmentSelect: (s: any) => void, activeLayer: string, selectedSegments: any[] }) => {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  // Custom renderer with high tolerance for "fat finger" touch issues
  // tolerance: 20 increases the hit area significantly
  const myRenderer = useRef(L.canvas({ padding: 0.5, tolerance: 20 })).current;

  useEffect(() => {
    if (!data) return;

    // SORTING FIX: Sort features by length (descending)
    // This ensures longer streets are drawn FIRST (at the bottom)
    // and shorter streets are drawn LAST (on top).
    // This allows small connector streets to be clickable even when between two large selected streets.
    const sortedFeatures = [...data.features].sort((a: any, b: any) => {
      const lenA = a.properties.length_meters || 0;
      const lenB = b.properties.length_meters || 0;
      return lenB - lenA; // Descending order
    });

    const sortedData = { ...data, features: sortedFeatures };

    // Style function
    const getStyle = (feature: any) => {
      const status = feature.properties.status;
      const isSelected = selectedSegments.some(s => s.properties.id === feature.properties.id);
      
      if (isSelected) {
        return {
          color: '#f59e0b', // Orange
          weight: 12, // Thicker for selected
          opacity: 1
        };
      }

      // Dynamic color based on base layer
      let defaultColor = '#ffffff'; // Default white for Dark/Satellite
      if (activeLayer === 'OpenStreetMap') {
        defaultColor = '#2563eb'; // Blue for Light map
      }

      let color = defaultColor;
      if (status === 'locked') color = '#94a3b8'; // Grey
      if (status === 'completed') color = '#10b981'; // Green
      if (status === 'assigned') color = '#3b82f6'; // Blue

      return {
        color: color,
        weight: 8,
        opacity: 0.7
      };
    };

    // Interaction handlers
    const onEachFeature = (feature: any, layer: L.Layer) => {
      layer.on({
        click: L.DomEvent.stop, // Prevent map click
        mousedown: () => {
           onSegmentSelect(feature);
        },
        mouseover: () => {
          const isSelected = selectedSegments.some(s => s.properties.id === feature.properties.id);
          if (!isSelected) {
            (layer as L.Path).setStyle({ weight: 10, opacity: 1 });
            // Bring to front on hover to help with selection
            if (L.Browser.canvas) {
                // Canvas doesn't support bringToFront for individual paths easily without full redraw
                // But since we sorted them, the small ones are already on top.
            } else {
                (layer as L.Path).bringToFront();
            }
          }
        },
        mouseout: () => {
          // Re-apply base style on mouseout
          const style = getStyle(feature);
          (layer as L.Path).setStyle(style);
        }
      });
    };

    if (!layerRef.current) {
      // Initialize layer
      layerRef.current = L.geoJSON(sortedData, {
        style: getStyle,
        onEachFeature: onEachFeature,
        // @ts-ignore
        renderer: myRenderer
      }).addTo(map);
    } else {
      // Update data efficiently
      layerRef.current.clearLayers();
      layerRef.current.addData(sortedData);
      // Force style update when layer changes
      layerRef.current.setStyle(getStyle);
    }

    // Cleanup
    return () => {
      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }
    };
  }, [data, map, onSegmentSelect, activeLayer, selectedSegments]);

  return null;
};

interface MissionMapProps {
  onSegmentSelect: (segment: any) => void;
  segments?: any; // Optional dynamic segments
  onBoundsChange?: (bounds: any) => void;
  isLoading?: boolean;
  selectedSegments?: any[];
}

const MapController = ({ onBoundsChange, onLayerChange }: { onBoundsChange?: (bounds: any) => void, onLayerChange: (name: string) => void }) => {
  const map = useMap();
  
  useMapEvents({
    moveend: () => {
      if (onBoundsChange) {
        onBoundsChange(map.getBounds());
      }
    },
    baselayerchange: (e: any) => {
      onLayerChange(e.name);
    }
  });

  // Initial bounds check
  useEffect(() => {
    map.invalidateSize();
    if (onBoundsChange) {
      onBoundsChange(map.getBounds());
    }
  }, [map]); // Run once on mount

  return null;
};

export const MissionMap: React.FC<MissionMapProps> = ({ onSegmentSelect, segments, onBoundsChange, isLoading, selectedSegments = [] }) => {
  // Default center (Pune) - We do NOT update this based on segments to prevent jitter
  const defaultCenter: [number, number] = [18.5204, 73.8567];
  const [activeLayer, setActiveLayer] = React.useState('Dark Mode');

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span>Loading Streets...</span>
        </div>
      )}
      
      <MapContainer 
        center={defaultCenter} 
        zoom={15} 
        style={{ height: '100%', width: '100%', background: '#1e293b' }}
        preferCanvas={true} // CRITICAL: Use Canvas renderer for performance with many paths
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Dark Mode">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          
          <LayersControl.BaseLayer name="Satellite (Esri)">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <ScaleControl position="bottomleft" />
        <SearchControl />
        <LocateControl />
        
        {segments && (
          <StreetLayer 
            data={segments} 
            onSegmentSelect={onSegmentSelect}
            activeLayer={activeLayer}
            selectedSegments={selectedSegments}
          />
        )}
        
        <MapController 
          onBoundsChange={onBoundsChange} 
          onLayerChange={setActiveLayer}
        />
        <ThemeController activeLayer={activeLayer} />
      </MapContainer>
    </div>
  );
};
