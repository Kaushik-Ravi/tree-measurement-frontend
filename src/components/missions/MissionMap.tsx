import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, LayersControl, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import 'leaflet-control-geocoder';

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
    // @ts-ignore
    const geocoder = L.Control.Geocoder.nominatim();
    // @ts-ignore
    L.Control.geocoder({
      query: "",
      placeholder: "Search address...",
      defaultMarkGeocode: false,
      geocoder
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

  const handleLocate = () => {
    map.locate({ setView: true, maxZoom: 16 });
  };

  return (
    <div className="leaflet-bottom leaflet-right">
      <div className="leaflet-control leaflet-bar">
        <a 
          href="#" 
          role="button" 
          title="Locate me"
          onClick={(e) => {
            e.preventDefault();
            handleLocate();
          }}
          style={{ 
            width: '30px', 
            height: '30px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
        </a>
      </div>
    </div>
  );
};

// Optimized Layer Component that handles updates without full re-renders
const StreetLayer = ({ data, onSegmentSelect }: { data: any, onSegmentSelect: (s: any) => void }) => {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!data) return;

    // Style function
    const getStyle = (feature: any) => {
      const status = feature.properties.status;
      let color = '#ffffff'; // Default white
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
        click: () => {
          // Reset styles for all layers (if we had a reference to them)
          // For now, just highlight the clicked one
          (layer as L.Path).setStyle({ color: '#f59e0b', weight: 10, opacity: 1 });
          onSegmentSelect(feature);
        },
        mouseover: () => {
          (layer as L.Path).setStyle({ weight: 10, opacity: 1 });
        },
        mouseout: () => {
          (layer as L.Path).setStyle({ weight: 8, opacity: 0.7 });
        }
      });
    };

    if (!layerRef.current) {
      // Initialize layer
      layerRef.current = L.geoJSON(data, {
        style: getStyle,
        onEachFeature: onEachFeature
      }).addTo(map);
    } else {
      // Update data efficiently
      layerRef.current.clearLayers();
      layerRef.current.addData(data);
    }

    // Cleanup
    return () => {
      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }
    };
  }, [data, map, onSegmentSelect]);

  return null;
};

interface MissionMapProps {
  onSegmentSelect: (segment: any) => void;
  segments?: any; // Optional dynamic segments
  onBoundsChange?: (bounds: any) => void;
}

const MapController = ({ onBoundsChange }: { onBoundsChange?: (bounds: any) => void }) => {
  const map = useMap();
  
  useMapEvents({
    moveend: () => {
      if (onBoundsChange) {
        onBoundsChange(map.getBounds());
      }
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

export const MissionMap: React.FC<MissionMapProps> = ({ onSegmentSelect, segments, onBoundsChange }) => {
  // Default center (Pune) - We do NOT update this based on segments to prevent jitter
  const defaultCenter: [number, number] = [18.5204, 73.8567];

  return (
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
        />
      )}
      
      <MapController onBoundsChange={onBoundsChange} />
    </MapContainer>
  );
};
