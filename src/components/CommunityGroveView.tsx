// src/components/CommunityGroveView.tsx
import { useState } from 'react';
import { PendingTree } from '../apiService';
import { MapPin, Users, GitMerge, Loader2, ListTree, ArrowLeft, Clock } from 'lucide-react';

interface CommunityGroveViewProps {
  pendingTrees: PendingTree[];
  isLoading: boolean;
  onClaimTree: (treeId: string) => void;
  onBack: () => void;
}

// --- START: SURGICAL REPLACEMENT (THEMING & STYLING) ---
const TreeCard = ({ tree, onClaimTree }: { tree: PendingTree; onClaimTree: (id: string) => void; }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    // Calculate time since upload
    const getTimeAgo = (uploadedAt: string) => {
        const now = new Date();
        const uploaded = new Date(uploadedAt);
        const diffMs = now.getTime() - uploaded.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        return uploaded.toLocaleDateString();
    };

    return (
        <div className="bg-background-default border border-stroke-default rounded-lg shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <div className="relative bg-background-inset h-40">
                {/* Loading Spinner */}
                {!imageLoaded && !imageError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                    </div>
                )}
                
                {/* Image */}
                <img 
                    src={tree.image_url} 
                    alt={tree.file_name}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
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
            </div>
            
            <div className="p-3 flex-grow flex flex-col space-y-2">
                {/* Location - more compact */}
                <div className="flex items-center gap-1.5 text-xs text-content-subtle">
                    <MapPin size={12} className="flex-shrink-0" />
                    <span className="truncate">{tree.latitude?.toFixed(4)}, {tree.longitude?.toFixed(4)}</span>
                </div>
                
                {/* Time Since Upload */}
                {tree.created_at && (
                    <div className="flex items-center gap-1.5 text-xs text-content-subtle">
                        <Clock size={12} className="flex-shrink-0" />
                        <span>{getTimeAgo(tree.created_at)}</span>
                    </div>
                )}
                
                {/* File Name - truncated */}
                <p className="text-xs text-content-subtle/70 truncate" title={tree.file_name}>
                    {tree.file_name}
                </p>
                
                <div className="flex-grow" />
                
                {/* Analyze Button */}
                <button
                    onClick={() => onClaimTree(tree.id)}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-content-on-brand rounded-lg font-medium hover:bg-brand-primary-hover transition-colors text-sm"
                >
                    <GitMerge size={16} />
                    Analyze
                </button>
            </div>
        </div>
    );
};

export function CommunityGroveView({ pendingTrees, isLoading, onClaimTree, onBack }: CommunityGroveViewProps) {
    return (
        <div className="w-full h-full flex flex-col bg-background-subtle">
            <header className="flex-shrink-0 p-4 border-b border-stroke-default bg-background-default/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                         <ListTree className="w-7 h-7 text-brand-secondary" />
                         <div>
                            <h1 className="text-xl font-semibold text-content-default">The Community Grove</h1>
                            <p className="text-xs text-content-subtle">Help verify pending tree measurements.</p>
                         </div>
                    </div>
                    <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-brand-secondary hover:bg-brand-secondary/10 p-2 rounded-lg">
                        <ArrowLeft size={16} /> Back to Homepage
                    </button>
                </div>
            </header>

            <main className="flex-grow overflow-y-auto p-4 md:p-6">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="w-8 h-8 text-content-subtle animate-spin" />
                        <span className="ml-2 text-content-subtle">Loading Grove...</span>
                    </div>
                ) : pendingTrees.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <h2 className="text-lg font-semibold text-content-default">All Saplings Analyzed!</h2>
                        <p className="text-content-subtle mt-2 max-w-md mx-auto">
                            There are currently no pending trees in the grove. Check back later, or contribute a new one using the "Quick Capture" mode.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {pendingTrees.map(tree => (
                            <TreeCard key={tree.id} tree={tree} onClaimTree={onClaimTree} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
// --- END: SURGICAL REPLACEMENT (THEMING & STYLING) ---