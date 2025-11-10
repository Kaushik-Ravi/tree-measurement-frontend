// src/components/ResultsTable.tsx
import React, { useState } from 'react';
import { Download, LayoutList, Trash2, Edit, ImageIcon, ChevronDown, MapPin, Maximize2, Minimize2, Clock, CheckCircle2, Users, GitCommitVertical, Loader2, FlaskConical } from 'lucide-react';
import { downloadResultsAsCSV } from '../utils/csvExporter';
import { TreeResult } from '../apiService';

interface ResultsTableProps {
  results: TreeResult[];
  onDeleteResult: (id: string) => void;
  onEditResult: (result: TreeResult) => void;
  onAnalyzeTree?: (treeId: string) => void; // NEW: Optional callback for analyzing pending trees
  isLoading: boolean;
}

// --- START: SURGICAL REPLACEMENT (THEMING) ---
const DetailRow = ({ result }: { result: TreeResult }) => (
  <div className="bg-background-subtle p-4">
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-xs">
      <div className="col-span-2 sm:col-span-3">
        <p className="font-semibold text-content-default">File & Date</p>
        <p className="text-content-subtle truncate">{result.file_name} <span className="text-gray-400">({new Date(result.created_at).toLocaleDateString()})</span></p>
      </div>
      <div>
        <p className="font-semibold text-content-default">Distance</p>
        <p className="text-content-subtle">{result.distance_m ? `${result.distance_m.toFixed(2)} m` : 'N/A'}</p>
      </div>
      <div>
        <p className="font-semibold text-content-default">Condition</p>
        <p className="text-content-subtle">{result.condition || 'N/A'}</p>
      </div>
      <div>
        <p className="font-semibold text-content-default">Ownership</p>
        <p className="text-content-subtle">{result.ownership || 'N/A'}</p>
      </div>
      {result.status === 'VERIFIED' && result.confidence && (
        <div className="col-span-2 sm:col-span-1">
            <p className="font-semibold text-content-default">Community Verified</p>
            <p className="text-content-subtle flex items-center gap-1"><Users size={12} /> {result.confidence.analysesCount} analyses</p>
        </div>
      )}
      <div className="col-span-2 sm:col-span-3">
        <p className="font-semibold text-content-default">Location</p>
         {result.latitude && result.longitude ? (
            <a href={`https://www.google.com/maps/search/?api=1&query=${result.latitude},${result.longitude}`} target="_blank" rel="noopener noreferrer" className="text-brand-secondary hover:underline flex items-center gap-1">
              <MapPin size={12}/> {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
            </a>
        ) : <p className="text-content-subtle">N/A</p>}
      </div>
      {result.remarks && (
        <div className="col-span-2 sm:col-span-3">
          <p className="font-semibold text-content-default">Remarks</p>
          <p className="text-content-subtle whitespace-pre-wrap break-words">{result.remarks}</p>
        </div>
      )}
    </div>
  </div>
);
// --- END: SURGICAL REPLACEMENT (THEMING) ---


const StatusBadge = ({ status }: { status: TreeResult['status'] }) => {
    switch (status) {
        case 'PENDING_ANALYSIS':
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-400">
                    <Clock className="h-3 w-3" />
                    Pending
                </span>
            );
        case 'ANALYSIS_IN_PROGRESS':
             return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-800 dark:text-blue-400">
                    <GitCommitVertical className="h-3 w-3" />
                    In Progress
                </span>
            );
        case 'VERIFIED':
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 dark:bg-indigo-500/10 px-2 py-1 text-xs font-medium text-indigo-800 dark:text-indigo-400">
                    <Users className="h-3 w-3" />
                    Verified
                </span>
            );
        case 'COMPLETE':
        default:
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-500/10 px-2 py-1 text-xs font-medium text-green-800 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Complete
                </span>
            );
    }
};


