import React, { useState, useRef } from 'react';
import { Camera, X, Check, Leaf, Flower2, Sparkles, TreeDeciduous, Image as ImageIcon } from 'lucide-react';

interface SpeciesDetailCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: File | null) => void;
}

type Organ = 'leaf' | 'flower' | 'fruit' | 'bark';

export function SpeciesDetailCaptureModal({ isOpen, onClose, onConfirm }: SpeciesDetailCaptureModalProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCapturedFile(file);
      setCapturedImage(URL.createObjectURL(file));
    }
  };

  const handleConfirm = () => {
    onConfirm(capturedFile);
  };

  const handleSkip = () => {
    onConfirm(null);
  };

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
                    <h3 className="font-semibold text-content-default text-sm">Why add a close-up?</h3>
                    <p className="text-xs text-content-subtle mt-1">
                      The main photo is great for measuring, but leaves, bark, or fruit are best for identifying the species.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-stroke-default rounded-xl hover:border-brand-primary hover:bg-brand-primary/5 transition-all group"
                >
                  <div className="p-3 bg-background-subtle rounded-full group-hover:bg-brand-primary/10 transition-colors">
                    <Camera className="w-6 h-6 text-brand-primary" />
                  </div>
                  <span className="font-medium text-content-default">Take Photo</span>
                </button>
                
                <div className="flex flex-col justify-center gap-2">
                   <div className="flex items-center gap-2 text-xs text-content-subtle">
                      <Leaf size={14} /> Leaf
                   </div>
                   <div className="flex items-center gap-2 text-xs text-content-subtle">
                      <TreeDeciduous size={14} /> Bark
                   </div>
                   <div className="flex items-center gap-2 text-xs text-content-subtle">
                      <Flower2 size={14} /> Flower
                   </div>
                   <div className="flex items-center gap-2 text-xs text-content-subtle">
                      <Sparkles size={14} /> Fruit
                   </div>
                </div>
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
                  onClick={() => { setCapturedImage(null); setCapturedFile(null); }}
                  className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm"
                >
                  <X size={16} />
                </button>
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
            className="flex-1 px-4 py-3 bg-brand-primary text-white font-semibold rounded-lg hover:bg-brand-primary-hover shadow-lg shadow-brand-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
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
