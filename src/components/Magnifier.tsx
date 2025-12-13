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

  // --- SMART POSITIONING LOGIC ---
  // 1. Vertical Flip (Anti-Crop)
  // Default is above the finger (offsetY is negative)
  let finalOffsetY = offsetY;
  const topEdge = y - size / 2 + offsetY;
  
  // If the magnifier goes off the top of the screen, flip it to below the finger
  if (topEdge < 0) {
    finalOffsetY = Math.abs(offsetY);
  }

  // 2. Horizontal Clamp (Side-Scroll Fix)
  let finalLeft = x - size / 2;
  
  // Clamp to left edge
  if (finalLeft < 0) {
    finalLeft = 0;
  } 
  // Clamp to right edge
  else if (finalLeft + size > window.innerWidth) {
    finalLeft = window.innerWidth - size;
  }
  // --- END SMART POSITIONING ---

  return (
    <div
      className="fixed pointer-events-none z-50 overflow-hidden bg-white shadow-2xl border-4 border-white rounded-full"
      style={{
        left: finalLeft,
        top: y - size / 2 + finalOffsetY,
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
