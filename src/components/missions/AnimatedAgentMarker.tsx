import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import { UserLocation } from '../../types/mission';

// Custom hook for smooth animation
const useSmoothPosition = (targetLat: number, targetLng: number, duration: number = 1000) => {
  const [currentPos, setCurrentPos] = useState<[number, number]>([targetLat, targetLng]);
  const frameRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const startPosRef = useRef<[number, number]>([targetLat, targetLng]);
  const targetPosRef = useRef<[number, number]>([targetLat, targetLng]);

  useEffect(() => {
    // If target changed, start animation
    if (targetLat !== targetPosRef.current[0] || targetLng !== targetPosRef.current[1]) {
      startPosRef.current = currentPos;
      targetPosRef.current = [targetLat, targetLng];
      startTimeRef.current = performance.now();
      
      const animate = (time: number) => {
        const elapsed = time - (startTimeRef.current || time);
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        
        const lat = startPosRef.current[0] + (targetPosRef.current[0] - startPosRef.current[0]) * ease;
        const lng = startPosRef.current[1] + (targetPosRef.current[1] - startPosRef.current[1]) * ease;
        
        setCurrentPos([lat, lng]);
        
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate);
        }
      };
      
      frameRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [targetLat, targetLng, duration]);

  return currentPos;
};

const AnimatedAgentMarker = ({ agent, icon }: { agent: UserLocation, icon: L.DivIcon }) => {
  const position = useSmoothPosition(agent.lat, agent.lng);
  
  return (
    <Marker 
      position={position}
      icon={icon}
      zIndexOffset={1000}
    >
      <Popup>
        <div className="text-sm font-bold">Agent</div>
        <div className="text-xs text-gray-500">Last seen: {new Date(agent.last_updated).toLocaleTimeString()}</div>
      </Popup>
    </Marker>
  );
};

export default AnimatedAgentMarker;
