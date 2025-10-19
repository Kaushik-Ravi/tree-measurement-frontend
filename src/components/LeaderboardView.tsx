// src/components/LeaderboardView.tsx
import React from 'react';
import { supabase } from '../supabaseClient';
import { Crown, BarChart2, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

// Define the shape of a user profile for the leaderboard
interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string;
  sapling_points: number;
  rank: string;
}

// Custom hook to fetch and manage leaderboard data
const useLeaderboard = () => {
  const [profiles, setProfiles] = React.useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchProfiles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch all profiles, ordered by sapling_points in descending order
        const { data, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .order('sapling_points', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        setProfiles(data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch leaderboard data.');
        console.error("Leaderboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  return { profiles, isLoading, error };
};

// A small component for the top 3 ranked users
const TopRank = ({ profile, rank }: { profile: UserProfile, rank: number }) => {
  const rankStyles = [
    { bg: 'bg-amber-400', text: 'text-amber-800', shadow: 'shadow-amber-300' }, // 1st
    { bg: 'bg-slate-300', text: 'text-slate-800', shadow: 'shadow-slate-200' }, // 2nd
    { bg: 'bg-yellow-600', text: 'text-yellow-900', shadow: 'shadow-yellow-400' }  // 3rd
  ];

  return (
    <div className="flex flex-col items-center text-center">
      <div className={`relative w-20 h-20 rounded-full flex items-center justify-center ${rankStyles[rank-1].bg}`}>
        <img
          src={profile.avatar_url}
          alt={profile.full_name}
          className="w-full h-full rounded-full object-cover p-1"
        />
        <div className={`absolute -bottom-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 border-white ${rankStyles[rank-1].bg} ${rankStyles[rank-1].text}`}>
          {rank}
        </div>
      </div>
      <p className="mt-4 font-semibold text-gray-800 truncate w-24">{profile.full_name}</p>
      <p className="text-xs text-green-700 font-bold">{profile.sapling_points} SP</p>
    </div>
  );
};

interface LeaderboardViewProps {
  onBack: () => void;
}

export function LeaderboardView({ onBack }: LeaderboardViewProps) {
  const { profiles, isLoading, error } = useLeaderboard();
  const topThree = profiles.slice(0, 3);
  const rest = profiles.slice(3);

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
          {/* --- START: SURGICAL REPLACEMENT --- */}
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 p-2 rounded-lg">
            <ArrowLeft size={16} /> Back to Hub
          </button>
          {/* --- END: SURGICAL REPLACEMENT --- */}
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
          <>
            {/* Top 3 Podium */}
            <div className="flex justify-center items-end gap-4 md:gap-8 mb-10 mt-4">
              {topThree[1] && <TopRank profile={topThree[1]} rank={2} />}
              {topThree[0] && <div className="relative -top-4"><TopRank profile={topThree[0]} rank={1} /><Crown className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 text-amber-400 -rotate-12" /></div>}
              {topThree[2] && <TopRank profile={topThree[2]} rank={3} />}
            </div>

            {/* Rest of the list */}
            <div className="space-y-2">
              {rest.map((profile, index) => (
                <div key={profile.id} className="flex items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="w-8 text-center text-sm font-semibold text-gray-500">{index + 4}</div>
                  <img src={profile.avatar_url} alt={profile.full_name} className="w-10 h-10 rounded-full mx-3 object-cover" />
                  <div className="flex-grow">
                    <p className="font-medium text-gray-800">{profile.full_name}</p>
                    <p className="text-xs text-gray-500">{profile.rank}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-700">{profile.sapling_points} SP</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}