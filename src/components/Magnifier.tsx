import React from 'react';

interface MagnifierProps {
  x: number;
  y: number;
  imageSrc: string;
  zoom?: number;
  size?: number;
  canvas: HTMLCanvasElement | null;
  offsetY?: number;
}

export const Magnifier: React.FC<MagnifierProps> = ({ 
  x, 
  y, 
  imageSrc, 
  zoom = 3, 
  size = 140, 
  canvas,
  offsetY = -100 
}) => {
  if (!canvas || !imageSrc) return null;

  const rect = canvas.getBoundingClientRect();
  const relX = x - rect.left;
  const relY = y - rect.top;

  // Only show if within canvas bounds (with small buffer)
  if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return null;

  // Calculate background size
  // The background image needs to match the displayed size of the canvas * zoom
  const bgWidth = rect.width * zoom;
  const bgHeight = rect.height * zoom;
  
  // Calculate background position
  // We want the pixel under the cursor (relX, relY) to be in the center of the magnifier
  const bgPosX = -1 * (relX * zoom - size / 2);
  const bgPosY = -1 * (relY * zoom - size / 2);

  return (
    <div
      className="fixed pointer-events-none z-50 overflow-hidden bg-white shadow-2xl border-4 border-white rounded-full"
      style={{
        left: x - size / 2,
        top: y - size / 2 + offsetY,
        width: size,
        height: size,
        backgroundImage: `url(${imageSrc})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${bgWidth}px ${bgHeight}px`,
        backgroundPosition: `${bgPosX}px ${bgPosY}px`
      }}
    >
      {/* Crosshair */}
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500/60 transform -translate-y-1/2"></div>
      <div className="absolute left-1/2 top-0 h-full w-0.5 bg-red-500/60 transform -translate-x-1/2"></div>
    </div>
  );
};
