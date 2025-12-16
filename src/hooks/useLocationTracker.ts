import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const UPDATE_INTERVAL = 5000; // Update DB every 5 seconds max
const MIN_DISTANCE_DEG = 0.0001; // Approx 11 meters

export const useLocationTracker = () => {
  const { user } = useAuth();
  const lastUpdateRef = useRef<number>(0);
  const lastPosRef = useRef<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (!user) return;

    const updateLocation = async (lat: number, lng: number) => {
      const now = Date.now();
      
      // Check time throttle
      if (now - lastUpdateRef.current < UPDATE_INTERVAL) return;

      // Check distance throttle
      if (lastPosRef.current) {
        const dist = Math.sqrt(
          Math.pow(lat - lastPosRef.current.lat, 2) + 
          Math.pow(lng - lastPosRef.current.lng, 2)
        );
        if (dist < MIN_DISTANCE_DEG) return; 
      }

      lastUpdateRef.current = now;
      lastPosRef.current = { lat, lng };

      // Upsert location
      // Note: We are not setting squad_id here. 
      // Ideally, when a user joins a squad, we update their record with the squad_id.
      // Or we could fetch it here, but that adds overhead.
      const { error } = await supabase
        .from('user_locations')
        .upsert({
          user_id: user.id,
          lat,
          lng,
          last_updated: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        // console.error('Error updating location:', error);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        updateLocation(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        // console.error('Location watch error:', error)
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 1000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user]);
};
