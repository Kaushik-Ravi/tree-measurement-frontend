import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, MapPin } from 'lucide-react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: string[];
  type: string;
}

export const GeoSearch = () => {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);

    try {
      // Using Nominatim for better standard compliance and detail
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        {
          headers: {
            'User-Agent': 'StreetLevelMissionControl/1.0'
          }
        }
      );
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Geocoding error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      handleSearch(value);
    }, 500); // 500ms debounce
  };

  const handleSelect = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    // Create bounds from bounding box
    // Nominatim returns [minLat, maxLat, minLon, maxLon]
    const bounds = L.latLngBounds(
      [parseFloat(result.boundingbox[0]), parseFloat(result.boundingbox[2])],
      [parseFloat(result.boundingbox[1]), parseFloat(result.boundingbox[3])]
    );

    map.fitBounds(bounds);
    
    setQuery(result.display_name.split(',')[0]); // Keep it short
    setIsOpen(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'auto', margin: '10px', zIndex: 1000 }}>
      <div className="leaflet-control" ref={searchRef}>
        <div className="relative w-64 md:w-80">
          <div className="relative flex items-center bg-background-default border border-stroke-default rounded-lg shadow-lg transition-all focus-within:ring-2 focus-within:ring-brand-primary">
            <Search className="w-5 h-5 ml-3 text-content-subtle" />
            <input
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="Search location..."
              className="w-full px-3 py-2 bg-transparent text-content-default placeholder-content-subtle focus:outline-none text-sm"
            />
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-3 animate-spin text-brand-primary" />
            ) : query ? (
              <button onClick={clearSearch} className="p-1 mr-2 hover:bg-background-subtle rounded-full">
                <X className="w-4 h-4 text-content-subtle" />
              </button>
            ) : null}
          </div>

          {/* Results Dropdown */}
          {isOpen && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-background-default border border-stroke-default rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {results.map((result) => (
                <button
                  key={result.place_id}
                  onClick={() => handleSelect(result)}
                  className="w-full px-4 py-3 text-left hover:bg-background-subtle border-b border-stroke-default last:border-0 flex items-start gap-3 transition-colors"
                >
                  <MapPin className="w-4 h-4 mt-1 text-content-subtle flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-content-default line-clamp-1">
                      {result.display_name.split(',')[0]}
                    </p>
                    <p className="text-xs text-content-subtle line-clamp-2">
                      {result.display_name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {isOpen && !isLoading && query && results.length === 0 && (
             <div className="absolute top-full left-0 right-0 mt-2 bg-background-default border border-stroke-default rounded-lg shadow-xl p-4 text-center">
                <p className="text-sm text-content-subtle">No results found</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
