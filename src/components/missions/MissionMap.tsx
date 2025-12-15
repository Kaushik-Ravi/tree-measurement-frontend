import React, { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Mock Data (Replace with fetch from Supabase or JSON)
// Note: GeoJSON coordinates are [lon, lat], Leaflet uses [lat, lon]. 
// React-Leaflet's GeoJSON component handles the conversion automatically if data is standard GeoJSON.
const MOCK_SEGMENTS = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "id": "1", "name": "Main St (North)", "length_meters": 150, "status": "available" },
      "geometry": { "type": "LineString", "coordinates": [[-73.9654, 40.7829], [-73.9660, 40.7850]] }
    },
    {
      "type": "Feature",
      "properties": { "id": "2", "name": "Main St (South)", "length_meters": 120, "status": "locked" },
      "geometry": { "type": "LineString", "coordinates": [[-73.9654, 40.7810], [-73.9654, 40.7829]] }
    },
     {
      "type": "Feature",
      "properties": { "id": "3", "name": "5th Ave", "length_meters": 300, "status": "completed" },
      "geometry": { "type": "LineString", "coordinates": [[-73.9680, 40.7810], [-73.9680, 40.7850]] }
    }
  ]
};

interface MissionMapProps {
  onSegmentSelect: (segment: any) => void;
}

const MapController = () => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
};

export const MissionMap: React.FC<MissionMapProps> = ({ onSegmentSelect }) => {
  
  const onEachFeature = (feature: any, layer: any) => {
    // Style based on status
    const status = feature.properties.status;
    let color = '#ffffff'; // Default white
    if (status === 'locked') color = '#94a3b8'; // Grey
    if (status === 'completed') color = '#10b981'; // Green
    if (status === 'assigned') color = '#3b82f6'; // Blue

    layer.setStyle({
      color: color,
      weight: 8,
      opacity: 0.7
    });

    layer.on({
      click: (e) => {
        // Reset all styles (simplified approach - ideally manage state)
        // For now, just highlight the clicked one
        layer.setStyle({ color: '#f59e0b', weight: 10, opacity: 1 }); // Amber highlight
        onSegmentSelect(feature);
      },
      mouseover: () => {
        layer.setStyle({ weight: 10, opacity: 1 });
      },
      mouseout: () => {
        layer.setStyle({ weight: 8, opacity: 0.7 });
      }
    });
  };

  return (
    <MapContainer 
      center={[40.7829, -73.9654]} 
      zoom={15} 
      style={{ height: '100%', width: '100%', background: '#1e293b' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <GeoJSON 
        data={MOCK_SEGMENTS as any} 
        onEachFeature={onEachFeature} 
      />
      <MapController />
    </MapContainer>
  );
};
