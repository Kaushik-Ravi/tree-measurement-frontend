import { supabase } from '../supabaseClient';

export interface Squad {
  id: string;
  name: string;
  code: string;
  members: number;
  created_by: string;
}

export const missionService = {
  // --- SQUADS ---

  async createSquad(name: string, userId: string): Promise<{ data: Squad | null, error: any }> {
    // Generate a simple 6-char code (e.g., "SQ-8392")
    const code = `SQ-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const { data, error } = await supabase
      .from('squads')
      .insert([
        { name, code, created_by: userId }
      ])
      .select()
      .single();

    if (error) return { data: null, error };

    // Auto-add creator as member
    await supabase
      .from('squad_members')
      .insert([{ squad_id: data.id, user_id: userId, role: 'leader' }]);

    return { data: { ...data, members: 1 }, error: null };
  },

  async joinSquad(code: string, userId: string): Promise<{ data: Squad | null, error: any }> {
    // 1. Find squad
    const { data: squad, error: findError } = await supabase
      .from('squads')
      .select('*')
      .eq('code', code)
      .single();

    if (findError || !squad) return { data: null, error: 'Squad not found' };

    // 2. Add member
    const { error: joinError } = await supabase
      .from('squad_members')
      .insert([{ squad_id: squad.id, user_id: userId, role: 'member' }]);

    if (joinError) {
      // Ignore duplicate key error (already joined)
      if (joinError.code !== '23505') return { data: null, error: joinError };
    }

    return { data: { ...squad, members: 1 }, error: null }; // Simplified member count for now
  },

  // --- STREETS (DEMO GENERATOR) ---
  
  // Generates fake streets around a center point for testing
  generateDemoSegments(lat: number, lng: number) {
    const segments = [];
    const R = 0.002; // roughly 200m radius

    // Create a grid of streets
    for (let i = 0; i < 5; i++) {
      // Horizontal streets
      segments.push({
        type: "Feature",
        properties: { 
          id: `h-${i}`, 
          name: `Street ${i + 10}th`, 
          length_meters: Math.floor(100 + Math.random() * 200), 
          status: Math.random() > 0.7 ? 'completed' : 'available' 
        },
        geometry: { 
          type: "LineString", 
          coordinates: [
            [lng - R, lat + (i * R/2) - R],
            [lng + R, lat + (i * R/2) - R]
          ] 
        }
      });

      // Vertical streets
      segments.push({
        type: "Feature",
        properties: { 
          id: `v-${i}`, 
          name: `Avenue ${String.fromCharCode(65 + i)}`, 
          length_meters: Math.floor(150 + Math.random() * 300), 
          status: Math.random() > 0.8 ? 'locked' : 'available' 
        },
        geometry: { 
          type: "LineString", 
          coordinates: [
            [lng + (i * R/2) - R, lat - R],
            [lng + (i * R/2) - R, lat + R]
          ] 
        }
      });
    }
    return { type: "FeatureCollection", features: segments };
  }
};
