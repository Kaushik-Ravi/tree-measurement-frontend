// src/components/CommunityGroveView.tsx
import { useState, useEffect } from 'react';
import { PendingTree } from '../apiService';
import { Users, GitMerge, Loader2, ListTree, ArrowLeft, Clock, Timer } from 'lucide-react';
import { getOptimizedImageUrl } from '../utils/imageOptimization';

interface CommunityGroveViewProps {
  pendingTrees: PendingTree[];
  isLoading: boolean;
  onClaimTree: (treeId: string) => void;
  onBack: () => void;
  currentUserId?: string;
}

const CountdownTimer = ({ expiresAt }: { expiresAt: string }) => {
    const [timeLeft, setTimeLeft] = useState('');
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const expiry = new Date(expiresAt).getTime();
            const distance = expiry - now;

            if (distance < 0) {
                clearInterval(interval);
                setTimeLeft("Expired");
                setIsExpired(true);
            } else {
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                setTimeLeft(`${minutes}m ${seconds}s`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [expiresAt]);

    return (
        <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full ${isExpired ? 'bg-status-error/10 text-status-error' : 'bg-brand-accent/10 text-brand-accent'}`}>
            <Timer size={12} />
            <span>{timeLeft}</span>
        </div>
    );
};

// --- START: SURGICAL REPLACEMENT (THEMING & STYLING) ---
const TreeCard = ({ tree, onClaimTree, isOwnTree, currentUserId }: { tree: PendingTree; onClaimTree: (id: string) => void; isOwnTree: boolean; currentUserId?: string; }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    // Check if this tree is currently claimed by the user (Active Session)
    const isClaimedByMe = tree.status === 'ANALYSIS_IN_PROGRESS' && tree.claimed_by_user_id === currentUserId;

    // Calculate time since upload (relative format)
    const getTimeAgo = (createdAt: string) => {
        const now = new Date();
        const created = new Date(createdAt);
        const diffMs = now.getTime() - created.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        const diffWeeks = Math.floor(diffMs / 604800000);
        const diffMonths = Math.floor(diffMs / 2592000000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
        if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
        return `${Math.floor(diffMonths / 12)} year${Math.floor(diffMonths / 12) !== 1 ? 's' : ''} ago`;
    };

    // Calculate auto-verification progress
    // Logic: 5+ analyses = auto-verified, 3-4 with consensus = possible
    const getVerificationProgress = (count: number) => {
        const percentage = Math.min((count / 5) * 100, 100);
        return Math.round(percentage);
    };

    const verificationProgress = getVerificationProgress(tree.analysis_count);
    const isNearComplete = verificationProgress >= 60; // 3+ analyses

    return (
        <div className={`bg-background-default border ${isClaimedByMe ? 'border-brand-accent ring-2 ring-brand-accent' : isOwnTree ? 'border-brand-primary ring-1 ring-brand-primary' : 'border-stroke-default'} rounded-lg shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow`}>
            <div className="relative bg-background-inset h-40">
                {/* Loading Spinner */}
                {!imageLoaded && !imageError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                    </div>
                )}
                
                {/* Image */}
                <img 
                    src={getOptimizedImageUrl(tree.image_url, 'medium')}
                    alt={tree.file_name}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => {
                        setImageError(true);
                        setImageLoaded(true);
                    }}
                />

                {/* Error State */}
                {imageError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background-inset">
                        <p className="text-xs text-content-subtle">Image unavailable</p>
                    </div>
                )}
                
                {/* Analysis Count Badge */}
                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
                    <Users size={12} />
                    <span>{tree.analysis_count}</span>
                </div>

                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {isClaimedByMe && (
                        <div className="bg-brand-accent text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                            <span>Analysis In Progress</span>
                        </div>
                    )}
                    {isOwnTree && (
                        <div className="bg-brand-primary text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                            <span>My Tree</span>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="p-3 flex-grow flex flex-col space-y-2.5">
                {/* Time Since Upload */}
                {tree.created_at && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-content-subtle">
                            <Clock size={12} className="flex-shrink-0" />
                            <span>{getTimeAgo(tree.created_at)}</span>
                        </div>
                        {isClaimedByMe && tree.claim_expires_at && (
                            <CountdownTimer expiresAt={tree.claim_expires_at} />
                        )}
                    </div>
                )}
                
                {/* Auto-Verification Progress - HIDDEN FOR OWN TREES */}
                {!isOwnTree && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className={`font-medium ${isNearComplete ? 'text-status-success' : 'text-content-subtle'}`}>
                                {verificationProgress}% to auto-verify
                            </span>
                            <span className="text-content-subtle/70">
                                {tree.analysis_count}/5
                            </span>
                        </div>
                        <div className="w-full bg-background-inset rounded-full h-1.5 overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 rounded-full ${
                                    verificationProgress === 100 
                                        ? 'bg-status-success' 
                                        : isNearComplete 
                                            ? 'bg-brand-accent' 
                                            : 'bg-brand-primary'
                                }`}
                                style={{ width: `${verificationProgress}%` }}
                            />
                        </div>
                    </div>
                )}
                
                {/* Spacer if progress bar is hidden */}
                {isOwnTree && <div className="flex-grow" />}
                {!isOwnTree && <div className="flex-grow" />}
                
                {/* Analyze Button */}
                <button
                    onClick={() => onClaimTree(tree.id)}
                    className={`w-full mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all text-sm ${
                        isClaimedByMe
                            ? 'bg-brand-accent text-white hover:bg-brand-accent-hover shadow-md'
                            : isOwnTree 
                                ? 'bg-brand-secondary text-content-on-brand hover:bg-brand-secondary-hover'
                                : isNearComplete
                                    ? 'bg-brand-accent text-white hover:bg-brand-accent-hover'
                                    : 'bg-brand-primary text-content-on-brand hover:bg-brand-primary-hover'
                    }`}
                >
                    <GitMerge size={16} />
                    {isClaimedByMe 
                        ? 'Continue Analysis' 
                        : isOwnTree 
                            ? 'Complete Analysis' 
                            : (isNearComplete ? 'Complete Verification' : 'Analyze')
                    }
                </button>
            </div>
        </div>
    );
};

