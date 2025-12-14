// src/components/CO2ResultCard.tsx
import React from 'react';
import { Leaf } from 'lucide-react';

interface CO2ResultCardProps {
  co2Value: number | null;
  tolerance?: number | null;
  isLoading: boolean;
}

export function CO2ResultCard({ co2Value, tolerance, isLoading }: CO2ResultCardProps) {
  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 border rounded-lg text-center">
        <p className="text-sm text-gray-500 animate-pulse">Calculating CO₂...</p>
      </div>
    );
  }

  if (co2Value === null) {
    return null; // Don't render anything if there's no value and it's not loading
  }

  return (
    <div className="p-4 bg-sky-50 dark:bg-sky-900/20 border-l-4 border-sky-500 dark:border-sky-400 rounded-lg transition-colors">
      <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-3">
        <Leaf className="w-6 h-6 text-sky-700 dark:text-sky-400 mt-1 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-sky-800 dark:text-sky-300 uppercase tracking-wide">
            Total Lifetime Sequestration
          </p>
          <p className="font-bold text-sky-900 dark:text-sky-100 text-lg">
            {co2Value.toFixed(2)} {tolerance ? <span className="text-sm text-gray-600 dark:text-gray-400 font-normal">± {tolerance.toFixed(2)}</span> : ''} kg CO₂e
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            This is an estimate of the total carbon dioxide equivalent sequestered over the tree's lifetime (not per year).
          </p>
        </div>
      </div>
    </div>
  );
}