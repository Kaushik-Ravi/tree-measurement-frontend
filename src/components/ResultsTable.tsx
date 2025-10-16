// src/components/ResultsTable.tsx
import React, { useState, useMemo } from 'react';
import { Download, LayoutList, Trash2, ChevronUp, ChevronDown, Edit, ImageIcon } from 'lucide-react';
import { downloadResultsAsCSV } from '../utils/csvExporter';
import { TreeResult, Metrics } from '../apiService';

type SortableKeys = keyof Metrics | 'file_name' | 'species' | 'wood_density' | 'co2' | 'condition' | 'ownership' | 'location';

interface ResultsTableProps {
  results: TreeResult[];
  onDeleteResult: (id: string) => void;
  onEditResult: (result: TreeResult) => void;
}

export function ResultsTable({ results, onDeleteResult, onEditResult }: ResultsTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'created_at' as any, direction: 'descending' });

  const sortedResults = useMemo(() => {
    let sortableItems = [...results];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: string | number | Date;
        let bValue: string | number | Date;
        
        if (sortConfig.key === 'file_name') { aValue = a.file_name.toLowerCase(); bValue = b.file_name.toLowerCase(); }
        else if (sortConfig.key === 'species') { aValue = a.species?.scientificName.toLowerCase() ?? ''; bValue = b.species?.scientificName.toLowerCase() ?? ''; }
        else if (sortConfig.key === 'wood_density') { aValue = a.wood_density?.value ?? -1; bValue = b.wood_density?.value ?? -1; }
        else if (sortConfig.key === 'co2') { aValue = a.co2_sequestered_kg ?? -1; bValue = b.co2_sequestered_kg ?? -1; }
        else if (sortConfig.key === 'condition') { aValue = a.condition?.toLowerCase() ?? ''; bValue = b.condition?.toLowerCase() ?? ''; }
        else if (sortConfig.key === 'ownership') { aValue = a.ownership?.toLowerCase() ?? ''; bValue = b.ownership?.toLowerCase() ?? ''; }
        else if (sortConfig.key === 'location') { aValue = a.latitude ?? -91; bValue = b.latitude ?? -91; }
        else if (sortConfig.key === ('created_at' as any)) { aValue = new Date(a.created_at); bValue = new Date(b.created_at); }
        else { aValue = a.metrics[sortConfig.key as keyof Metrics]; bValue = b.metrics[sortConfig.key as keyof Metrics]; }

        if (aValue < bValue) { return sortConfig.direction === 'ascending' ? -1 : 1; }
        if (aValue > bValue) { return sortConfig.direction === 'ascending' ? 1 : -1; }
        return 0;
      });
    }
    return sortableItems;
  }, [results, sortConfig]);

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortableKeys) => {
    if (!sortConfig || sortConfig.key !== key) { return <ChevronDown className="w-3 h-3 text-gray-400 opacity-50" />; }
    return sortConfig.direction === 'ascending' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
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
        <button onClick={() => downloadResultsAsCSV(sortedResults)} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm"><Download className="w-4 h-4" /> <span className="hidden sm:inline">Download CSV</span></button>
      </div>
      <div className="md:overflow-x-auto md:bg-white md:rounded-lg md:border md:border-gray-200">
        <table className="min-w-full text-sm mobile-cards-table">
          <thead className="hidden md:table-header-group bg-gray-50 text-xs text-gray-600 uppercase tracking-wider">
            <tr>
              {/* --- MODIFIED: Added Image column header --- */}
              <th scope="col" className="px-4 py-3 text-left">Image</th>
              <th scope="col" className="px-4 py-3 text-left"><button onClick={() => requestSort('file_name')} className="flex items-center gap-1">File Name {getSortIcon('file_name')}</button></th>
              <th scope="col" className="px-4 py-3 text-left"><button onClick={() => requestSort('species')} className="flex items-center gap-1">Species {getSortIcon('species')}</button></th>
              <th scope="col" className="px-4 py-3 text-left"><button onClick={() => requestSort('condition')} className="flex items-center gap-1">Condition {getSortIcon('condition')}</button></th>
              <th scope="col" className="px-4 py-3 text-right"><button onClick={() => requestSort('co2')} className="flex items-center gap-1 w-full justify-end">CO₂ (kg) {getSortIcon('co2')}</button></th>
              <th scope="col" className="px-4 py-3 text-left"><button onClick={() => requestSort('location')} className="flex items-center gap-1">Location {getSortIcon('location')}</button></th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="md:divide-y md:divide-gray-200">
            {sortedResults.map((result) => (
              <tr key={result.id} className="md:hover:bg-gray-50">
                {/* --- MODIFIED: Added Image data cell --- */}
                <td data-label="Image" className="px-4 py-3">
                  <div className="flex items-center justify-center md:justify-start">
                    {result.image_url ? (
                      <a href={result.image_url} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={result.image_url} 
                          alt={`Thumbnail for ${result.file_name}`} 
                          className="h-12 w-12 object-cover rounded-md bg-gray-100 shadow-sm hover:scale-105 transition-transform"
                        />
                      </a>
                    ) : (
                      <div className="h-12 w-12 flex items-center justify-center bg-gray-100 rounded-md text-gray-400">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </td>
                <td data-label="File" className="px-4 py-3 font-medium text-gray-900"><span className="truncate">{result.file_name}</span></td>
                <td data-label="Species" className="px-4 py-3 font-medium text-gray-800 italic"><span className="truncate">{result.species?.scientificName ?? <span className="text-gray-400 not-italic">N/A</span>}</span></td>
                <td data-label="Condition" className="px-4 py-3 text-gray-600"><span>{result.condition || <span className="text-gray-400">N/A</span>}</span></td>
                <td data-label="CO₂ (kg)" className="px-4 py-3 font-mono font-semibold text-sky-800"><span>{result.co2_sequestered_kg ? result.co2_sequestered_kg.toFixed(2) : <span className="text-gray-400 font-mono">N/A</span>}</span></td>
                <td data-label="Location" className="px-4 py-3 font-mono">
                    <span>
                      {result.latitude && result.longitude ? (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${result.latitude},${result.longitude}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                          </a>
                      ) : <span className="text-gray-400">N/A</span>}
                    </span>
                </td>
                <td data-label="Actions" className="px-4 py-3">
                  <div className="flex justify-end items-center gap-2">
                    <button onClick={() => onEditResult(result)} className="p-1 text-gray-400 hover:text-blue-600 rounded-md" aria-label="Edit result">
                        <Edit className="w-5 h-5" />
                    </button>
                    <button onClick={() => onDeleteResult(result.id)} className="p-1 text-gray-400 hover:text-red-600 rounded-md" aria-label="Delete result">
                        <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}