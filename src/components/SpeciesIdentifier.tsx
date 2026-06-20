// src/components/SpeciesIdentifier.tsx
import React, { useState } from 'react';
import { Leaf, UploadCloud, Flower2, TreeDeciduous, RotateCcw, Loader2, AlertTriangle, Sparkles, MapPin, CropIcon, TreePine, Check, Camera } from 'lucide-react';
import { identifySpecies, IdentificationResponse } from '../apiService';
import { compressImage } from '../utils/imageCompression';
import { ImageCropper } from './ImageCropper';
import { CO2ResultCard } from './CO2ResultCard';

type IdentificationData = Omit<IdentificationResponse, 'remainingIdentificationRequests'> | null;

interface SpeciesIdentifierProps {
  onIdentificationComplete: (data: IdentificationData) => void;
  onClear: () => void;
  existingResult: IdentificationData;
  mainImageFile: File | null;
  mainImageSrc: string; // This will now be the original, unmodified image source
  analysisMode: 'session' | 'community';
  co2Value: number | null;
  tolerance?: number | null;
  isCO2Loading: boolean;
  closeupImageUrl?: string;
  closeupOrgan?: string;
}

type Organ = 'leaf' | 'flower' | 'fruit' | 'bark';
type Mode = 'idle' | 'uploading' | 'cropping' | 'manual';

