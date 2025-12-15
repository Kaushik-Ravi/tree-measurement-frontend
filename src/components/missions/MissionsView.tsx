import React, { useState, useEffect } from 'react';
import { MissionMap } from './MissionMap';
import { MissionControlPanel } from './MissionControlPanel';
import { SquadControl } from './SquadControl';
import { ArrowLeft, Users, Map as MapIcon, X, Loader2 } from 'lucide-react';
import { missionService } from '../../services/missionService';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';

interface MissionsViewProps {
  onBack: () => void;
}

export const MissionsView: React.FC<MissionsViewProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [selectedSegment, setSelectedSegment] = useState<any>(null);
  const [currentSquad, setCurrentSquad] = useState<any>(null);
  const [showSquadPanel, setShowSquadPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [demoSegments, setDemoSegments] = useState<any>(null);

  // Load real data from Supabase
  useEffect(() => {
    const fetchSegments = async () => {
      // 1. Try to fetch real segments from Supabase first
      // Note: Loading all 57k segments at once will crash the browser. 
      // We limit to 10,000 for performance. Ideally, we should load by viewport (BBOX).
      const { data, error } = await supabase
        .from('street_segments')
        .select('*')
        .limit(10000); // Increased limit to show more of Pune

      if (data && data.length > 0) {
        console.log('Loaded real segments from Supabase:', data.length);
        // Convert to GeoJSON format expected by the map
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
      } else {
        // 2. Fallback to Demo Data if no real data found
        console.log('No real data found, falling back to demo generator');
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
            const data = missionService.generateDemoSegments(pos.coords.latitude, pos.coords.longitude);
            setDemoSegments(data);
          }, () => {
            const data = missionService.generateDemoSegments(40.7829, -73.9654);
            setDemoSegments(data);
          });
        }
      }
    };

    fetchSegments();
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
        
        <button 
          onClick={() => setShowSquadPanel(true)}
          className={`p-2 rounded-lg transition-colors ${showSquadPanel ? 'bg-brand-primary text-white' : 'hover:bg-background-subtle text-content-default'}`}
        >
          <Users size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Map takes full space */}
        <div className="flex-1 relative z-0">
           <MissionMap 
             onSegmentSelect={setSelectedSegment} 
             segments={demoSegments} // Pass dynamic segments
           />
        </div>

        {/* Squad Panel (Modal / Bottom Sheet) */}
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
                  onLeaveSquad={() => setCurrentSquad(null)}
                  isLoading={isLoading}
                />
                
                {/* Manager Assignment Simulation */}
                <div className="mt-6 pt-6 border-t border-stroke-default">
                  <h3 className="font-bold text-content-default mb-2">Manager Tools</h3>
                  <p className="text-xs text-content-subtle mb-4">Simulate assigning tasks to your squad.</p>
                  <button 
                    disabled={!currentSquad}
                    className="w-full py-3 bg-background-subtle border border-stroke-default rounded-lg text-sm font-medium hover:bg-background-inset disabled:opacity-50 flex items-center justify-center gap-2"
                    onClick={() => {
                      setShowSquadPanel(false);
                      alert('Manager Mode Active: Tap any street to assign it to ' + currentSquad.name);
                    }}
                  >
                    <MapIcon size={16} />
                    Assign Streets to Squad
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Control Panel (Overlay on mobile, Sidebar on desktop) */}
        {selectedSegment && !showSquadPanel && (
          <div className="absolute bottom-0 left-0 right-0 md:relative md:w-96 md:border-l border-stroke-default bg-background-default shadow-xl z-10 max-h-[50vh] md:max-h-full overflow-y-auto transition-transform duration-300 animate-slide-up">
            <MissionControlPanel 
              segment={selectedSegment} 
              onClose={() => setSelectedSegment(null)} 
              currentSquad={currentSquad}
            />
          </div>
        )}
      </div>
    </div>
  );
};
