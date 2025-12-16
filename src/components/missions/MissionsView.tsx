import React, { useState, useEffect, useCallback } from 'react';
import { MissionMap } from './MissionMap';
import { MissionControlPanel } from './MissionControlPanel';
import { SquadControl } from './SquadControl';
import { SquadOpsPanel } from './SquadOpsPanel';
import { ArrowLeft, Users, Map as MapIcon, X, Loader2, MessageSquare } from 'lucide-react';
import { missionService } from '../../services/missionService';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';

interface MissionsViewProps {
  onBack: () => void;
}

export const MissionsView: React.FC<MissionsViewProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [selectedSegments, setSelectedSegments] = useState<any[]>([]);
  const [currentSquad, setCurrentSquad] = useState<any>(null);
  const [showSquadPanel, setShowSquadPanel] = useState(false); // The modal for join/create
  const [showOpsPanel, setShowOpsPanel] = useState(false); // The side panel for chat/tasks
  const [isLoading, setIsLoading] = useState(false);
  const [demoSegments, setDemoSegments] = useState<any>(null);

  const handleSegmentSelect = (segment: any) => {
    setSelectedSegments(prev => {
      const exists = prev.find(s => s.properties.id === segment.properties.id);
      if (exists) {
        return prev.filter(s => s.properties.id !== segment.properties.id);
      } else {
        return [...prev, segment];
      }
    });
  };

  // Load real data from Supabase based on bounds
  const fetchSegmentsInBounds = useCallback(async (bounds: any) => {
    if (!bounds) return;
    
    setIsLoading(true); // Start loading
    const { _southWest, _northEast } = bounds;
    const minLat = _southWest.lat;
    const maxLat = _northEast.lat;
    const minLng = _southWest.lng;
    const maxLng = _northEast.lng;

    console.log('Fetching segments in bounds:', minLat, maxLat, minLng, maxLng);

    const { data, error } = await supabase
      .from('street_segments')
      .select('*')
      .gte('lat', minLat)
      .lte('lat', maxLat)
      .gte('lng', minLng)
      .lte('lng', maxLng)
      .limit(2000); // Fetch up to 2000 segments in the current view

    if (data && data.length > 0) {
      console.log('Loaded segments:', data.length);
      const features = data.map(seg => ({
        type: "Feature",
        properties: {
          id: seg.id,
          name: seg.name,
          length_meters: seg.length_meters,
          status: seg.status
        },
        geometry: seg.geometry
      }));
      setDemoSegments({ type: "FeatureCollection", features });
    }
    setIsLoading(false); // Stop loading
  }, []);

  // Initial load (optional, or rely on map move)
  useEffect(() => {
    // We can trigger an initial fetch if we have a default location, 
    // but the map's onMoveEnd will trigger shortly after mount anyway.
  }, []);

  const handleJoinSquad = async (code: string) => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await missionService.joinSquad(code, user.id);
    setIsLoading(false);
    
    if (error) {
      alert('Error joining squad: ' + (error.message || error));
    } else {
      setCurrentSquad(data);
      setShowOpsPanel(true); // Auto-open ops panel
      alert(`Joined ${data?.name}!`);
    }
  };

  const handleCreateSquad = async (name: string) => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await missionService.createSquad(name, user.id);
    setIsLoading(false);

    if (error) {
      alert('Error creating squad: ' + (error.message || error));
    } else {
      setCurrentSquad(data);
      setShowOpsPanel(true); // Auto-open ops panel
      alert(`Created ${data?.name}! Share code: ${data?.code}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background-default">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-stroke-default flex items-center justify-between bg-background-default z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-background-subtle rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-content-default" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-content-default">Mission Control</h1>
            <p className="text-xs text-content-subtle">Select a street segment to begin patrol</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            {currentSquad && (
                <button 
                    onClick={() => setShowOpsPanel(!showOpsPanel)}
                    className={`p-2 rounded-lg transition-colors ${showOpsPanel ? 'bg-brand-secondary text-white' : 'hover:bg-background-subtle text-brand-secondary'}`}
                    title="Toggle Squad Ops"
                >
                    <MessageSquare size={24} />
                </button>
            )}
            <button 
            onClick={() => setShowSquadPanel(true)}
            className={`p-2 rounded-lg transition-colors ${showSquadPanel ? 'bg-brand-primary text-white' : 'hover:bg-background-subtle text-content-default'}`}
            >
            <Users size={24} />
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Map takes full space */}
        <div className="flex-1 relative z-0">
           <MissionMap 
             onSegmentSelect={handleSegmentSelect} 
             segments={demoSegments} // Pass dynamic segments
             onBoundsChange={fetchSegmentsInBounds}
             isLoading={isLoading}
             selectedSegments={selectedSegments}
           />
        </div>

        {/* Squad Ops Panel (Right Sidebar) */}
        {currentSquad && showOpsPanel && (
            <div className="absolute right-0 top-0 bottom-0 z-20 animate-slide-left">
                <SquadOpsPanel 
                    squadId={currentSquad.id}
                    currentUserId={user?.id || ''}
                    onLocateMessage={(lat, lng) => {
                        // TODO: Fly to location
                        console.log('Fly to', lat, lng);
                    }}
                    selectedSegment={selectedSegments.length === 1 ? selectedSegments[0] : undefined}
                />
            </div>
        )}

        {/* Squad Management Modal */}
        {showSquadPanel && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="bg-background-default w-full md:w-[400px] md:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-up">
              <div className="p-4 border-b border-stroke-default flex items-center justify-between">
                <h2 className="text-lg font-bold text-content-default">Squad Management</h2>
                <button onClick={() => setShowSquadPanel(false)} className="p-2 hover:bg-background-subtle rounded-full">
                  <X size={20} className="text-content-subtle" />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto">
                <SquadControl 
                  currentSquad={currentSquad}
                  onJoinSquad={handleJoinSquad}
                  onCreateSquad={handleCreateSquad}
                  onLeaveSquad={() => {
                      setCurrentSquad(null);
                      setShowOpsPanel(false);
                  }}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </div>
        )}

        {/* Mission Control Panel (Bottom Overlay) */}
        {/* Only show if Ops Panel is NOT covering it, or adjust layout */}
        {selectedSegments.length > 0 && !showSquadPanel && (
          <div className={`absolute bottom-0 left-0 ${showOpsPanel ? 'right-80' : 'right-0'} md:relative md:w-96 md:border-l border-stroke-default bg-background-default shadow-xl z-10 max-h-[50vh] md:max-h-full overflow-y-auto transition-all duration-300 animate-slide-up`}>
            <MissionControlPanel 
              segments={selectedSegments} 
              onClose={() => setSelectedSegments([])}
              currentSquad={currentSquad}
              currentUserId={user?.id}
              onAssignComplete={() => {
                  // Refresh segments to show new status
                  // We can trigger a re-fetch or just clear selection
                  setSelectedSegments([]);
                  // Ideally trigger fetchSegmentsInBounds(mapBounds)
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
