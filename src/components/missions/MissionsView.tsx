import React, { useState } from 'react';
import { MissionMap } from './MissionMap';
import { MissionControlPanel } from './MissionControlPanel';
import { SquadControl, MOCK_SQUADS } from './SquadControl';
import { ArrowLeft, Users, Map as MapIcon } from 'lucide-react';

interface MissionsViewProps {
  onBack: () => void;
}

export const MissionsView: React.FC<MissionsViewProps> = ({ onBack }) => {
  const [selectedSegment, setSelectedSegment] = useState<any>(null);
  const [currentSquad, setCurrentSquad] = useState<any>(null);
  const [showSquadPanel, setShowSquadPanel] = useState(false);

  // Mock Squad Actions
  const handleJoinSquad = (code: string) => {
    const squad = MOCK_SQUADS.find(s => s.code === code);
    if (squad) {
      setCurrentSquad(squad);
      alert(`Joined ${squad.name}!`);
    } else {
      alert('Invalid Squad Code');
    }
  };

  const handleCreateSquad = (name: string) => {
    const newSquad = { id: `s${Date.now()}`, name, code: `SQ-${Math.floor(Math.random()*1000)}`, members: 1 };
    setCurrentSquad(newSquad);
    alert(`Created ${name}! Share code: ${newSquad.code}`);
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
          onClick={() => setShowSquadPanel(!showSquadPanel)}
          className={`p-2 rounded-lg transition-colors ${showSquadPanel ? 'bg-brand-primary text-white' : 'hover:bg-background-subtle text-content-default'}`}
        >
          <Users size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Map takes full space */}
        <div className="flex-1 relative z-0">
           <MissionMap onSegmentSelect={setSelectedSegment} />
        </div>

        {/* Squad Panel (Sidebar) */}
        {showSquadPanel && (
          <div className="absolute top-0 right-0 bottom-0 w-80 bg-background-default border-l border-stroke-default shadow-xl z-20 p-4 animate-slide-left overflow-y-auto">
            <h2 className="text-lg font-bold text-content-default mb-4">Squad Management</h2>
            <SquadControl 
              currentSquad={currentSquad}
              onJoinSquad={handleJoinSquad}
              onCreateSquad={handleCreateSquad}
              onLeaveSquad={() => setCurrentSquad(null)}
            />
            
            {/* Manager Assignment Simulation */}
            <div className="mt-8 pt-6 border-t border-stroke-default">
              <h3 className="font-bold text-content-default mb-2">Manager Tools</h3>
              <p className="text-xs text-content-subtle mb-4">Simulate assigning tasks to your squad.</p>
              <button 
                disabled={!currentSquad}
                className="w-full py-2 bg-background-subtle border border-stroke-default rounded-lg text-sm font-medium hover:bg-background-inset disabled:opacity-50"
                onClick={() => alert('Manager Mode: Select streets on the map to assign to ' + currentSquad.name)}
              >
                Assign Streets to Squad
              </button>
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
