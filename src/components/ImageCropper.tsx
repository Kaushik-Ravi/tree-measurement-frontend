// src/components/ImageCropper.tsx
import React from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  Crop,
  PixelCrop,
} from 'react-image-crop';
import { getCroppedImg } from '../utils/imageUtils';
import 'react-image-crop/dist/ReactCrop.css';
import { Check, X } from 'lucide-react';

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
  const [crop, setCrop] = React.useState<Crop>();
  const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>();

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    // Set a default centered crop area when the image loads
    setCrop(centerAspectCrop(width, height, 1));
  }

  async function handleConfirmCrop() {
    if (completedCrop?.width && completedCrop?.height && imgRef.current) {
      try {
        const croppedFile = await getCroppedImg(
          imgRef.current,
          completedCrop,
          `cropped_${originalFileName}`
        );
        onCropComplete(croppedFile);
      } catch (e) {
        console.error('Error creating cropped image:', e);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Crop Image</h3>
          <p className="text-sm text-gray-500">Select a part of the image for species identification.</p>
        </div>
        <div className="flex-grow p-4 overflow-y-auto flex items-center justify-center">
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
                className="max-h-[65vh] object-contain"
              />
            </ReactCrop>
        </div>
        <div className="flex-shrink-0 p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-lg">
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
  );
}