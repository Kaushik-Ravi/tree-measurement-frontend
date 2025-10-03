// src/components/MapFeatures.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMap, LayersControl, TileLayer } from 'react-leaflet';
import type { SearchResult } from 'leaflet-geosearch/dist/providers/provider.js';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { Search, X } from 'lucide-react';

import 'leaflet-geosearch/dist/geosearch.css';

interface MapFeaturesProps {
  onLocationSelected: (location: { lat: number, lng: number }) => void;
}

const MapFeatures = ({ onLocationSelected }: MapFeaturesProps) => {
  const map = useMap();
  const provider = useRef(new OpenStreetMapProvider());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const performSearch = useCallback(async (searchTerm: string) => {
    if (searchTerm.length > 2) {
      const searchResults = await provider.current.search({ query: searchTerm });
      setResults(searchResults);
    } else {
      setResults([]);
    }
  }, []);

  const handleSelectResult = (result: SearchResult) => {
    console.log("[MapFeatures] Custom dropdown result selected:", result);
    onLocationSelected({ lat: result.y, lng: result.x });
    setQuery(result.label);
    setResults([]);
    map.flyTo([result.y, result.x], 16);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    if (searchInputRef.current) {
        searchInputRef.current.focus();
    }
  };

  return (
    <>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Light">
          <TileLayer attribution='© <a href="https://Carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer attribution='Tiles © Esri' url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Street">
          <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </LayersControl.BaseLayer>
      </LayersControl>
      
      {/* 
        DEFINITIVE FIX: 
        The geocoder is wrapped in its own container and positioned absolutely in the top-center.
        This completely separates it from the LayersControl in the top-right.
      */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="relative">
          <div className="bg-white shadow-lg rounded-md flex items-center border-2 border-transparent focus-within:border-blue-500 transition-all">
              <div className="pl-3 pr-2 text-gray-400">
                  <Search size={18} />
              </div>
              <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Enter address"
                  className="h-10 pr-10 border-none text-sm font-sans placeholder-gray-500 w-64 md:w-80 bg-transparent outline-none"
                  value={query}
                  onChange={(e) => {
                      setQuery(e.target.value);
                      performSearch(e.target.value);
                  }}
              />
              {query && (
                  <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-500 hover:bg-gray-100">
                      <X size={16} />
                  </button>
              )}
          </div>

          {results.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 z-[1000]">
                  {results.map((result) => (
                      <div
                          key={result.raw.place_id}
                          className="text-sm px-4 py-2 border-b border-gray-100 cursor-pointer hover:bg-blue-500 hover:text-white"
                          onClick={() => handleSelectResult(result)}
                      >
                          {result.label}
                      </div>
                  ))}
              </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MapFeatures;