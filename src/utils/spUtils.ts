// Utility functions for Sapling Points (SP) gamification system
// Handles API communication with backend for quiz point awards

import { supabase } from '../supabaseClient';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export interface QuizPointsResponse {
  status: 'success' | 'error';
  points_awarded?: number;
  correct_answers?: number;
  message: string;
}

/**
 * Award SP for quiz engagement during processing
 * Calls backend endpoint which uses existing add_sapling_points() function
 * 
 * @param correctAnswers Number of correct answers (0.5 SP each)
 * @returns Response with points awarded and status
 */
export const awardQuizPoints = async (correctAnswers: number): Promise<QuizPointsResponse> => {
  try {
    // Get current session for auth token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.warn('[SP Utils] No active session, skipping quiz points award');
      return {
        status: 'error',
        message: 'Not authenticated'
      };
    }
    
    // Validate input
    if (correctAnswers < 0 || correctAnswers > 12) {
      console.error('[SP Utils] Invalid correct answers count:', correctAnswers);
      return {
        status: 'error',
        message: 'Invalid correct answers count'
      };
    }
    
    // Skip if no points to award
    if (correctAnswers === 0) {
      return {
        status: 'success',
        points_awarded: 0,
        correct_answers: 0,
        message: 'Thanks for participating!'
      };
    }
    
    console.log(`[SP Utils] Awarding quiz points for ${correctAnswers} correct answers`);
    
    // Call backend endpoint
    const formData = new FormData();
    formData.append('correct_answers', correctAnswers.toString());
    
    const response = await fetch(`${BACKEND_URL}/api/award_quiz_points`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SP Utils] HTTP ${response.status}:`, errorText);
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: QuizPointsResponse = await response.json();
    console.log('[SP Utils] Quiz points awarded successfully:', data);
    
    return data;
    
  } catch (error) {
    console.error('[SP Utils] Error awarding quiz points:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to award points'
    };
  }
};

/**
 * Format SP count for display
 * @param points Number of points
 * @returns Formatted string (e.g., "2.5 SP")
 */
export const formatSP = (points: number): string => {
  return `${points.toFixed(1)} SP`;
};
