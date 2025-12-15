import React, { useState } from 'react';
import { MissionMap } from './MissionMap';
import { MissionControlPanel } from './MissionControlPanel';
import { ArrowLeft } from 'lucide-react';

interface MissionsViewProps {
  onBack: () => void;
}

export const MissionsView: React.FC<MissionsViewProps> = ({ onBack }) => {
  const [selectedSegment, setSelectedSegment] = useState<any>(null);

  return (
    <div className="flex flex-col h-screen bg-background-default">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-stroke-default flex items-center gap-4 bg-background-default z-10 shadow-sm">
        <button onClick={onBack} className="p-2 hover:bg-background-subtle rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-content-default" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-content-default">Mission Control</h1>
          <p className="text-xs text-content-subtle">Select a street segment to begin patrol</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Map takes full space */}
        <div className="flex-1 relative z-0">
           <MissionMap onSegmentSelect={setSelectedSegment} />
        </div>

        {/* Control Panel (Overlay on mobile, Sidebar on desktop) */}
        {selectedSegment && (
          <div className="absolute bottom-0 left-0 right-0 md:relative md:w-96 md:border-l border-stroke-default bg-background-default shadow-xl z-10 max-h-[50vh] md:max-h-full overflow-y-auto transition-transform duration-300 animate-slide-up">
            <MissionControlPanel 
              segment={selectedSegment} 
              onClose={() => setSelectedSegment(null)} 
            />
          </div>
        )}
      </div>
    </div>
  );
};
