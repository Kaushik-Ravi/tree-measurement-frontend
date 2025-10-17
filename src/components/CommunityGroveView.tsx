// src/components/CommunityGroveView.tsx
import React from 'react';
import { PendingTree } from '../apiService';
import { MapPin, Users, GitMerge, Loader2, ListTree } from 'lucide-react';

interface CommunityGroveViewProps {
  pendingTrees: PendingTree[];
  isLoading: boolean;
  onClaimTree: (treeId: string) => void;
  onBack: () => void;
}

const TreeCard = ({ tree, onClaimTree }: { tree: PendingTree; onClaimTree: (id: string) => void; }) => (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
        <div className="relative">
            <img src={tree.image_url} alt={tree.file_name} className="w-full h-40 object-cover bg-gray-100" />
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <Users size={12} />
                <span>{tree.analysis_count}</span>
            </div>
        </div>
        <div className="p-3 flex-grow flex flex-col">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <MapPin size={12} />
                <span>{tree.latitude?.toFixed(3)}, {tree.longitude?.toFixed(3)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
                ID: {tree.id.substring(0, 8)}...
            </p>
            <div className="flex-grow" />
            <button
                onClick={() => onClaimTree(tree.id)}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 transition-colors text-sm"
            >
                <GitMerge size={16} />
                Analyze
            </button>
        </div>
    </div>
);

export function CommunityGroveView({ pendingTrees, isLoading, onClaimTree, onBack }: CommunityGroveViewProps) {
    return (
        <div className="w-full h-full flex flex-col bg-gray-50">
            <header className="flex-shrink-0 p-4 border-b bg-white/80 backdrop-blur-sm">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                         <ListTree className="w-7 h-7 text-green-700" />
                         <div>
                            <h1 className="text-xl font-semibold text-gray-900">The Community Grove</h1>
                            <p className="text-xs text-gray-500">Help verify pending tree measurements.</p>
                         </div>
                    </div>
                    <button onClick={onBack} className="text-sm font-medium text-blue-600 hover:underline">
                        &lt; Back
                    </button>
                </div>
            </header>

            <main className="flex-grow overflow-y-auto p-4 md:p-6">
                {isLoading && (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                    </div>
                )}

                {!isLoading && pendingTrees.length === 0 && (
                    <div className="text-center py-16 px-4">
                        <h2 className="text-lg font-semibold text-gray-700">All Saplings Analyzed!</h2>
                        <p className="text-gray-500 mt-2 max-w-md mx-auto">
                            There are currently no pending trees in the grove. Check back later, or contribute a new one using the "Quick Capture" mode.
                        </p>
                    </div>
                )}

                {!isLoading && pendingTrees.length > 0 && (
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