// src/components/ImageCropper.tsx
import React, { useState, useRef } from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  Crop,
  PixelCrop,
} from 'react-image-crop';
import { getCroppedImg } from '../utils/imageUtils';
import 'react-image-crop/dist/ReactCrop.css';
import { Check, X, ZoomIn, ZoomOut, RefreshCw, AlertTriangle } from 'lucide-react';

interface ImageCropperProps {
  src: string;
  originalFileName: string;
  onCropComplete: (file: File) => void;
  onCancel: () => void;
}

const MIN_CROP_DIMENSION = 256; // Minimum recommended pixels for identification

// This is a helper function to create a centered crop selection
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

// --- START: SURGICAL REPLACEMENT (THEMING) ---
export function ImageCropper({ src, originalFileName, onCropComplete, onCancel }: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  const [showQualityWarning, setShowQualityWarning] = useState(false);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }
  
  const handleCropUpdate = (pixelCrop: PixelCrop) => {
    setCompletedCrop(pixelCrop);

    if (imgRef.current) {
      const sourceImage = new Image();
      sourceImage.src = src;
      const scaleX = sourceImage.naturalWidth / imgRef.current.width;
      const finalWidth = pixelCrop.width * scaleX;
      
      if (finalWidth < MIN_CROP_DIMENSION && pixelCrop.width > 0) {
        setShowQualityWarning(true);
      } else {
        setShowQualityWarning(false);
      }
    }
  };

  async function handleConfirmCrop() {
    if (completedCrop?.width && completedCrop?.height && imgRef.current) {
      try {
        const croppedFile = await getCroppedImg(
          src,
          completedCrop,
          imgRef.current,
          `cropped_${originalFileName}`
        );
        onCropComplete(croppedFile);
      } catch (e) {
        console.error('Error creating cropped image:', e);
      }
    }
  }

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    setPan({ x: 0, y: 0 });
  };
  
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  
  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const newX = e.clientX - panStart.x;
    const newY = e.clientY - panStart.y;
    setPan({ x: newX, y: newY });
  };

  const onMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-background-default rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-stroke-default">
          <h3 className="text-lg font-semibold text-content-default">Crop Image</h3>
          <p className="text-sm text-content-subtle">Zoom and pan to select a part of the image for identification.</p>
        </div>

        <div
          className="flex-grow p-4 overflow-hidden flex items-center justify-center bg-background-inset relative"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUpOrLeave}
          onMouseLeave={onMouseUpOrLeave}
          style={{ cursor: isPanning ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
        >
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={handleCropUpdate}
            aspect={1}
            minWidth={50}
            minHeight={50}
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={src}
              onLoad={onImageLoad}
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                maxWidth: '100%',
                maxHeight: '65vh',
              }}
            />
          </ReactCrop>

           {showQualityWarning && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-auto px-4 py-2 bg-amber-500/90 text-white text-xs font-semibold rounded-full flex items-center gap-2 shadow-lg animate-fade-in-down">
              <AlertTriangle className="w-4 h-4" />
              <span>Small selection may lead to inaccurate results.</span>
            </div>
          )}
        </div>
        
        <div className="flex-shrink-0 p-3 border-t border-stroke-default bg-background-subtle flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-lg">
          <div className="flex items-center gap-2 w-full sm:w-auto">
              <ZoomOut className="w-5 h-5 text-content-subtle" />
              <input
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-background-inset rounded-lg appearance-none cursor-pointer"
                aria-label="Zoom slider"
              />
              <ZoomIn className="w-5 h-5 text-content-subtle" />
              <button onClick={resetView} className="p-2 text-content-subtle hover:bg-background-inset rounded-full" aria-label="Reset view">
                  <RefreshCw className="w-4 h-4" />
              </button>
          </div>
          <div className="flex justify-end gap-3 w-full sm:w-auto">
            <button
              onClick={onCancel}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-content-default bg-background-inset rounded-lg hover:opacity-80"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleConfirmCrop}
              disabled={!completedCrop?.width || !completedCrop?.height}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-brand-primary text-content-on-brand rounded-lg font-medium hover:bg-brand-primary-hover disabled:bg-background-inset disabled:text-content-subtle"
            >
              <Check className="w-4 h-4" />
              Confirm Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// --- END: SURGICAL REPLACEMENT (THEMING) ---