// src/components/LeaderboardView.tsx
import React from 'react';
import { supabase } from '../supabaseClient';
import { Crown, BarChart2, Loader2, AlertTriangle, ArrowLeft, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';


// --- START: SURGICAL REPLACEMENT (THEMING) ---

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
const UserRow = ({ profile, rankNumber, isCurrentUser }: { profile: UserProfile; rankNumber: number; isCurrentUser: boolean; }) => {
  const getRankIcon = () => {
    if (rankNumber === 1) return <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />;
    if (rankNumber === 2) return <Crown className="w-5 h-5 text-slate-400 fill-slate-400" />;
    if (rankNumber === 3) return <Crown className="w-5 h-5 text-yellow-600 fill-yellow-600" />;
    return <span className="w-5 text-center">{rankNumber}</span>;
  };

  return (
    <div className={`
      flex items-center p-3 rounded-lg border shadow-sm transition-all
      ${isCurrentUser 
        ? 'bg-brand-accent/10 border-brand-accent/50 ring-2 ring-brand-accent/20' 
        : 'bg-background-default border-stroke-subtle'}
    `}>
      <div className="w-8 text-center text-sm font-semibold text-content-subtle">{getRankIcon()}</div>
      <img src={profile.avatar_url} alt={profile.full_name} className="w-10 h-10 rounded-full mx-3 object-cover" />
      <div className="flex-grow flex items-center gap-2">
        <p className="font-medium text-content-default">{profile.full_name}</p>
        {isCurrentUser && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
      </div>
      <div className="text-right">
        <p className="font-bold text-brand-primary">{profile.sapling_points} SP</p>
      </div>
    </div>
  );
};


interface LeaderboardViewProps {
  onBack: () => void;
}

export function LeaderboardView({ onBack }: LeaderboardViewProps) {
  const { user } = useAuth(); // Get the current user
  const { profilesByRank, isLoading, error } = useLeaderboard();

  // Get a flat list of all profiles to determine top 3 overall
  const allProfiles = React.useMemo(() => {
    return Object.values(profilesByRank).flat().sort((a, b) => b.sapling_points - a.sapling_points);
  }, [profilesByRank]);

  return (
    <div className="w-full h-full flex flex-col bg-background-subtle">
      <header className="flex-shrink-0 p-4 border-b border-stroke-default bg-background-default/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-7 h-7 text-brand-accent" />
            <div>
              <h1 className="text-xl font-semibold text-content-default">Community Leaderboard</h1>
              <p className="text-xs text-content-subtle">Top contributors to the Grove.</p>
            </div>
          </div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-brand-secondary hover:bg-brand-secondary/10 p-2 rounded-lg">
            <ArrowLeft size={16} /> Back to Homepage
          </button>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto p-4 md:p-6">
        {isLoading && (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="w-8 h-8 text-content-subtle animate-spin" />
          </div>
        )}

        {error && (
            <div className="bg-status-error/10 border-l-4 border-status-error p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-status-error" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                    <p className="text-sm text-status-error">{error}</p>
                    </div>
                </div>
            </div>
        )}
        
        {!isLoading && !error && (
          <div className="space-y-8 max-w-4xl mx-auto">
            {RANK_ORDER.map(rank => {
              const profilesInRank = profilesByRank[rank];
              if (!profilesInRank || profilesInRank.length === 0) {
                return null;
              }
              return (
                <div key={rank}>
                  <h2 className="text-lg font-bold text-content-default mb-3">{rank}s</h2>
                  <div className="space-y-2">
                    {profilesInRank.map(profile => {
                      const overallRank = allProfiles.findIndex(p => p.id === profile.id) + 1;
                      return <UserRow key={profile.id} profile={profile} rankNumber={overallRank} isCurrentUser={profile.id === user?.id} />;
                    })}
                  </div>
                </div>
              );
            })}

            <div className="pt-8 mt-8 border-t border-stroke-default">
              <h3 className="text-base font-semibold text-center text-content-default mb-6">Rank Progression</h3>
              <div className="w-full flex items-center justify-between text-xs text-center font-semibold text-content-subtle px-2">
                {RANK_ORDER.slice().reverse().map((rank, index) => (
                  <React.Fragment key={rank}>
                    <div className="flex flex-col items-center">
                      <span>{rank}</span>
                      <span className="font-mono text-brand-primary">{RANK_THRESHOLDS[rank as keyof typeof RANK_THRESHOLDS]}+ SP</span>
                    </div>
                    {index < RANK_ORDER.length - 1 && <div className="flex-grow h-px bg-stroke-default mx-2"></div>}
                  </React.Fragment>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

// --- END: SURGICAL REPLACEMENT (THEMING) ---