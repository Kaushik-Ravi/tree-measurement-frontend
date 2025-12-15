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

  async getSquadMembers(squadId: string) {
    const { data, error } = await supabase
      .from('squad_members')
      .select(`
        user_id,
        role,
        users:user_id (
          email
        )
      `)
      .eq('squad_id', squadId);
      
    return { data, error };
  },

  // --- CHAT & ASSIGNMENTS ---

  async sendChatMessage(squadId: string, userId: string, message: string, relatedSegmentId?: string, location?: {lat: number, lng: number}) {
    const payload: any = {
      squad_id: squadId,
      sender_id: userId,
      message
    };
    if (relatedSegmentId) payload.related_segment_id = relatedSegmentId;
    if (location) {
      payload.location_lat = location.lat;
      payload.location_lng = location.lng;
    }

    return await supabase.from('squad_chat').insert([payload]);
  },

  async getChatMessages(squadId: string) {
    return await supabase
      .from('squad_chat')
      .select(`
        *,
        sender:sender_id (email)
      `)
      .eq('squad_id', squadId)
      .order('created_at', { ascending: true })
      .limit(50);
  },

  async assignSegment(squadId: string, segmentId: string, assigneeId: string, assignerId: string) {
    // 1. Create assignment
    const { data, error } = await supabase.from('assignments').insert([{
      squad_id: squadId,
      segment_id: segmentId,
      assignee_id: assigneeId,
      assigned_by: assignerId,
      status: 'pending'
    }]).select().single();

    if (error) return { error };

    // 2. Create notification for assignee
    await supabase.from('notifications').insert([{
      user_id: assigneeId,
      type: 'assignment',
      payload: {
        assignment_id: data.id,
        segment_id: segmentId,
        message: 'You have been assigned a new street segment.'
      }
    }]);

    return { data, error: null };
  },

  async updateUserLocation(userId: string, squadId: string, lat: number, lng: number) {
    return await supabase.from('user_locations').upsert({
      user_id: userId,
      squad_id: squadId,
      lat,
      lng,
      last_updated: new Date().toISOString()
    });
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
