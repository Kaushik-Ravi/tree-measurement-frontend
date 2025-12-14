// src/components/MapFeatures.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMap, TileLayer } from 'react-leaflet';
import type { SearchResult } from 'leaflet-geosearch/dist/providers/provider.js';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { Search, X, Loader2, Layers } from 'lucide-react';

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
const MapFeatures = ({ onLocationSelected, theme, defaultLayer = 'Satellite' }: MapFeaturesProps) => {
  const map = useMap();
  const provider = useRef(new OpenStreetMapProvider());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Custom Layer Control State
  const [activeLayer, setActiveLayer] = useState<string>(defaultLayer);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

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

  const toggleLayerMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLayerMenuOpen(!isLayerMenuOpen);
  };

  const selectLayer = (layerName: string) => {
    setActiveLayer(layerName);
    setIsLayerMenuOpen(false);
  };

  // Theme classes
  const bgClass = theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-background-default border-transparent';
  const textClass = theme === 'dark' ? 'text-white' : 'text-content-default';
  const subTextClass = theme === 'dark' ? 'text-gray-400' : 'text-content-subtle';
  const inputClass = theme === 'dark' ? 'text-white placeholder:text-gray-500' : 'text-content-default placeholder:text-content-subtle';
  const menuBgClass = theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-stroke-default';
  const menuItemClass = theme === 'dark' ? 'text-gray-200 hover:bg-gray-800' : 'text-content-default hover:bg-brand-secondary hover:text-white';

  return (
    <>
      {/* Render Active Layer */}
      {activeLayer === 'Light' && (
        <TileLayer attribution='© <a href="https://Carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      )}
      {activeLayer === 'Dark' && (
        <TileLayer attribution='© <a href="https://Carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      )}
      {activeLayer === 'Satellite' && (
        <TileLayer attribution='Tiles © Esri' url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' />
      )}
      {activeLayer === 'Street' && (
        <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      )}
      
      {/* Search Bar */}
      <div className="absolute top-4 left-4 right-[60px] md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-auto z-[1000]">
        <div className="relative w-full">
          <div className={`shadow-lg rounded-lg flex items-center border-2 focus-within:border-brand-secondary transition-all ${bgClass}`}>
              <div className={`pl-3 pr-2 ${subTextClass}`}>
                  {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              </div>
              <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search for a location..."
                  className={`h-12 pr-10 border-none text-sm w-full md:w-80 bg-transparent outline-none ${inputClass}`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                  <button onClick={clearSearch} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-background-inset ${subTextClass}`}>
                      <X size={16} />
                  </button>
              )}
          </div>

          {results.length > 0 && (
              <div className={`absolute top-full mt-1 w-full shadow-lg rounded-md border z-[1000] max-h-60 overflow-y-auto ${menuBgClass}`}>
                  {results.map((result) => (
                      <div
                          key={result.raw.place_id}
                          className={`text-sm px-4 py-2 border-b cursor-pointer ${menuItemClass} ${theme === 'dark' ? 'border-gray-800' : 'border-stroke-subtle'}`}
                          onClick={() => handleSelectResult(result)}
                      >
                          {result.label}
                      </div>
                  ))}
              </div>
          )}
        </div>
      </div>

      {/* Custom Layer Control Button */}
      <div className="absolute top-4 right-4 z-[1000]">
        <button
          onClick={toggleLayerMenu}
          className={`p-3 rounded-lg shadow-lg transition-colors border-2 ${isLayerMenuOpen ? 'border-brand-secondary' : 'border-transparent'} ${bgClass} ${textClass}`}
          title="Change Map Layer"
        >
          <Layers size={20} />
        </button>

        {/* Layer Menu */}
        {isLayerMenuOpen && (
          <div className={`absolute top-full right-0 mt-2 w-40 shadow-xl rounded-lg border overflow-hidden flex flex-col py-1 ${menuBgClass}`}>
            {['Satellite', 'Street', 'Light', 'Dark'].map((layer) => (
              <button
                key={layer}
                onClick={() => selectLayer(layer)}
                className={`text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${
                  activeLayer === layer 
                    ? 'bg-brand-primary/10 text-brand-primary font-medium' 
                    : menuItemClass
                }`}
              >
                {layer}
                {activeLayer === layer && <div className="w-2 h-2 rounded-full bg-brand-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default MapFeatures;
// --- END: SURGICAL REPLACEMENT (THEMING & DYNAMIC LAYERS) ---