export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export interface Squad {
  id: string;
  name: string;
  code: string;
  members: number;
  created_by: string;
  created_at?: string;
}

export interface StreetSegmentProperties {
  id: string;
  name: string;
  length_meters: number;
  status: 'available' | 'locked' | 'assigned' | 'completed';
  assignee_id?: string | null;
  squad_id?: string | null;
}

export interface StreetSegmentFeature {
  type: "Feature";
  properties: StreetSegmentProperties;
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
}

export interface StreetSegmentCollection {
  type: "FeatureCollection";
  features: StreetSegmentFeature[];
}

export interface ChatMessage {
  id: string;
  squad_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  related_segment_id?: string;
  location_lat?: number;
  location_lng?: number;
  sender?: {
    email: string;
  };
}

export interface UserLocation {
  user_id: string;
  lat: number;
  lng: number;
  last_updated: string;
}