// --- START: SURGICAL REPLACEMENT (THEMING) ---
export function SpeciesIdentifier({ onIdentificationComplete, onClear, existingResult, mainImageFile, mainImageSrc, analysisMode, co2Value, tolerance, isCO2Loading, closeupImageUrl, closeupOrgan }: SpeciesIdentifierProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoIdentifying, setIsAutoIdentifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedOrgan, setSelectedOrgan] = useState<Organ | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [manualSpeciesName, setManualSpeciesName] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const autoIdentifyAttempted = React.useRef(false);

  // --- AUTO-IDENTIFY FROM SAVED CLOSE-UP ---
  React.useEffect(() => {
    if (closeupImageUrl && closeupOrgan && !existingResult && !imageFile && !isLoading && !autoIdentifyAttempted.current) {
      autoIdentifyAttempted.current = true;
      const loadAndIdentify = async () => {
        setIsLoading(true);
        setIsAutoIdentifying(true);
        setMode('uploading');
        try {
          console.log("Auto-identifying from saved close-up:", closeupImageUrl);
          const response = await fetch(closeupImageUrl);
          const blob = await response.blob();
          const file = new File([blob], "closeup.jpg", { type: blob.type });
          
          setImageFile(file);
          // Thumbnail bypassed to prevent UI lock
          
          // Validate organ
          const validOrgans: Organ[] = ['leaf', 'flower', 'fruit', 'bark'];
          const organToUse = validOrgans.includes(closeupOrgan as Organ) ? (closeupOrgan as Organ) : 'leaf';
          setSelectedOrgan(organToUse);

          // Auto identify
          const idResponse = await identifySpecies(file, organToUse);
          if (idResponse.bestMatch) {
            onIdentificationComplete({
              bestMatch: idResponse.bestMatch,
              woodDensity: idResponse.woodDensity,
            });
            if (idResponse.remainingIdentificationRequests !== undefined) {
              setRemainingQuota(idResponse.remainingIdentificationRequests);
            }
          } else {
             setError("Could not identify the species from the saved close-up.");
             onIdentificationComplete(null);
          }

        } catch (err: any) {
          console.error("Auto-identify error:", err);
          setError("Failed to load saved close-up: " + err.message);
        } finally {
          setIsLoading(false);
          setIsAutoIdentifying(false);
        }
      };
      loadAndIdentify();
    }
  }, [closeupImageUrl, closeupOrgan]);


  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      // 🔥 THE USER'S BRILLIANT FIX: Bypass thumbnail entirely to prevent DOM freeze!
      // setImagePreview(URL.createObjectURL(file)); 
      
      // Directly trigger identification to save clicks and prevent DOM lockup!
      await performIdentification(file);
    }
  };

  const handleCropComplete = (croppedFile: File) => {
    setImageFile(croppedFile);
    // Bypass thumbnail here as well for consistency
    // setImagePreview(URL.createObjectURL(croppedFile));
    setMode('uploading'); 
    setError(null);
    
    // Auto-identify after crop
    performIdentification(croppedFile);
  };

  const performIdentification = async (fileToIdentify: File) => {
    if (!selectedOrgan) return;
    setIsLoading(true);
    setError(null);
    try {
      // The user explicitly requested RAW uncompressed files for maximum PlantNet API quality
      const response = await identifySpecies(fileToIdentify, selectedOrgan);
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

  const handleIdentify = async () => {
    if (imageFile) {
        await performIdentification(imageFile);
    }
  };
  
  const handleReset = () => {
    onClear();
    setIsLoading(false);
    setError(null);
    setImageFile(null);
    setImagePreview('');
    setSelectedOrgan(null);
    setManualSpeciesName('');
    setMode('idle'); // Reset mode to the initial choice screen
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleManualSubmit = () => {
    if (!manualSpeciesName.trim()) {
      setError("Please enter a species name.");
      return;
    }
    
    // Create a manual result with the generic wood density fallback
    onIdentificationComplete({
      bestMatch: {
        scientificName: manualSpeciesName.trim(),
        commonNames: ['Manual Entry'],
        score: 1.0
      },
      woodDensity: {
        value: 0.6, // Generic fallback as per researcher data
        unit: 'g/cm³',
        sourceRegion: 'Generic Wood Database (Fallback)'
      }
    });
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
                <p className="text-sm text-content-subtle mt-1">
                  Also known as: {existingResult.bestMatch.commonNames?.join(', ') || 'N/A'}
                </p>
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
        <CO2ResultCard co2Value={co2Value} tolerance={tolerance} isLoading={isCO2Loading} />
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
        {(mode === 'uploading' || selectedOrgan || mode === 'manual') && mode !== 'cropping' && (
           <button onClick={() => { setImageFile(null); setImagePreview(''); setSelectedOrgan(null); setManualSpeciesName(''); setMode('idle'); }} className="text-xs text-brand-secondary hover:underline">Start over</button>
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
          
          <div className="flex items-center justify-center gap-2 mt-4">
             <div className="h-px bg-stroke-default flex-1"></div>
             <span className="text-xs text-content-subtle font-medium px-2">OR</span>
             <div className="h-px bg-stroke-default flex-1"></div>
          </div>
          <button 
            onClick={() => setMode('manual')}
            className="w-full mt-2 px-4 py-3 bg-background-inset border border-stroke-default rounded-lg hover:border-brand-secondary text-sm font-medium text-content-default transition-all"
          >
             Skip Auto-ID / Manual Entry
          </button>
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
              Take a close-up photo of the <span className="font-medium capitalize">{selectedOrgan}</span>
            </p>
          </div>
          
          {isLoading ? (
            <div className="mt-1 flex flex-col items-center justify-center px-6 py-10 border-2 border-brand-primary/30 bg-brand-primary/5 rounded-md">
              <Loader2 className="h-10 w-10 text-brand-primary animate-spin mb-3" />
              <p className="text-sm font-medium text-brand-primary">Uploading & Identifying...</p>
              <p className="text-xs text-content-subtle mt-1 text-center">Processing high-res photo directly to preserve quality.</p>
            </div>
          ) : (
            <div>
              <label htmlFor="species-file-upload" className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-stroke-default border-dashed rounded-md hover:border-brand-primary transition-colors cursor-pointer block w-full">
                <div className="space-y-1 text-center w-full">
                  <Camera className="mx-auto h-12 w-12 text-content-subtle" />
                  <div className="flex text-sm text-content-subtle justify-center">
                    <div className="relative bg-background-default rounded-md font-medium text-brand-secondary hover:text-brand-secondary-hover mt-2">
                      <span>Take a close-up</span>
                      <input ref={fileInputRef} id="species-file-upload" type="file" capture="environment" className="sr-only" onChange={handleImageUpload} accept="image/*" />
                    </div>
                  </div>
                </div>
              </label>
            </div>
          )}

          {error && <div className="text-xs text-status-error text-center pt-2 font-medium">{error}</div>}
        </>
      )}

      {/* Manual Entry Interface */}
      {mode === 'manual' && (
        <div className="space-y-4">
          <div className="bg-brand-secondary/5 border border-brand-secondary/20 rounded-lg p-3">
            <p className="text-sm font-medium text-content-default">Manual Species Entry</p>
            <p className="text-xs text-content-subtle mt-1">If the species is not in our wood database, it will default to a generic fallback density (0.6 g/cm³).</p>
          </div>
          
          <div>
             <label className="block text-xs font-medium text-content-default mb-1">Scientific Name / Species</label>
             <input 
               type="text" 
               placeholder="e.g. Mangifera indica"
               value={manualSpeciesName}
               onChange={(e) => { setManualSpeciesName(e.target.value); setError(null); }}
               className="w-full px-3 py-2 bg-background-default border border-stroke-default rounded-lg text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
               autoFocus
             />
             {error && <p className="text-xs text-status-error mt-1">{error}</p>}
          </div>

          <button 
             onClick={handleManualSubmit}
             className="w-full py-3 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary-hover transition-all flex items-center justify-center gap-2"
          >
             <Check className="w-5 h-5" />
             Submit Species
          </button>
        </div>
      )}
    </div>
  );
}
// --- END: SURGICAL REPLACEMENT (THEMING) ---