import { useState, useEffect, useCallback } from 'react';
import { set, get, del } from 'idb-keyval';
import { Point } from '../apiService';

// Define the shape of the session data we want to persist
export interface SessionState {
  appStatus: string;
  currentView: string;
  instructionText: string;
  distance: string;
  focalLength: number | null;
  scaleFactor: number | null;
  initialPoints: Point[];
  refinePoints: Point[];
  manualPoints: Record<string, Point[]>;
  transientPoint: Point | null;
  imageDimensions: { w: number; h: number } | null;
  deviceHeading: number | null;
  capturedHeading: number | null;
  fovRatio: number | null;
  timestamp: number;
}

// Keys for storage
const STORAGE_KEY_STATE = 'tree_app_session_state';
const STORAGE_KEY_IMAGE = 'tree_app_current_image';
const STORAGE_KEY_PENDING_IMAGE = 'tree_app_pending_image';

export function useSessionPersistence() {
  const [isRestoring, setIsRestoring] = useState(true);
  const [restoredSession, setRestoredSession] = useState<{
    state: SessionState;
    imageFile: File | null;
    pendingImageFile: File | null;
  } | null>(null);

  // 1. Restore Session on Mount
  useEffect(() => {
    const restore = async () => {
      try {
        const savedStateJson = localStorage.getItem(STORAGE_KEY_STATE);
        if (!savedStateJson) {
          setIsRestoring(false);
          return;
        }

        const savedState: SessionState = JSON.parse(savedStateJson);
        
        // Check if session is too old (e.g., > 24 hours)
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (Date.now() - savedState.timestamp > ONE_DAY) {
          console.log('[Persistence] Session expired, clearing.');
          clearSession();
          setIsRestoring(false);
          return;
        }

        console.log('[Persistence] Found saved session, loading images...');
        
        // Load images from IndexedDB
        const imageFile = await get(STORAGE_KEY_IMAGE) as File | undefined;
        const pendingImageFile = await get(STORAGE_KEY_PENDING_IMAGE) as File | undefined;

        setRestoredSession({
          state: savedState,
          imageFile: imageFile || null,
          pendingImageFile: pendingImageFile || null
        });
        
      } catch (error) {
        console.error('[Persistence] Failed to restore session:', error);
        // If corruption, clear it
        clearSession();
      } finally {
        setIsRestoring(false);
      }
    };

    restore();
  }, []);

  // 2. Save Session (Debounced or on specific changes)
  const saveSession = useCallback(async (
    state: Omit<SessionState, 'timestamp'>,
    imageFile: File | null,
    pendingImageFile: File | null
  ) => {
    // Don't save if we are in IDLE or HUB (unless there's a pending file?)
    // Actually, we might want to save even in early stages if user uploaded a photo
    if (state.currentView === 'HUB' && !imageFile) {
      return;
    }

    try {
      // Save metadata to LocalStorage
      const stateToSave: SessionState = {
        ...state,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(stateToSave));

      // Save images to IndexedDB
      if (imageFile) {
        await set(STORAGE_KEY_IMAGE, imageFile);
      } else {
        await del(STORAGE_KEY_IMAGE);
      }

      if (pendingImageFile) {
        await set(STORAGE_KEY_PENDING_IMAGE, pendingImageFile);
      } else {
        await del(STORAGE_KEY_PENDING_IMAGE);
      }
      
      // console.log('[Persistence] Session saved');
    } catch (error) {
      console.error('[Persistence] Failed to save session:', error);
    }
  }, []);

  // 3. Clear Session
  const clearSession = useCallback(async () => {
    try {
      localStorage.removeItem(STORAGE_KEY_STATE);
      await del(STORAGE_KEY_IMAGE);
      await del(STORAGE_KEY_PENDING_IMAGE);
      console.log('[Persistence] Session cleared');
    } catch (error) {
      console.error('[Persistence] Failed to clear session:', error);
    }
  }, []);

  // 4. BeforeUnload Warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only warn if we have a saved state that implies active work
      const savedState = localStorage.getItem(STORAGE_KEY_STATE);
      if (savedState) {
        const state = JSON.parse(savedState);
        // If we are in a session and not just idling
        if (state.currentView === 'SESSION' && state.appStatus !== 'IDLE') {
          e.preventDefault();
          e.returnValue = ''; // Standard for Chrome
          return ''; // Standard for legacy
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return {
    isRestoring,
    restoredSession,
    saveSession,
    clearSession
  };
}
