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
import { Check, X, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface ImageCropperProps {
  src: string;
  originalFileName: string;
  onCropComplete: (file: File) => void;
  onCancel: () => void;
}

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

export function ImageCropper({ src, originalFileName, onCropComplete, onCancel }: ImageCropperProps) {
  const imgRef = React.useRef<HTMLImageElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }

  async function handleConfirmCrop() {
    if (completedCrop?.width && completedCrop?.height && imgRef.current) {
      try {
        // We need to pass the untransformed image to the crop utility.
        // We can achieve this by creating a temporary, untransformed image object.
        const originalImage = new Image();
        originalImage.src = src;
        originalImage.onload = async () => {
           const croppedFile = await getCroppedImg(
            originalImage, // Pass the original, not the transformed ref
            completedCrop,
            `cropped_${originalFileName}`
          );
          onCropComplete(croppedFile);
        }
      } catch (e) {
        console.error('Error creating cropped image:', e);
      }
    }
  }

  const handleZoomChange = (newZoom: number) => {
    // When zoom changes, reset pan to avoid the image being off-center
    setZoom(newZoom);
    setPan({ x: 0, y: 0 });
  };
  
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  
  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault(); // Prevent default image drag behavior
    setIsPanning(true);
    setPanStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    // Calculate new pan position, but constrain it so the image doesn't go too far
    const newX = e.clientX - panStart.x;
    const newY = e.clientY - panStart.y;
    setPan({ x: newX, y: newY });
  };

  const onMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Crop Image</h3>
          <p className="text-sm text-gray-500">Zoom and pan to select a part of the image for identification.</p>
        </div>

        {/* This container is the viewport for the zoomable/pannable image */}
        <div
          ref={containerRef}
          className="flex-grow p-4 overflow-hidden flex items-center justify-center bg-gray-100"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUpOrLeave}
          onMouseLeave={onMouseUpOrLeave}
          style={{ cursor: isPanning ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
        >
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            minWidth={100}
            minHeight={100}
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
        </div>
        
        {/* Controls for Zoom and Actions */}
        <div className="flex-shrink-0 p-3 border-t bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-lg">
          <div className="flex items-center gap-2 w-full sm:w-auto">
              <ZoomOut className="w-5 h-5 text-gray-500" />
              <input
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                aria-label="Zoom slider"
              />
              <ZoomIn className="w-5 h-5 text-gray-500" />
              <button onClick={resetView} className="p-2 text-gray-600 hover:bg-gray-200 rounded-full" aria-label="Reset view">
                  <RefreshCw className="w-4 h-4" />
              </button>
          </div>
          <div className="flex justify-end gap-3 w-full sm:w-auto">
            <button
              onClick={onCancel}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleConfirmCrop}
              disabled={!completedCrop?.width || !completedCrop?.height}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 disabled:bg-gray-400"
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