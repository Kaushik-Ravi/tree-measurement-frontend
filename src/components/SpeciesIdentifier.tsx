// src/components/SpeciesIdentifier.tsx
import React, { useState } from 'react';
import { Leaf, UploadCloud, Flower2, TreeDeciduous, X, Loader2, AlertTriangle, Sparkles, MapPin } from 'lucide-react';
import { identifySpecies, IdentificationResponse } from '../apiService';

type IdentificationData = Omit<IdentificationResponse, 'remainingIdentificationRequests'> | null;

interface SpeciesIdentifierProps {
  onIdentificationComplete: (data: IdentificationData) => void;
  onClear: () => void;
  existingResult: IdentificationData;
}

type Organ = 'leaf' | 'flower' | 'fruit' | 'bark';

export function SpeciesIdentifier({ onIdentificationComplete, onClear, existingResult }: SpeciesIdentifierProps) {
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const organOptions: { name: Organ; icon: React.ReactNode }[] = [
    { name: 'leaf', icon: <Leaf className="w-4 h-4" /> },
    { name: 'flower', icon: <Flower2 className="w-4 h-4" /> },
    { name: 'fruit', icon: <Sparkles className="w-4 h-4" /> },
    { name: 'bark', icon: <TreeDeciduous className="w-4 h-4" /> },
  ];

  if (existingResult && existingResult.bestMatch) {
    return (
      <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Species Identified</p>
            <p className="font-bold text-green-900 text-lg">{existingResult.bestMatch.scientificName}</p>
            {existingResult.bestMatch.commonNames && existingResult.bestMatch.commonNames.length > 0 && (
                 <p className="text-sm text-gray-600 capitalize">{existingResult.bestMatch.commonNames.join(', ')}</p>
            )}
            <div className="mt-2 space-y-1">
              {existingResult.woodDensity ? (
                <>
                  <p className="text-sm text-gray-700">Wood Density: <span className="font-medium">{existingResult.woodDensity.value.toFixed(2)} {existingResult.woodDensity.unit}</span></p>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500"><MapPin className="w-3 h-3"/> Source: {existingResult.woodDensity.sourceRegion}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500 italic mt-1">Wood Density: Not found in database.</p>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${(existingResult.bestMatch.score || 0) * 100}%` }}></div>
            </div>
            <p className="text-xs text-right text-gray-500 mt-1">Confidence: {((existingResult.bestMatch.score || 0) * 100).toFixed(1)}%</p>
          </div>
          <button onClick={handleReset} className="p-1 text-gray-500 hover:text-red-600 rounded-full"><X className="w-4 h-4" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-white rounded-lg border">
      <p className="text-sm font-medium text-gray-700">Optional: Identify species</p>
      {remainingQuota !== null && remainingQuota < 50 && (
        <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md">
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> <p>Low daily quota: {remainingQuota} requests left.</p></div>
        </div>
      )}
      <div>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
          <div className="space-y-1 text-center">
            {imagePreview ? <img src={imagePreview} alt="Preview" className="mx-auto h-24 w-auto rounded-md" /> : <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />}
            <div className="flex text-sm text-gray-600"><label htmlFor="species-file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500"><span>Upload a close-up</span><input ref={fileInputRef} id="species-file-upload" type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" /></label></div>
          </div>
        </div>
      </div>
      <div>
        <div className="grid grid-cols-2 gap-3">
          {organOptions.map(({ name, icon }) => (
            <button key={name} onClick={() => setSelectedOrgan(name)} className={`flex items-center justify-center gap-2 p-3 rounded-md border text-sm font-medium transition-all ${selectedOrgan === name ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white hover:bg-gray-100'}`}>
              {icon}
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <button onClick={handleIdentify} disabled={!imageFile || !selectedOrgan || isLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 disabled:bg-gray-300">
        {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Identifying...</> : <><Sparkles className="w-5 h-5" /> Identify</>}
      </button>
      {error && <div className="text-xs text-red-600 text-center pt-1">{error}</div>}
    </div>
  );
}