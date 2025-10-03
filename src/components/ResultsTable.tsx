// src/components/ResultsTable.tsx
import React, { useState, useMemo } from 'react';
import { Download, LayoutList, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { TreeResult, downloadResultsAsCSV } from '../utils/csvExporter';
import { Metrics } from '../apiService';

type SortableKeys = keyof Metrics | 'fileName' | 'species' | 'woodDensity' | 'co2' | 'condition' | 'ownership' | 'location';

interface ResultsTableProps {
  results: TreeResult[];
  onDeleteResult: (id: string) => void;
}

export function ResultsTable({ results, onDeleteResult }: ResultsTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>(null);

  const sortedResults = useMemo(() => {
    let sortableItems = [...results];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        if (sortConfig.key === 'fileName') { aValue = a.fileName.toLowerCase(); bValue = b.fileName.toLowerCase(); } 
        else if (sortConfig.key === 'species') { aValue = a.species?.scientificName.toLowerCase() ?? ''; bValue = b.species?.scientificName.toLowerCase() ?? ''; } 
        else if (sortConfig.key === 'woodDensity') { aValue = a.woodDensity?.value ?? -1; bValue = b.woodDensity?.value ?? -1; } 
        else if (sortConfig.key === 'co2') { aValue = a.co2_sequestered_kg ?? -1; bValue = b.co2_sequestered_kg ?? -1; }
        else if (sortConfig.key === 'condition') { aValue = a.condition?.toLowerCase() ?? ''; bValue = b.condition?.toLowerCase() ?? ''; }
        else if (sortConfig.key === 'ownership') { aValue = a.ownership?.toLowerCase() ?? ''; bValue = b.ownership?.toLowerCase() ?? ''; }
        else if (sortConfig.key === 'location') { aValue = a.latitude ?? -91; bValue = b.latitude ?? -91; } // Use latitude for sorting location
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

  if (results.length === 0) { return null; }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3"><LayoutList className="w-6 h-6 text-gray-700" /><h2 className="text-lg font-semibold text-gray-900">Session History</h2></div>
        <button onClick={() => downloadResultsAsCSV(sortedResults)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm"><Download className="w-4 h-4" /> Download CSV</button>
      </div>
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs text-gray-600 uppercase tracking-wider">
            <tr>
              <th scope="col" className="px-4 py-3 text-left"><button onClick={() => requestSort('fileName')} className="flex items-center gap-1">File Name {getSortIcon('fileName')}</button></th>
              <th scope="col" className="px-4 py-3 text-left"><button onClick={() => requestSort('species')} className="flex items-center gap-1">Species {getSortIcon('species')}</button></th>
              <th scope="col" className="px-4 py-3 text-left"><button onClick={() => requestSort('condition')} className="flex items-center gap-1">Condition {getSortIcon('condition')}</button></th>
              <th scope="col" className="px-4 py-3 text-left"><button onClick={() => requestSort('ownership')} className="flex items-center gap-1">Ownership {getSortIcon('ownership')}</button></th>
              <th scope="col" className="px-4 py-3 text-right"><button onClick={() => requestSort('co2')} className="flex items-center gap-1 w-full justify-end">CO₂ (kg) {getSortIcon('co2')}</button></th>
              <th scope="col" className="px-4 py-3 text-left"><button onClick={() => requestSort('location')} className="flex items-center gap-1">Location {getSortIcon('location')}</button></th>
              <th scope="col" className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedResults.map((result) => (
              <tr key={result.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[150px]">{result.fileName}</td>
                <td className="px-4 py-3 font-medium text-gray-800 italic">{result.species?.scientificName ?? <span className="text-gray-400 not-italic">N/A</span>}</td>
                <td className="px-4 py-3 text-gray-600">{result.condition || <span className="text-gray-400">N/A</span>}</td>
                <td className="px-4 py-3 text-gray-600">{result.ownership || <span className="text-gray-400">N/A</span>}</td>
                <td className="px-4 py-3 font-mono text-right font-semibold text-sky-800">{result.co2_sequestered_kg ? result.co2_sequestered_kg.toFixed(2) : <span className="text-gray-400 font-mono">N/A</span>}</td>
                <td className="px-4 py-3 font-mono">
                    {result.latitude && result.longitude ? (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${result.latitude},${result.longitude}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                        </a>
                    ) : <span className="text-gray-400">N/A</span>}
                </td>
                <td className="px-4 py-3 text-center"><button onClick={() => onDeleteResult(result.id)} className="p-1 text-gray-400 hover:text-red-600 rounded-md"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}