import React from 'react';
import { X, Clock, MapPin, Users, Lock, CheckCircle } from 'lucide-react';

interface MissionControlPanelProps {
  segment: any;
  onClose: () => void;
}

export const MissionControlPanel: React.FC<MissionControlPanelProps> = ({ segment, onClose }) => {
  const { name, length_meters, status } = segment.properties;

  // Estimate time: 1 min per 10 meters (conservative)
  const estTime = Math.ceil(length_meters / 10);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-content-default">{name}</h2>
          <div className="flex items-center gap-2 text-content-subtle mt-1">
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase
              ${status === 'available' ? 'bg-white text-black' : ''}
              ${status === 'locked' ? 'bg-gray-700 text-gray-300' : ''}
              ${status === 'completed' ? 'bg-emerald-900 text-emerald-300' : ''}
            `}>
              {status}
            </span>
            <span>•</span>
            <span>{length_meters}m</span>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-background-subtle rounded-full">
          <X className="w-6 h-6 text-content-subtle" />
        </button>
      </div>

      <div className="space-y-6 flex-1">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-background-subtle p-4 rounded-xl border border-stroke-default">
            <div className="flex items-center gap-2 text-content-subtle mb-1">
              <Clock size={16} />
              <span className="text-xs font-bold uppercase">Est. Time</span>
            </div>
            <p className="text-xl font-bold text-content-default">{estTime} min</p>
          </div>
          <div className="bg-background-subtle p-4 rounded-xl border border-stroke-default">
            <div className="flex items-center gap-2 text-content-subtle mb-1">
              <Users size={16} />
              <span className="text-xs font-bold uppercase">Rec. Team</span>
            </div>
            <p className="text-xl font-bold text-content-default">1-2</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {status === 'available' && (
            <>
              <button className="w-full py-4 bg-brand-primary text-white rounded-xl font-bold text-lg hover:bg-brand-primary-hover shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95">
                <Lock size={20} />
                Start Patrol
              </button>
              <button className="w-full py-3 bg-background-subtle text-content-default rounded-xl font-medium hover:bg-background-inset border border-stroke-default flex items-center justify-center gap-2 transition-colors">
                <Users size={20} />
                Assign to Squad
              </button>
            </>
          )}

          {status === 'locked' && (
            <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl text-yellow-200 text-sm">
              This segment is currently locked by another ranger. It will become available again in 1h 45m if not completed.
            </div>
          )}
          
          {status === 'completed' && (
             <div className="p-4 bg-emerald-900/20 border border-emerald-700/50 rounded-xl text-emerald-200 flex items-center gap-3">
              <CheckCircle className="w-6 h-6" />
              <div>
                <p className="font-bold">Mission Complete</p>
                <p className="text-xs opacity-80">Verified by Community</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-8">
            <h3 className="font-bold text-content-default mb-2">Mission Brief</h3>
            <p className="text-content-subtle text-sm leading-relaxed">
                Walk along the designated path. Identify and measure all trees within 5 meters of the curb. 
                Pay special attention to newly planted saplings.
            </p>
        </div>
      </div>
    </div>
  );
};
