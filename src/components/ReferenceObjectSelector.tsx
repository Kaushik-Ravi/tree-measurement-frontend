// src/components/ReferenceObjectSelector.tsx
import React from 'react';
import { 
  FileText, CreditCard, StickyNote, Smartphone, X, Edit3, AlertCircle
} from 'lucide-react';
import { 
  StandardReferenceObject, 
  STANDARD_OBJECTS 
} from '../utils/standardReferenceObjects';

interface ReferenceObjectSelectorProps {
  onSelectObject: (object: StandardReferenceObject | null) => void;
  onCancel: () => void;
}

// Icon mapping for Lucide icons
const iconMap: Record<string, React.ElementType> = {
  FileText,
  CreditCard,
  StickyNote,
  Smartphone,
  Edit: Edit3
};

export function ReferenceObjectSelector({ onSelectObject, onCancel }: ReferenceObjectSelectorProps) {
  // Note: Custom object functionality removed for simpler UX
  // Users should select from standard objects or close modal

  const handleSelectObject = (obj: StandardReferenceObject) => {
    onSelectObject(obj);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-background-default rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-stroke-default">
        {/* Header */}
        <div className="sticky top-0 bg-background-default border-b border-stroke-default p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-content-default">Choose Reference Object</h2>
            <p className="text-sm text-content-subtle mt-1">
              Select a standard object to skip manual distance entry
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-background-inset rounded-lg transition-colors text-content-subtle"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mx-6 mt-6 p-4 bg-status-info/10 border border-status-info/20 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-status-info flex-shrink-0 mt-0.5" />
          <div className="text-sm text-status-info/90">
            <p className="font-semibold mb-1">How it works:</p>
            <p>Select an object below, then you'll mark its <strong>WIDTH</strong> in your photo. Distance will be auto-calculated!</p>
          </div>
        </div>

        {/* Standard Objects Grid */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-content-subtle uppercase tracking-wide mb-4">
            Standard Objects
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {STANDARD_OBJECTS.map((obj) => {
              const IconComponent = iconMap[obj.iconName] || FileText;
              return (
                <button
                  key={obj.id}
                  onClick={() => handleSelectObject(obj)}
                  className="group relative p-4 bg-background-subtle hover:bg-brand-primary/10 border-2 border-stroke-default hover:border-brand-primary rounded-xl transition-all duration-200 text-left"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-brand-primary/10 group-hover:bg-brand-primary/20 rounded-lg transition-colors">
                      <IconComponent className="w-6 h-6 text-brand-primary" />
                    </div>
                    <div className="text-center w-full">
                      <p className="font-semibold text-content-default text-sm leading-tight">
                        {obj.name}
                      </p>
                      <p className="text-xs text-content-subtle mt-1">
                        {obj.widthMM}mm × {obj.heightMM}mm
                      </p>
                    </div>
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-20">
                    <div className="bg-background-default border border-stroke-default rounded-lg shadow-lg p-2 whitespace-nowrap text-xs">
                      {obj.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