export function CommunityGroveView({ pendingTrees, isLoading, onClaimTree, onBack, currentUserId }: CommunityGroveViewProps) {
    const [showMyPendingOnly, setShowMyPendingOnly] = useState(false);

    // Sort: Active Claims first, then Own Trees, then others
    const sortedTrees = [...pendingTrees].sort((a, b) => {
        const aIsClaimed = a.status === 'ANALYSIS_IN_PROGRESS' && a.claimed_by_user_id === currentUserId;
        const bIsClaimed = b.status === 'ANALYSIS_IN_PROGRESS' && b.claimed_by_user_id === currentUserId;
        if (aIsClaimed && !bIsClaimed) return -1;
        if (!aIsClaimed && bIsClaimed) return 1;
        
        const aIsOwn = a.user_id === currentUserId;
        const bIsOwn = b.user_id === currentUserId;
        if (aIsOwn && !bIsOwn) return -1;
        if (!aIsOwn && bIsOwn) return 1;
        
        return 0;
    });

    const filteredTrees = showMyPendingOnly && currentUserId
        ? sortedTrees.filter(tree => tree.user_id === currentUserId)
        : sortedTrees;

    return (
        <div className="w-full h-full flex flex-col bg-background-subtle">
            <header className="flex-shrink-0 p-4 border-b border-stroke-default bg-background-default/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                         <ListTree className="w-7 h-7 text-brand-secondary" />
                         <div>
                            <h1 className="text-xl font-semibold text-content-default">The Community Grove</h1>
                            <p className="text-xs text-content-subtle">Help verify pending tree measurements.</p>
                         </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {currentUserId && (
                            <button 
                                onClick={() => setShowMyPendingOnly(!showMyPendingOnly)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    showMyPendingOnly 
                                        ? 'bg-brand-primary text-content-on-brand' 
                                        : 'bg-background-inset text-content-default hover:bg-background-subtle border border-stroke-default'
                                }`}
                            >
                                <Users size={16} />
                                {showMyPendingOnly ? 'Showing My Trees' : 'My Pending Trees'}
                            </button>
                        )}
                        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-brand-secondary hover:bg-brand-secondary/10 p-2 rounded-lg ml-auto md:ml-0">
                            <ArrowLeft size={16} /> Back
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-grow overflow-y-auto p-4 md:p-6">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="w-8 h-8 text-content-subtle animate-spin" />
                        <span className="ml-2 text-content-subtle">Loading Grove...</span>
                    </div>
                ) : filteredTrees.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <h2 className="text-lg font-semibold text-content-default">
                            {showMyPendingOnly ? "No Pending Trees Found" : "All Saplings Analyzed!"}
                        </h2>
                        <p className="text-content-subtle mt-2 max-w-md mx-auto">
                            {showMyPendingOnly 
                                ? "You don't have any pending trees waiting for analysis." 
                                : "There are currently no pending trees in the grove. Check back later, or contribute a new one using the \"Quick Capture\" mode."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredTrees.map(tree => (
                            <TreeCard 
                                key={tree.id} 
                                tree={tree} 
                                onClaimTree={onClaimTree} 
                                isOwnTree={currentUserId === tree.user_id}
                                currentUserId={currentUserId}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
// --- END: SURGICAL REPLACEMENT (THEMING & STYLING) ---