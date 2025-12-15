import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      
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
