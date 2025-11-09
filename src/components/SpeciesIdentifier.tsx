// src/components/SpeciesIdentifier.tsx
import React, { useState } from 'react';
import { Leaf, UploadCloud, Flower2, TreeDeciduous, RotateCcw, Loader2, AlertTriangle, Sparkles, MapPin, CropIcon, TreePine, Check } from 'lucide-react';
import { identifySpecies, IdentificationResponse } from '../apiService';
import { ImageCropper } from './ImageCropper';

type IdentificationData = Omit<IdentificationResponse, 'remainingIdentificationRequests'> | null;

interface SpeciesIdentifierProps {
  onIdentificationComplete: (data: IdentificationData) => void;
  onClear: () => void;
  existingResult: IdentificationData;
  mainImageFile: File | null;
  mainImageSrc: string; // This will now be the original, unmodified image source
  analysisMode: 'session' | 'community';
  co2Value: number | null;
  isCO2Loading: boolean;
}

type Organ = 'leaf' | 'flower' | 'fruit' | 'bark';
type Mode = 'idle' | 'uploading' | 'cropping';

// --- START: SURGICAL REPLACEMENT (THEMING) ---
export function SpeciesIdentifier({ onIdentificationComplete, onClear, existingResult, mainImageFile, mainImageSrc, analysisMode, co2Value, isCO2Loading }: SpeciesIdentifierProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedOrgan, setSelectedOrgan] = useState<Organ | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleCropComplete = (croppedFile: File) => {
    setImageFile(croppedFile);
    setImagePreview(URL.createObjectURL(croppedFile));
    setMode('uploading'); // Transition to organ selection after cropping
    setError(null);
  };

  const handleIdentify = async () => {
    if (!imageFile || !selectedOrgan) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await identifySpecies(imageFile, selectedOrgan);
      if (response.bestMatch) {
        onIdentificationComplete({
          bestMatch: response.bestMatch,
          woodDensity: response.woodDensity,
        });
        if (response.remainingIdentificationRequests !== undefined) {
          setRemainingQuota(response.remainingIdentificationRequests);
        }
      } else {
        setError("Could not identify the species. Try a clearer picture.");
        onIdentificationComplete(null);
      }
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReset = () => {
    onClear();
    setIsLoading(false);
    setError(null);
    setImageFile(null);
    setImagePreview('');
    setSelectedOrgan(null);
    setMode('idle'); // Reset mode to the initial choice screen
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const organOptions: { name: Organ; icon: React.ReactNode }[] = [
    { name: 'leaf', icon: <Leaf className="w-6 h-6" /> },
    { name: 'flower', icon: <Flower2 className="w-6 h-6" /> },
    { name: 'fruit', icon: <Sparkles className="w-6 h-6" /> },
    { name: 'bark', icon: <TreeDeciduous className="w-6 h-6" /> },
  ];

  if (existingResult && existingResult.bestMatch) {
    return (
      <div className="space-y-3">
        <div className="p-4 bg-status-success/10 border-l-4 border-status-success rounded-lg">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="text-xs font-semibold text-status-success uppercase tracking-wide">Species Identified</p>
              <p className="font-bold text-content-default text-lg">{existingResult.bestMatch.scientificName}</p>
              {existingResult.bestMatch.commonNames && existingResult.bestMatch.commonNames.length > 0 && (
                   <p className="text-sm text-content-subtle capitalize">{existingResult.bestMatch.commonNames.join(', ')}</p>
              )}
              <div className="mt-2 space-y-1">
                {existingResult.woodDensity ? (
                  <>
                    <p className="text-sm text-content-default">Wood Density: <span className="font-medium">{existingResult.woodDensity.value.toFixed(2)} {existingResult.woodDensity.unit}</span></p>
                    <p className="flex items-center gap-1.5 text-xs text-content-subtle"><MapPin className="w-3 h-3"/> Source: {existingResult.woodDensity.sourceRegion}</p>
                  </>
                ) : (
                  <p className="text-sm text-content-subtle italic mt-1">Wood Density: Not found in database.</p>
                )}
              </div>
              <div className="w-full bg-background-inset rounded-full h-1.5 mt-2">
                  <div className="bg-status-success h-1.5 rounded-full" style={{ width: `${(existingResult.bestMatch.score || 0) * 100}%` }}></div>
              </div>
              <p className="text-xs text-right text-content-subtle mt-1">Confidence: {((existingResult.bestMatch.score || 0) * 100).toFixed(1)}%</p>
            </div>
            <button onClick={handleReset} className="p-1.5 text-content-subtle hover:text-brand-accent hover:bg-background-subtle rounded-lg transition-colors" title="Identify Again">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* CO2 Sequestration Card */}
        {isCO2Loading ? (
          <div className="p-4 bg-background-subtle border border-stroke-default rounded-lg flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
            <span className="text-sm text-content-subtle">Calculating carbon impact...</span>
          </div>
        ) : co2Value !== null ? (
          <div className="p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-brand-primary/10 rounded-lg">
                <TreePine className="w-5 h-5 text-brand-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-primary uppercase tracking-wide">Annual CO₂ Sequestration</p>
                <p className="text-2xl font-bold text-content-default mt-1">{co2Value.toFixed(2)} <span className="text-sm font-normal text-content-subtle">kg/year</span></p>
                <p className="text-xs text-content-subtle mt-1">Based on tree dimensions and species wood density</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-background-default rounded-lg border border-stroke-default">
      {mode === 'cropping' && mainImageFile && (
        <ImageCropper 
          src={mainImageSrc}
          originalFileName={mainImageFile.name}
          onCropComplete={handleCropComplete}
          onCancel={() => { setMode('idle'); setSelectedOrgan(null); }}
        />
      )}

      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-content-default">Identify Species (Required to Save)</p>
        {(mode === 'uploading' || selectedOrgan) && mode !== 'cropping' && (
           <button onClick={() => { setImageFile(null); setImagePreview(''); setSelectedOrgan(null); setMode('idle'); }} className="text-xs text-brand-secondary hover:underline">Start over</button>
        )}
      </div>

      {remainingQuota !== null && remainingQuota < 50 && (
        <div className="p-2 bg-status-warning/10 border border-status-warning/50 text-status-warning text-xs rounded-md">
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> <p>Low daily quota: {remainingQuota} requests left.</p></div>
        </div>
      )}

      {/* Step 1: Select Plant Part (Organ) */}
      {mode === 'idle' && !selectedOrgan && (
        <div className="space-y-3">
          <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-lg p-3">
            <p className="text-sm font-medium text-content-default mb-2">Step 1: Select Plant Part</p>
            <p className="text-xs text-content-subtle">Choose what you'll photograph for best identification</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {organOptions.map(({ name, icon }) => (
              <button 
                key={name} 
                onClick={() => setSelectedOrgan(name)} 
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-stroke-default hover:border-brand-primary hover:bg-brand-primary/5 text-content-default transition-all group"
              >
                <div className="text-brand-primary group-hover:scale-110 transition-transform">
                  {icon}
                </div>
                <span className="text-sm font-medium capitalize">{name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Upload/Crop Options (shown after organ selection) */}
      {mode === 'idle' && selectedOrgan && (
        <div className="space-y-3">
          <div className="bg-status-success/5 border border-status-success/20 rounded-lg p-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-status-success flex-shrink-0" />
            <p className="text-sm text-content-default">
              <span className="font-medium capitalize">{selectedOrgan}</span> selected. Now upload or crop your image.
            </p>
          </div>
          <div className={`grid grid-cols-1 ${analysisMode === 'session' ? 'sm:grid-cols-2' : ''} gap-3`}>
            {analysisMode === 'session' && (
              <button onClick={() => setMode('uploading')} className="relative text-left flex flex-col items-start justify-start p-3 border-2 border-dashed border-stroke-default rounded-lg hover:border-brand-primary hover:bg-brand-primary/10 text-content-default transition-all">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-brand-primary" />
                  <span className="text-sm font-semibold">Upload Close-up</span>
                </div>
                <span className="text-xs text-brand-primary font-medium mt-1 pl-px">Recommended for best accuracy</span>
              </button>
            )}
            <button onClick={() => setMode('cropping')} disabled={!mainImageFile} className="text-left flex flex-col items-start justify-start p-3 border-2 border-dashed border-stroke-default rounded-lg hover:border-brand-secondary hover:bg-brand-secondary/10 disabled:bg-background-inset disabled:cursor-not-allowed disabled:hover:border-stroke-default text-content-default disabled:text-content-subtle transition-all">
              <div className="flex items-center gap-2">
                <CropIcon className="w-5 h-5" />
                <span className="text-sm font-semibold">Crop from Main Image</span>
              </div>
              <span className="text-xs text-content-subtle mt-1 pl-px">A convenient option</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Upload Interface (after selecting upload) */}
      {mode === 'uploading' && (
        <>
          <div className="bg-status-success/5 border border-status-success/20 rounded-lg p-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-status-success flex-shrink-0" />
            <p className="text-sm text-content-default">
              Upload a close-up photo of the <span className="font-medium capitalize">{selectedOrgan}</span>
            </p>
          </div>
          <div>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-stroke-default border-dashed rounded-md hover:border-brand-primary transition-colors">
              <div className="space-y-1 text-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="mx-auto h-24 w-auto rounded-md" />
                ) : (
                  <UploadCloud className="mx-auto h-12 w-12 text-content-subtle" />
                )}
                <div className="flex text-sm text-content-subtle">
                  <label htmlFor="species-file-upload" className="relative cursor-pointer bg-background-default rounded-md font-medium text-brand-secondary hover:text-brand-secondary-hover">
                    <span>{imageFile ? 'Change image' : 'Upload a close-up'}</span>
                    <input ref={fileInputRef} id="species-file-upload" type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" />
                  </label>
                </div>
              </div>
            </div>
          </div>
          <button onClick={handleIdentify} disabled={!imageFile || !selectedOrgan || isLoading} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-primary text-content-on-brand rounded-lg font-medium hover:bg-brand-primary-hover disabled:bg-background-inset disabled:text-content-subtle transition-all">
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Identifying...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Identify Species
              </>
            )}
          </button>
          {error && <div className="text-xs text-status-error text-center pt-1">{error}</div>}
        </>
      )}
    </div>
  );
}
// --- END: SURGICAL REPLACEMENT (THEMING) ---