export function ResultsTable({ results, onDeleteResult, onEditResult, onAnalyzeTree, isLoading }: ResultsTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  
  const sortedResults = [...results].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleRowClick = (resultId: string) => {
    setExpandedRowId(prevId => (prevId === resultId ? null : resultId));
  };
  
  // --- START: SURGICAL REPLACEMENT (LOADING & EMPTY STATE THEMING) ---
  const renderLoadingState = () => (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-4"><LayoutList className="w-6 h-6 text-content-default" /><h2 className="text-lg font-semibold text-content-default">Your Mapped Trees</h2></div>
      <div className="text-center py-10 px-4 border-2 border-dashed border-stroke-default rounded-lg bg-background-default">
          <Loader2 className="w-6 h-6 text-content-subtle animate-spin mx-auto mb-2" />
          <p className="text-content-subtle">Loading your history...</p>
      </div>
    </div>
  );

  if (isLoading) {
    return renderLoadingState();
  }
  
  if (results.length === 0) { 
    return (
        <div className="mt-8">
            <div className="flex items-center gap-3 mb-4"><LayoutList className="w-6 h-6 text-content-default" /><h2 className="text-lg font-semibold text-content-default">Your Mapped Trees</h2></div>
            <div className="text-center py-10 px-4 border-2 border-dashed border-stroke-default rounded-lg bg-background-default">
                <p className="text-content-subtle">Your measurement history is empty.</p>
                <p className="text-sm text-content-subtle/70 mt-1">Saved results will appear here.</p>
            </div>
        </div>
    ); 
  }
  // --- END: SURGICAL REPLACEMENT (LOADING & EMPTY STATE THEMING) ---

  const resultsToShow = showAll ? sortedResults : sortedResults.slice(0, 3);

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3"><LayoutList className="w-6 h-6 text-content-default" /><h2 className="text-lg font-semibold text-content-default">Your Mapped Trees</h2></div>
        <button onClick={() => downloadResultsAsCSV(sortedResults)} className="flex items-center gap-2 px-3 py-2 bg-brand-secondary text-content-on-brand rounded-lg font-medium hover:bg-brand-secondary-hover text-sm"><Download className="w-4 h-4" /> <span className="hidden sm:inline">Download CSV</span></button>
      </div>

      <div className="hidden md:block border border-stroke-default rounded-lg overflow-x-auto bg-background-default">
        <table className="min-w-full text-sm table-fixed">
          <thead className="bg-background-subtle text-xs text-content-subtle uppercase tracking-wider">
            <tr>
              <th scope="col" className="w-12 px-4 py-3"></th>
              <th scope="col" className="w-20 px-2 py-3"></th>
              <th scope="col" className="px-4 py-3 text-left">Species / ID</th>
              <th scope="col" className="w-24 px-4 py-3 text-right">Height (m)</th>
              <th scope="col" className="w-24 px-4 py-3 text-right">Canopy (m)</th>
              <th scope="col" className="w-24 px-4 py-3 text-right">DBH (cm)</th>
              <th scope="col" className="w-24 px-4 py-3 text-right">CO₂ (kg)</th>
              <th scope="col" className="w-28 px-4 py-3 text-center">Status</th>
              <th scope="col" className="w-28 px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke-subtle">
            {resultsToShow.map((result) => (
              <React.Fragment key={result.id}>
                <tr onClick={() => handleRowClick(result.id)} className="cursor-pointer hover:bg-background-inset transition-colors duration-150">
                  <td className="px-4 py-2 text-center">
                    <ChevronDown className={`w-5 h-5 text-content-subtle transition-transform duration-200 ${expandedRowId === result.id ? 'rotate-180' : ''}`} />
                  </td>
                  <td className="px-2 py-2">
                    <a href={result.image_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      {result.image_url ? (
                          <img src={result.image_url} alt={result.file_name} className="h-12 w-12 object-cover rounded-md bg-background-inset transition-transform hover:scale-105"/>
                      ) : (
                        <div className="h-12 w-12 flex items-center justify-center bg-background-inset rounded-md text-content-subtle"><ImageIcon className="w-6 h-6" /></div>
                      )}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-medium text-content-default italic truncate">
                    {(result.status === 'PENDING_ANALYSIS' || !result.species?.scientificName)
                        ? <span className="text-content-subtle not-italic font-mono text-xs block">{result.id.substring(0, 8)}...</span> 
                        : result.species.scientificName
                    }
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-content-default">{result.metrics ? result.metrics.height_m.toFixed(2) : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-content-default">{result.metrics ? result.metrics.canopy_m.toFixed(2) : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-content-default">{result.metrics ? result.metrics.dbh_cm.toFixed(2) : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-sky-600 dark:text-sky-400">{result.co2_sequestered_kg ? result.co2_sequestered_kg.toFixed(2) : <span className="text-content-subtle">N/A</span>}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={result.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end items-center gap-2">
                      {result.status === 'PENDING_ANALYSIS' && onAnalyzeTree && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onAnalyzeTree(result.id); }} 
                          className="px-3 py-1.5 text-xs font-medium text-content-on-brand bg-brand-accent hover:bg-brand-accent-hover rounded-md flex items-center gap-1 transition-colors" 
                          aria-label="Complete analysis"
                        >
                          <FlaskConical className="w-4 h-4" />
                          Complete Analysis
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); onEditResult(result); }} className="p-2 text-content-subtle hover:text-brand-secondary rounded-md" aria-label="Edit result"><Edit className="w-5 h-5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteResult(result.id); }} className="p-2 text-content-subtle hover:text-status-error rounded-md" aria-label="Delete result"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </td>
                </tr>
                {expandedRowId === result.id && (
                  <tr>
                    <td colSpan={9} className="p-0"><DetailRow result={result} /></td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {resultsToShow.map(result => (
          <div key={result.id} className="bg-background-default border border-stroke-default rounded-lg shadow-sm">
            <div className="p-3">
              <div className="flex gap-4">
                <a href={result.image_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                  {result.image_url ? (
                    <img src={result.image_url} alt={result.file_name} className="h-20 w-20 object-cover rounded-md bg-background-inset"/>
                  ) : (
                    <div className="h-20 w-20 flex items-center justify-center bg-background-inset rounded-md text-content-subtle"><ImageIcon className="w-8 h-8" /></div>
                  )}
                </a>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-content-default italic truncate pr-2">
                        {(result.status === 'PENDING_ANALYSIS' || !result.species?.scientificName)
                            ? <span className="text-content-subtle not-italic">Pending...</span> 
                            : result.species.scientificName
                        }
                    </p>
                    <StatusBadge status={result.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-x-2 text-xs mt-2 text-center">
                      <div><p className="font-medium text-content-subtle">Tree Height</p><p className="font-mono text-content-default">{result.metrics ? result.metrics.height_m.toFixed(1) + 'm' : '-'}</p></div>
                      <div><p className="font-medium text-content-subtle">Canopy Width</p><p className="font-mono text-content-default">{result.metrics ? result.metrics.canopy_m.toFixed(1) + 'm' : '-'}</p></div>
                      <div><p className="font-medium text-content-subtle">Trunk Width</p><p className="font-mono text-content-default">{result.metrics ? result.metrics.dbh_cm.toFixed(1) + 'cm' : '-'}</p></div>
                  </div>
                </div>
              </div>
            </div>
            {expandedRowId === result.id && <DetailRow result={result} />}
            <div className="border-t border-stroke-default bg-background-subtle/50 flex justify-between items-center px-3 py-1 rounded-b-lg">
                <button onClick={() => handleRowClick(result.id)} className="flex items-center gap-1.5 text-xs font-medium text-brand-secondary p-1">
                  {expandedRowId === result.id ? <><Minimize2 size={12}/>Hide</> : <><Maximize2 size={12}/>Show</>} Details
                </button>
                <div className="flex items-center gap-1">
                    {result.status === 'PENDING_ANALYSIS' && onAnalyzeTree && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onAnalyzeTree(result.id); }} 
                        className="px-2 py-1 text-xs font-medium text-content-on-brand bg-brand-accent hover:bg-brand-accent-hover rounded-md flex items-center gap-1" 
                        aria-label="Complete analysis"
                      >
                        <FlaskConical className="w-3 h-3" />
                        Analyze
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onEditResult(result); }} className="p-2 text-content-subtle hover:text-brand-secondary" aria-label="Edit result"><Edit className="w-5 h-5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteResult(result.id); }} className="p-2 text-content-subtle hover:text-status-error" aria-label="Delete result"><Trash2 className="w-5 h-5" /></button>
                </div>
            </div>
          </div>
        ))}
      </div>
      
      {!showAll && sortedResults.length > 3 && (
        <div className="mt-6 text-center">
          <button 
            onClick={() => setShowAll(true)}
            className="px-4 py-2 text-sm font-medium text-brand-secondary bg-brand-secondary/10 rounded-lg hover:bg-brand-secondary/20"
          >
            Show All ({sortedResults.length})
          </button>
        </div>
      )}
    </div>
  );
}