// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Read the environment variables from the .env.local file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that the environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be defined in the .env.local file');
}

// Create and export the Supabase client instance.
// This single instance will be used across the entire application.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);