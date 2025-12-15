import React, { useState } from 'react';
import { Users, UserPlus, LogOut, Shield, Copy, Check } from 'lucide-react';

// Mock Data for simulation
export const MOCK_SQUADS = [
  { id: 's1', name: 'Green Team Alpha', code: 'GTA-2025', members: 4 },
  { id: 's2', name: 'Urban Rangers', code: 'URB-99', members: 2 }
];

interface SquadControlProps {
  currentSquad: any | null;
  onJoinSquad: (code: string) => void;
  onCreateSquad: (name: string) => void;
  onLeaveSquad: () => void;
}

export const SquadControl: React.FC<SquadControlProps> = ({ currentSquad, onJoinSquad, onCreateSquad, onLeaveSquad }) => {
  const [mode, setMode] = useState<'VIEW' | 'JOIN' | 'CREATE'>('VIEW');
  const [inputVal, setInputVal] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (currentSquad) {
      navigator.clipboard.writeText(currentSquad.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (currentSquad) {
    return (
      <div className="bg-background-subtle p-4 rounded-xl border border-stroke-default mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-primary" />
            <span className="font-bold text-content-default">{currentSquad.name}</span>
          </div>
          <span className="text-xs bg-brand-primary/10 text-brand-primary px-2 py-1 rounded-full font-medium">
            {currentSquad.members} Members
          </span>
        </div>
        
        <div className="flex items-center gap-2 bg-background-default p-2 rounded-lg border border-stroke-subtle mb-3">
          <span className="text-xs text-content-subtle uppercase font-bold">Squad Code:</span>
          <code className="flex-1 font-mono text-sm text-content-default">{currentSquad.code}</code>
          <button onClick={handleCopyCode} className="p-1 hover:bg-background-subtle rounded">
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-content-subtle" />}
          </button>
        </div>

        <button 
          onClick={onLeaveSquad}
          className="w-full py-2 text-xs font-medium text-status-error hover:bg-status-error/10 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={14} /> Leave Squad
        </button>
      </div>
    );
  }

  return (
    <div className="bg-background-subtle p-4 rounded-xl border border-stroke-default mb-4">
      {mode === 'VIEW' && (
        <div className="space-y-3">
          <h3 className="font-bold text-content-default flex items-center gap-2">
            <Users size={18} /> Squad Mode
          </h3>
          <p className="text-xs text-content-subtle">Team up with friends to map larger areas together.</p>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setMode('JOIN')}
              className="py-2 px-3 bg-background-default border border-stroke-default rounded-lg text-sm font-medium hover:border-brand-primary transition-colors"
            >
              Join Existing
            </button>
            <button 
              onClick={() => setMode('CREATE')}
              className="py-2 px-3 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary-hover transition-colors"
            >
              Create New
            </button>
          </div>
        </div>
      )}

      {mode === 'JOIN' && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="font-bold text-content-default text-sm">Join a Squad</h3>
          <input 
            type="text" 
            placeholder="Enter Squad Code"
            className="w-full p-2 bg-background-default border border-stroke-default rounded-lg text-sm"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={() => setMode('VIEW')} className="flex-1 py-2 text-xs font-medium text-content-subtle hover:bg-background-inset rounded-lg">Cancel</button>
            <button 
              onClick={() => onJoinSquad(inputVal)}
              disabled={!inputVal}
              className="flex-1 py-2 bg-brand-primary text-white rounded-lg text-xs font-bold hover:bg-brand-primary-hover disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>
      )}

      {mode === 'CREATE' && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="font-bold text-content-default text-sm">Create New Squad</h3>
          <input 
            type="text" 
            placeholder="Squad Name (e.g. Tree Huggers)"
            className="w-full p-2 bg-background-default border border-stroke-default rounded-lg text-sm"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={() => setMode('VIEW')} className="flex-1 py-2 text-xs font-medium text-content-subtle hover:bg-background-inset rounded-lg">Cancel</button>
            <button 
              onClick={() => onCreateSquad(inputVal)}
              disabled={!inputVal}
              className="flex-1 py-2 bg-brand-primary text-white rounded-lg text-xs font-bold hover:bg-brand-primary-hover disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
