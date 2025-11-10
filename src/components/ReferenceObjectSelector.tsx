// src/components/ReferenceObjectSelector.tsx
import React, { useState } from 'react';
import { 
  FileText, CreditCard, StickyNote, Smartphone, X, Edit3, AlertCircle
} from 'lucide-react';
import { 
  StandardReferenceObject, 
  saveCustomObject,
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
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');

  // Note: getAllReferenceObjects() available for future custom objects feature
  // const availableObjects = getAllReferenceObjects();

  const handleSelectObject = (obj: StandardReferenceObject) => {
    onSelectObject(obj);
  };

  const handleManualFallback = () => {
    // Return null to signal manual distance entry (legacy flow)
    onSelectObject(null);
  };

  const handleCustomSave = () => {
    const widthMM = parseFloat(customWidth);
    const heightMM = parseFloat(customHeight);

    if (!customName.trim() || isNaN(widthMM) || isNaN(heightMM) || widthMM <= 0 || heightMM <= 0) {
      alert('Please enter valid dimensions (positive numbers)');
      return;
    }

    const customObj = saveCustomObject(customName.trim(), widthMM, heightMM);
    setShowCustomForm(false);
    onSelectObject(customObj);
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

          {/* Custom Object Section */}
          <div className="border-t border-stroke-default pt-6">
            <h3 className="text-sm font-semibold text-content-subtle uppercase tracking-wide mb-4">
              Advanced Options
            </h3>

            {!showCustomForm ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Custom Object Button */}
                <button
                  onClick={() => setShowCustomForm(true)}
                  className="p-4 bg-background-subtle hover:bg-brand-accent/10 border-2 border-dashed border-stroke-default hover:border-brand-accent rounded-xl transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-accent/10 rounded-lg">
                      <Edit3 className="w-5 h-5 text-brand-accent" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-content-default text-sm">Custom Object</p>
                      <p className="text-xs text-content-subtle">Enter your own dimensions</p>
                    </div>
                  </div>
                </button>

                {/* Manual Fallback Button */}
                <button
                  onClick={handleManualFallback}
                  className="p-4 bg-background-subtle hover:bg-background-inset border-2 border-stroke-default hover:border-content-subtle rounded-xl transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-content-subtle/10 rounded-lg">
                      <Edit3 className="w-5 h-5 text-content-subtle" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-content-default text-sm">Manual Entry</p>
                      <p className="text-xs text-content-subtle">Enter distance yourself</p>
                    </div>
                  </div>
                </button>
              </div>
            ) : (
              <div className="p-6 bg-background-subtle rounded-xl border border-stroke-default">
                <h4 className="font-semibold text-content-default mb-4">Create Custom Reference Object</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-content-default mb-2">
                      Object Name
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g., My Ruler"
                      className="w-full px-4 py-2 border border-stroke-default bg-background-default rounded-lg focus:ring-2 focus:ring-brand-primary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-content-default mb-2">
                        Width (mm)
                      </label>
                      <input
                        type="number"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(e.target.value)}
                        placeholder="210"
                        className="w-full px-4 py-2 border border-stroke-default bg-background-default rounded-lg focus:ring-2 focus:ring-brand-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-content-default mb-2">
                        Height (mm)
                      </label>
                      <input
                        type="number"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(e.target.value)}
                        placeholder="297"
                        className="w-full px-4 py-2 border border-stroke-default bg-background-default rounded-lg focus:ring-2 focus:ring-brand-primary"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCustomSave}
                      className="flex-1 px-4 py-2 bg-brand-primary text-content-on-brand rounded-lg font-medium hover:bg-brand-primary-hover transition-colors"
                    >
                      Save & Use
                    </button>
                    <button
                      onClick={() => setShowCustomForm(false)}
                      className="px-4 py-2 bg-background-default border border-stroke-default text-content-default rounded-lg font-medium hover:bg-background-inset transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
