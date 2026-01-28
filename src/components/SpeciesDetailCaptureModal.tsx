import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, Leaf, Flower2, Sparkles, TreeDeciduous, Image as ImageIcon } from 'lucide-react';

interface SpeciesDetailCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: File | null, organ: Organ | null) => void;
}

type Organ = 'leaf' | 'flower' | 'fruit' | 'bark';

export function SpeciesDetailCaptureModal({ isOpen, onClose, onConfirm }: SpeciesDetailCaptureModalProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [selectedOrgan, setSelectedOrgan] = useState<Organ | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SURGICAL FIX: Reset state when modal opens to prevent previous tree's close-up from persisting
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setCapturedFile(null);
      setSelectedOrgan(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCapturedFile(file);
      setCapturedImage(URL.createObjectURL(file));
    }
  };

  const handleConfirm = () => {
    onConfirm(capturedFile, selectedOrgan);
  };

  const handleSkip = () => {
    onConfirm(null, null);
  };

  const organOptions: { id: Organ; label: string; icon: React.ReactNode }[] = [
    { id: 'leaf', label: 'Leaf', icon: <Leaf size={20} /> },
    { id: 'bark', label: 'Bark', icon: <TreeDeciduous size={20} /> },
    { id: 'flower', label: 'Flower', icon: <Flower2 size={20} /> },
    { id: 'fruit', label: 'Fruit', icon: <Sparkles size={20} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-background-default w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-stroke-default animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="p-6 border-b border-stroke-default flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-content-default">Add Close-up Detail?</h2>
            <p className="text-sm text-content-subtle mt-1">Help the community identify this tree.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-background-subtle rounded-full text-content-subtle">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">

          {!capturedImage ? (
            <div className="space-y-4">
              <div className="p-4 bg-brand-primary/5 rounded-lg border border-brand-primary/20">
                <div className="flex gap-3">
                  <div className="p-2 bg-brand-primary/10 rounded-full h-fit">
                    <Leaf className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-content-default text-sm">Select what you are capturing:</h3>
                    <p className="text-xs text-content-subtle mt-1">
                      Please choose one option below, then take a clear photo of it.
                    </p>
                  </div>
                </div>
              </div>

              {/* Organ Selection Grid */}
              <div className="grid grid-cols-2 gap-3">
                {organOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      setSelectedOrgan(option.id);
                      // Small delay to show selection before opening camera
                      setTimeout(() => fileInputRef.current?.click(), 200);
                    }}
                    className={`flex flex-col items-center justify-center gap-2 p-4 border rounded-xl transition-all ${selectedOrgan === option.id
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary ring-2 ring-brand-primary ring-offset-2 ring-offset-background-default'
                      : 'border-stroke-default hover:border-brand-primary/50 hover:bg-background-subtle text-content-subtle'
                      }`}
                  >
                    {option.icon}
                    <span className="font-medium text-sm">{option.label}</span>
                  </button>
                ))}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-stroke-default bg-black">
                <img src={capturedImage} alt="Detail" className="w-full h-full object-contain" />
                <button
                  onClick={() => { setCapturedImage(null); setCapturedFile(null); setSelectedOrgan(null); }}
                  className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm"
                >
                  <X size={16} />
                </button>

                {/* Organ Badge */}
                {selectedOrgan && (
                  <div className="absolute bottom-2 left-2 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full flex items-center gap-2 text-white text-xs font-medium border border-white/10">
                    {organOptions.find(o => o.id === selectedOrgan)?.icon}
                    <span className="capitalize">{selectedOrgan}</span>
                  </div>
                )}
              </div>
              <p className="text-center text-sm text-content-subtle">
                Great shot! This will be saved with your tree.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-background-subtle border-t border-stroke-default flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 px-4 py-3 text-content-subtle font-medium hover:bg-background-inset rounded-lg transition-colors"
          >
            {capturedImage ? 'Discard & Submit' : 'Skip'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!!(capturedImage && !selectedOrgan)} // Should not happen with new flow, but safe guard
            className="flex-1 px-4 py-3 bg-brand-primary text-white font-semibold rounded-lg hover:bg-brand-primary-hover shadow-lg shadow-brand-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {capturedImage ? (
              <>
                <Check size={18} />
                Submit with Detail
              </>
            ) : (
              'Submit without Detail'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
