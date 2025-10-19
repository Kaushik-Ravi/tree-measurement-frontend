// src/components/LeaderboardView.tsx
import React from 'react';
import { supabase } from '../supabaseClient';
import { Crown, BarChart2, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

// --- START: SURGICAL REPLACEMENT (PHASE 1.1, 1.2, 1.3 - COMPLETE COMPONENT REFACTOR) ---

// Define the shape of a user profile for the leaderboard
interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string;
  sapling_points: number;
  rank: string;
}

// Custom hook to fetch and manage leaderboard data, now with grouping
const useLeaderboard = () => {
  const [profilesByRank, setProfilesByRank] = React.useState<Record<string, UserProfile[]>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchProfiles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .order('sapling_points', { ascending: false });

        if (fetchError) throw fetchError;

        // Group profiles by their rank
        const grouped = (data || []).reduce((acc, profile) => {
          const rank = profile.rank || 'Seedling';
          if (!acc[rank]) {
            acc[rank] = [];
          }
          acc[rank].push(profile);
          return acc;
        }, {} as Record<string, UserProfile[]>);

        setProfilesByRank(grouped);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch leaderboard data.');
        console.error("Leaderboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  return { profilesByRank, isLoading, error };
};

// Define the hierarchy of ranks for ordered display
const RANK_ORDER = ["Forest Guardian", "Ent", "Sapling", "Sprout", "Seedling"];
const RANK_THRESHOLDS = {
  "Seedling": 0,
  "Sprout": 51,
  "Sapling": 251,
  "Ent": 1001,
  "Forest Guardian": 5001,
};


// Component for a single user row in the leaderboard
const UserRow = ({ profile, rankNumber }: { profile: UserProfile; rankNumber: number }) => {
  const getRankIcon = () => {
    if (rankNumber === 1) return <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />;
    if (rankNumber === 2) return <Crown className="w-5 h-5 text-slate-400 fill-slate-400" />;
    if (rankNumber === 3) return <Crown className="w-5 h-5 text-yellow-600 fill-yellow-600" />;
    return <span className="w-5 text-center">{rankNumber}</span>;
  };

  return (
    <div className="flex items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
      <div className="w-8 text-center text-sm font-semibold text-gray-500">{getRankIcon()}</div>
      <img src={profile.avatar_url} alt={profile.full_name} className="w-10 h-10 rounded-full mx-3 object-cover" />
      <div className="flex-grow">
        <p className="font-medium text-gray-800">{profile.full_name}</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-green-700">{profile.sapling_points} SP</p>
      </div>
    </div>
  );
};


interface LeaderboardViewProps {
  onBack: () => void;
}

export function LeaderboardView({ onBack }: LeaderboardViewProps) {
  const { profilesByRank, isLoading, error } = useLeaderboard();

  // Get a flat list of all profiles to determine top 3 overall
  const allProfiles = React.useMemo(() => {
    return Object.values(profilesByRank).flat().sort((a, b) => b.sapling_points - a.sapling_points);
  }, [profilesByRank]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      <header className="flex-shrink-0 p-4 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-7 h-7 text-indigo-700" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Community Leaderboard</h1>
              <p className="text-xs text-gray-500">Top contributors to the Grove.</p>
            </div>
          </div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 p-2 rounded-lg">
            <ArrowLeft size={16} /> Back to Hub
          </button>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto p-4 md:p-6">
        {isLoading && (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        )}

        {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                    </div>
                </div>
            </div>
        )}
        
        {!isLoading && !error && (
          <div className="space-y-8">
            {RANK_ORDER.map(rank => {
              const profilesInRank = profilesByRank[rank];
              if (!profilesInRank || profilesInRank.length === 0) {
                return null;
              }
              return (
                <div key={rank}>
                  <h2 className="text-lg font-bold text-gray-800 mb-3">{rank}s</h2>
                  <div className="space-y-2">
                    {profilesInRank.map(profile => {
                      const overallRank = allProfiles.findIndex(p => p.id === profile.id) + 1;
                      return <UserRow key={profile.id} profile={profile} rankNumber={overallRank} />;
                    })}
                  </div>
                </div>
              );
            })}

            {/* Rank Legend */}
            <div className="pt-8 mt-8 border-t">
              <h3 className="text-base font-semibold text-center text-gray-700 mb-4">Rank Legend</h3>
              <div className="max-w-md mx-auto grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {RANK_ORDER.slice().reverse().map(rank => (
                  <div key={rank} className="flex justify-between items-center">
                    <span className="font-medium text-gray-600">{rank}</span>
                    <span className="font-mono text-gray-500">{RANK_THRESHOLDS[rank as keyof typeof RANK_THRESHOLDS]}+ SP</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- END: SURGICAL REPLACEMENT (PHASE 1.1, 1.2, 1.3 - COMPLETE COMPONENT REFACTOR) ---