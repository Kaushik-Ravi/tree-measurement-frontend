import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, LayersControl, ScaleControl, Marker, Popup, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Crosshair, User } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { GeoSearch } from './GeoSearch';

// Fix for default marker icons in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Custom Agent Icon
const createAgentIcon = (color: string = '#3b82f6') => L.divIcon({
  className: 'custom-agent-icon',
  html: `<div style="
    background-color: ${color};
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

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
    <div className="leaflet-top leaflet-left" style={{ marginTop: '80px', marginLeft: '10px', pointerEvents: 'auto' }}>
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

// Live Tree Layer - Visualizes trees in real-time
const LiveTreeLayer = () => {
  const map = useMap();
  const markersRef = useRef<L.LayerGroup>(new L.LayerGroup());

  useEffect(() => {
    markersRef.current.addTo(map);

    // Initial Fetch
    const fetchTrees = async () => {
      const { data } = await supabase.from('mapped_trees').select('*');
      if (data) {
        data.forEach(tree => addTreeMarker(tree));
      }
    };
    fetchTrees();

    // Realtime Subscription
    const channel = supabase
      .channel('live_trees')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mapped_trees' }, (payload) => {
        addTreeMarker(payload.new);
      })
      .subscribe();

    return () => {
      markersRef.current.clearLayers();
      supabase.removeChannel(channel);
    };
  }, [map]);

  const addTreeMarker = (tree: any) => {
    const marker = L.circleMarker([tree.lat, tree.lng], {
      radius: 6,
      fillColor: '#10b981', // Green
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    });
    
    marker.bindPopup(`
      <div class="text-sm font-sans">
        <strong class="text-green-700">${tree.species_name || 'Tree'}</strong><br/>
        <span class="text-gray-600">Height:</span> ${tree.height_m?.toFixed(1)}m<br/>
        <span class="text-gray-600">DBH:</span> ${tree.dbh_cm?.toFixed(1)}cm
      </div>
    `);
    
    markersRef.current.addLayer(marker);
  };

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
          color: '#f97316', // Bright Orange (High Contrast Selection)
          weight: 12, 
          opacity: 1
        };
      }

      // Dynamic color based on base layer
      // Golden Standard: Use colors that contrast well with the map tiles
      let defaultColor = '#22d3ee'; // Cyan/Light Blue for Dark/Satellite (Tron-like visibility)
      
      if (activeLayer === 'OpenStreetMap') {
        defaultColor = '#7c3aed'; // Deep Purple for Light map (Distinct from roads/water/parks)
      }

      let color = defaultColor;
      if (status === 'locked') color = '#64748b'; // Slate Grey (Subtle)
      if (status === 'completed') color = '#10b981'; // Emerald Green (Success)
      if (status === 'assigned') color = '#ec4899'; // Pink/Magenta (Distinct from Blue/Purple)

      return {
        color: color,
        weight: 8,
        opacity: 0.8
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

// Live Agents Layer
const LiveAgentsLayer = () => {
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    // 1. Initial Fetch
    const fetchAgents = async () => {
      const { data } = await supabase
        .from('user_locations')
        .select('*')
        .gt('last_updated', new Date(Date.now() - 1000 * 60 * 5).toISOString()); // Active in last 5 mins
      
      if (data) setAgents(data);
    };
    
    fetchAgents();

    // 2. Realtime Subscription
    const channel = supabase
      .channel('public:user_locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_locations' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setAgents(prev => {
              const exists = prev.find(a => a.user_id === payload.new.user_id);
              if (exists) {
                return prev.map(a => a.user_id === payload.new.user_id ? payload.new : a);
              } else {
                return [...prev, payload.new];
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      {agents.map(agent => (
        <Marker 
          key={agent.user_id} 
          position={[agent.lat, agent.lng]}
          icon={createAgentIcon()}
          zIndexOffset={1000}
        >
          <Popup>
            <div className="text-sm font-bold">Agent</div>
            <div className="text-xs text-gray-500">Last seen: {new Date(agent.last_updated).toLocaleTimeString()}</div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};

// Helper for point in polygon
function isPointInPolygon(point: [number, number], vs: [number, number][]) {
    var x = point[0], y = point[1];
    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];
        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

interface MissionMapProps {
  onSegmentSelect: (segment: any) => void;
  onMultiSelect?: (segments: any[]) => void;
  segments: any;
  onBoundsChange?: (bounds: any) => void;
  isLoading?: boolean;
  selectedSegments?: any[];
  flyToLocation?: { lat: number; lng: number; zoom?: number } | null;
}

export const MissionMap: React.FC<MissionMapProps> = ({ onSegmentSelect, onMultiSelect, segments, onBoundsChange, isLoading, selectedSegments = [], flyToLocation }) => {
  // Default center (Pune) - We do NOT update this based on segments to prevent jitter
  const defaultCenter: [number, number] = [18.5204, 73.8567];
  const [activeLayer, setActiveLayer] = React.useState('OpenStreetMap');
  const featureGroupRef = useRef<any>(null);

  // Handle FlyTo
  const FlyToHandler = () => {
    const map = useMap();
    useEffect(() => {
        if (flyToLocation) {
            map.flyTo([flyToLocation.lat, flyToLocation.lng], flyToLocation.zoom || 18, {
                animate: true,
                duration: 1.5
            });
        }
    }, [flyToLocation, map]);
    return null;
  };

  const handleCreated = (e: any) => {
    const layer = e.layer;
    if (e.layerType === 'polygon' || e.layerType === 'rectangle') {
      const latlngs = layer.getLatLngs()[0]; 
      // @ts-ignore
      const polygonPoints = latlngs.map((p: any) => [p.lat, p.lng]);

      const found = [];
      if (segments && segments.features) {
        for (const feature of segments.features) {
            const coords = feature.geometry.coordinates; 
            // GeoJSON LineString is [[lng, lat], [lng, lat]]
            
            // Check midpoint
            const p1 = coords[0];
            const p2 = coords[coords.length - 1];
            const midLat = (p1[1] + p2[1]) / 2;
            const midLng = (p1[0] + p2[0]) / 2;
            
            // @ts-ignore
            if (isPointInPolygon([midLat, midLng], polygonPoints)) {
                found.push(feature);
            }
        }
      }
      
      if (found.length > 0 && onMultiSelect) {
          onMultiSelect(found);
      }
      
      // Clear the drawn shape after a short delay so user sees what they drew
      setTimeout(() => {
          if (featureGroupRef.current) {
              featureGroupRef.current.clearLayers();
          }
      }, 500);
    }
  };

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
        <FeatureGroup ref={featureGroupRef}>
            <EditControl
                position="topleft"
                onCreated={handleCreated}
                draw={{
                    rectangle: true,
                    polygon: true,
                    circle: false,
                    circlemarker: false,
                    marker: false,
                    polyline: false
                }}
            />
        </FeatureGroup>

        <LayersControl position="bottomright">
          <LayersControl.BaseLayer name="Dark Mode">
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

          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <ScaleControl position="bottomleft" />
        
        {/* Custom Controls Container to manage mobile layout */}
        <div className="leaflet-bottom leaflet-right" style={{ marginBottom: '80px', marginRight: '10px', pointerEvents: 'none' }}>
             {/* We can inject custom controls here if needed, but Leaflet handles its own. 
                 The issue is Leaflet controls are absolute. 
                 We moved LayersControl to bottomright. 
                 On mobile, bottomright might be covered by the bottom sheet (MissionControlPanel).
                 We need to add a class to the map container when panel is open, or just accept it.
                 
                 BETTER SURGICAL FIX: 
                 We can't easily style Leaflet internal controls from here without global CSS overrides.
                 However, we can ensure the map container itself has padding-bottom if we passed a prop.
                 For now, let's leave it as standard Leaflet behavior but ensure our custom controls (GeoSearch) are safe.
             */}
        </div>

        <GeoSearch />
        <LocateControl />
        <LiveTreeLayer />
        <LiveAgentsLayer />
        
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
        <FlyToHandler />
      </MapContainer>
    </div>
  );
};
