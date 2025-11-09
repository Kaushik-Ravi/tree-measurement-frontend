// src/components/ViewToggle.tsx
import { LayoutList, Map } from 'lucide-react';

interface ViewToggleProps {
  viewMode: 'list' | 'map';
  onViewChange: (mode: 'list' | 'map') => void;
}

export function ViewToggle({ viewMode, onViewChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-background-subtle rounded-lg border border-stroke-default">
      <button
        onClick={() => onViewChange('list')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium text-sm transition-all ${
          viewMode === 'list'
            ? 'bg-brand-primary text-content-on-brand shadow-sm'
            : 'text-content-subtle hover:text-content-default hover:bg-background-inset'
        }`}
        aria-label="List view"
      >
        <LayoutList className="w-4 h-4" />
        <span className="hidden sm:inline">List</span>
      </button>
      
      <button
        onClick={() => onViewChange('map')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium text-sm transition-all ${
          viewMode === 'map'
            ? 'bg-brand-primary text-content-on-brand shadow-sm'
            : 'text-content-subtle hover:text-content-default hover:bg-background-inset'
        }`}
        aria-label="Map view"
      >
        <Map className="w-4 h-4" />
        <span className="hidden sm:inline">Map</span>
      </button>
    </div>
  );
}
