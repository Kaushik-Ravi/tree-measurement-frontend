// src/components/MapFeatures.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMap, LayersControl, TileLayer } from 'react-leaflet';
import type { SearchResult } from 'leaflet-geosearch/dist/providers/provider.js';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { Search, X, Loader2 } from 'lucide-react';

import 'leaflet-geosearch/dist/geosearch.css';

interface MapFeaturesProps {
  onLocationSelected: (location: { lat: number, lng: number }) => void;
  // --- START: SURGICAL ADDITION (THEME PROP) ---
  theme: 'light' | 'dark';
  // --- END: SURGICAL ADDITION (THEME PROP) ---
  defaultLayer?: 'Light' | 'Dark' | 'Satellite' | 'Street';
}

// This custom hook delays updating a value until a certain amount of time has passed
// without that value changing. This is perfect for search inputs.
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timer to update the debounced value after the delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer if the value changes before the delay has passed
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// --- START: SURGICAL REPLACEMENT (THEMING & DYNAMIC LAYERS) ---
const MapFeatures = ({ onLocationSelected, theme, defaultLayer }: MapFeaturesProps) => {
  const map = useMap();
  const provider = useRef(new OpenStreetMapProvider());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300); // 300ms delay

  const performSearch = useCallback(async (searchTerm: string) => {
    if (searchTerm.length > 2) {
      setIsSearching(true);
      const searchResults = await provider.current.search({ query: searchTerm });
      setResults(searchResults);
      setIsSearching(false);
    } else {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);


  const handleSelectResult = (result: SearchResult) => {
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
        <LayersControl.BaseLayer checked={defaultLayer === 'Light' || (!defaultLayer && theme === 'light')} name="Light">
          <TileLayer attribution='© <a href="https://Carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked={defaultLayer === 'Dark' || (!defaultLayer && theme === 'dark')} name="Dark">
          <TileLayer attribution='© <a href="https://Carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked={defaultLayer === 'Satellite'} name="Satellite">
          <TileLayer attribution='Tiles © Esri' url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked={defaultLayer === 'Street'} name="Street">
          <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </LayersControl.BaseLayer>
      </LayersControl>
      
      <div className="absolute top-4 left-4 right-[60px] md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-auto z-[1000]">
        <div className="relative w-full">
          <div className={`shadow-lg rounded-lg flex items-center border-2 border-transparent focus-within:border-brand-secondary transition-all ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-background-default text-content-default'}`}>
              <div className={`pl-3 pr-2 ${theme === 'dark' ? 'text-gray-400' : 'text-content-subtle'}`}>
                  {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              </div>
              <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search for a location..."
                  className={`h-12 pr-10 border-none text-sm placeholder:text-content-subtle w-full md:w-80 bg-transparent outline-none ${theme === 'dark' ? 'text-white placeholder:text-gray-500' : 'text-content-default'}`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                  <button onClick={clearSearch} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-background-inset ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-800' : 'text-content-subtle'}`}>
                      <X size={16} />
                  </button>
              )}
          </div>

          {results.length > 0 && (
              <div className={`absolute top-full mt-1 w-full shadow-lg rounded-md border border-stroke-default z-[1000] max-h-60 overflow-y-auto ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-background-default'}`}>
                  {results.map((result) => (
                      <div
                          key={result.raw.place_id}
                          className={`text-sm px-4 py-2 border-b cursor-pointer hover:bg-brand-secondary hover:text-white ${theme === 'dark' ? 'border-gray-800 text-gray-200' : 'border-stroke-subtle text-content-default'}`}
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
// --- END: SURGICAL REPLACEMENT (THEMING & DYNAMIC LAYERS) ---