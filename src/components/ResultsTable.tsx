// src/components/ResultsTable.tsx
import React, { useState } from 'react';
import { Download, LayoutList, Trash2, Edit, ImageIcon, ChevronDown, MapPin, Maximize2, Minimize2, Clock, CheckCircle2, Users, GitCommitVertical } from 'lucide-react';
import { downloadResultsAsCSV } from '../utils/csvExporter';
import { TreeResult } from '../apiService';

interface ResultsTableProps {
  results: TreeResult[];
  onDeleteResult: (id: string) => void;
  onEditResult: (result: TreeResult) => void;
}

// A new component for the expandable details section
const DetailRow = ({ result }: { result: TreeResult }) => (
  <div className="bg-slate-50 p-4">
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-xs">
      <div className="col-span-2 sm:col-span-3">
        <p className="font-semibold text-gray-700">File & Date</p>
        <p className="text-gray-500 truncate">{result.file_name} <span className="text-gray-400">({new Date(result.created_at).toLocaleDateString()})</span></p>
      </div>
      <div>
        <p className="font-semibold text-gray-700">Distance</p>
        <p className="text-gray-500">{result.distance_m ? `${result.distance_m.toFixed(2)} m` : 'N/A'}</p>
      </div>
      <div>
        <p className="font-semibold text-gray-700">Condition</p>
        <p className="text-gray-500">{result.condition || 'N/A'}</p>
      </div>
      <div>
        <p className="font-semibold text-gray-700">Ownership</p>
        <p className="text-gray-500">{result.ownership || 'N/A'}</p>
      </div>
      {result.status === 'VERIFIED' && result.confidence && (
        <div className="col-span-2 sm:col-span-1">
            <p className="font-semibold text-gray-700">Community Verified</p>
            <p className="text-gray-500 flex items-center gap-1"><Users size={12} /> {result.confidence.analysesCount} analyses</p>
        </div>
      )}
      <div className="col-span-2 sm:col-span-3">
        <p className="font-semibold text-gray-700">Location</p>
         {result.latitude && result.longitude ? (
            <a href={`https://www.google.com/maps/search/?api=1&query=${result.latitude},${result.longitude}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
              <MapPin size={12}/> {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
            </a>
        ) : <p className="text-gray-500">N/A</p>}
      </div>
      {result.remarks && (
        <div className="col-span-2 sm:col-span-3">
          <p className="font-semibold text-gray-700">Remarks</p>
          <p className="text-gray-500 whitespace-pre-wrap break-words">{result.remarks}</p>
        </div>
      )}
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: TreeResult['status'] }) => {
    switch (status) {
        case 'PENDING_ANALYSIS':
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                    <Clock className="h-3 w-3" />
                    Pending
                </span>
            );
        // --- START: SURGICAL ADDITION ---
        // Add the 'In Progress' status to the badge component for completeness.
        case 'ANALYSIS_IN_PROGRESS':
             return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                    <GitCommitVertical className="h-3 w-3" />
                    In Progress
                </span>
            );
        // --- END: SURGICAL ADDITION ---
        case 'VERIFIED':
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800">
                    <Users className="h-3 w-3" />
                    Verified
                </span>
            );
        case 'COMPLETE':
        default:
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                    <CheckCircle2 className="h-3 w-3" />
                    Complete
                </span>
            );
    }
};


export function ResultsTable({ results, onDeleteResult, onEditResult }: ResultsTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  
  const sortedResults = [...results].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleRowClick = (resultId: string) => {
    setExpandedRowId(prevId => (prevId === resultId ? null : resultId));
  };
  
  if (results.length === 0) { 
    return (
        <div>
            <div className="flex items-center gap-3 mb-4"><LayoutList className="w-6 h-6 text-gray-700" /><h2 className="text-lg font-semibold text-gray-900">Measurement History</h2></div>
            <div className="text-center py-10 px-4 border-2 border-dashed rounded-lg">
                <p className="text-gray-500">Your measurement history is empty.</p>
                <p className="text-sm text-gray-400 mt-1">Saved results will appear here.</p>
            </div>
        </div>
    ); 
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3"><LayoutList className="w-6 h-6 text-gray-700" /><h2 className="text-lg font-semibold text-gray-900">Measurement History</h2></div>
        {/* --- START: SURGICAL REPLACEMENT --- */}
        <button onClick={() => downloadResultsAsCSV(sortedResults)} className="flex items-center gap-2 px-3 py-2 bg-brand-indigo text-white rounded-lg font-medium hover:bg-brand-indigo-dark text-sm"><Download className="w-4 h-4" /> <span className="hidden sm:inline">Download CSV</span></button>
        {/* --- END: SURGICAL REPLACEMENT --- */}
      </div>

      <div className="hidden md:block border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm table-fixed">
          <thead className="bg-gray-50 text-xs text-gray-600 uppercase tracking-wider">
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
          <tbody className="divide-y divide-gray-200 bg-white">
            {sortedResults.map((result) => (
              <React.Fragment key={result.id}>
                {/* --- START: SURGICAL REPLACEMENT --- */}
                <tr onClick={() => handleRowClick(result.id)} className="cursor-pointer hover:bg-base-200/50 transition-colors duration-150">
                {/* --- END: SURGICAL REPLACEMENT --- */}
                  <td className="px-4 py-2 text-center">
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedRowId === result.id ? 'rotate-180' : ''}`} />
                  </td>
                  <td className="px-2 py-2">
                    <a href={result.image_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      {result.image_url ? (
                          <img src={result.image_url} alt={result.file_name} className="h-12 w-12 object-cover rounded-md bg-gray-100 transition-transform hover:scale-105"/>
                      ) : (
                        <div className="h-12 w-12 flex items-center justify-center bg-gray-100 rounded-md text-gray-400"><ImageIcon className="w-6 h-6" /></div>
                      )}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 italic truncate">
                    {(result.status === 'PENDING_ANALYSIS' || !result.species?.scientificName)
                        ? <span className="text-gray-500 not-italic font-mono text-xs block">{result.id.substring(0, 8)}...</span> 
                        : result.species.scientificName
                    }
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{result.metrics ? result.metrics.height_m.toFixed(2) : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono">{result.metrics ? result.metrics.canopy_m.toFixed(2) : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono">{result.metrics ? result.metrics.dbh_cm.toFixed(2) : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-sky-800">{result.co2_sequestered_kg ? result.co2_sequestered_kg.toFixed(2) : <span className="text-gray-400">N/A</span>}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={result.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); onEditResult(result); }} className="p-2 text-gray-400 hover:text-blue-600 rounded-md" aria-label="Edit result"><Edit className="w-5 h-5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteResult(result.id); }} className="p-2 text-gray-400 hover:text-red-600 rounded-md" aria-label="Delete result"><Trash2 className="w-5 h-5" /></button>
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
        {sortedResults.map(result => (
          <div key={result.id} className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-3">
              <div className="flex gap-4">
                <a href={result.image_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                  {result.image_url ? (
                    <img src={result.image_url} alt={result.file_name} className="h-20 w-20 object-cover rounded-md bg-gray-100"/>
                  ) : (
                    <div className="h-20 w-20 flex items-center justify-center bg-gray-100 rounded-md text-gray-400"><ImageIcon className="w-8 h-8" /></div>
                  )}
                </a>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-gray-800 italic truncate pr-2">
                        {(result.status === 'PENDING_ANALYSIS' || !result.species?.scientificName)
                            ? <span className="text-gray-500 not-italic">Pending...</span> 
                            : result.species.scientificName
                        }
                    </p>
                    <StatusBadge status={result.status} />
                  </div>
                  {/* --- START: SURGICAL ADDITION --- */}
                  {/* Update labels for mobile view to be more descriptive. */}
                  <div className="grid grid-cols-3 gap-x-2 text-xs mt-2 text-center">
                      <div><p className="font-medium text-gray-500">Tree Height</p><p className="font-mono">{result.metrics ? result.metrics.height_m.toFixed(1) + 'm' : '-'}</p></div>
                      <div><p className="font-medium text-gray-500">Canopy Width</p><p className="font-mono">{result.metrics ? result.metrics.canopy_m.toFixed(1) + 'm' : '-'}</p></div>
                      <div><p className="font-medium text-gray-500">Trunk Width</p><p className="font-mono">{result.metrics ? result.metrics.dbh_cm.toFixed(1) + 'cm' : '-'}</p></div>
                  </div>
                  {/* --- END: SURGICAL ADDITION --- */}
                </div>
              </div>
            </div>
            {expandedRowId === result.id && <DetailRow result={result} />}
            <div className="border-t bg-gray-50/50 flex justify-between items-center px-3 py-1 rounded-b-lg">
                <button onClick={() => handleRowClick(result.id)} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 p-1">
                  {expandedRowId === result.id ? <><Minimize2 size={12}/>Hide</> : <><Maximize2 size={12}/>Show</>} Details
                </button>
                <div className="flex items-center">
                    <button onClick={(e) => { e.stopPropagation(); onEditResult(result); }} className="p-2 text-gray-500 hover:text-blue-600" aria-label="Edit result"><Edit className="w-5 h-5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteResult(result.id); }} className="p-2 text-gray-500 hover:text-red-600" aria-label="Delete result"><Trash2 className="w-5 h-5" /></button>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}