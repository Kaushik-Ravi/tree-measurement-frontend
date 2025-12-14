// src/components/MapFeatures.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import type { SearchResult } from 'leaflet-geosearch/dist/providers/provider.js';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { Search, Loader2, X } from 'lucide-react';

import 'leaflet-geosearch/dist/geosearch.css';

interface MapFeaturesProps {
  onLocationSelected: (location: { lat: number, lng: number }) => void;
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

const MapFeatures = ({ onLocationSelected }: MapFeaturesProps) => {
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
    map.flyTo([result.y, result.x], 18); // Zoom in closer for precise placement
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    if (searchInputRef.current) {
        searchInputRef.current.focus();
    }
  };

  return (
    <div className="absolute top-[calc(env(safe-area-inset-top)+1rem)] left-4 right-4 z-[1000]">
        <div className="relative w-full max-w-md mx-auto">
          <div className="bg-background-default shadow-xl rounded-full flex items-center border border-stroke-default focus-within:border-brand-primary transition-all overflow-hidden">
              <div className="pl-4 pr-2 text-content-subtle">
                  {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              </div>
              <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a location..."
                  className="w-full py-3 bg-transparent border-none focus:ring-0 text-sm text-content-default placeholder:text-content-subtle outline-none"
              />
              {query && (
                  <button onClick={clearSearch} className="p-2 text-content-subtle hover:text-content-default">
                      <X size={16} />
                  </button>
              )}
          </div>

          {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-background-default rounded-xl shadow-xl border border-stroke-default max-h-60 overflow-y-auto divide-y divide-stroke-subtle">
                  {results.map((result) => (
                      <button
                          key={result.x + result.y}
                          onClick={() => handleSelectResult(result)}
                          className="w-full text-left px-4 py-3 hover:bg-background-subtle transition-colors text-sm text-content-default truncate"
                      >
                          {result.label}
                      </button>
                  ))}
              </div>
          )}
        </div>
    </div>
  );
};

export default MapFeatures;                      >
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