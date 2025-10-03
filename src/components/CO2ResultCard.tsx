// src/components/CO2ResultCard.tsx
import React from 'react';
import { Leaf } from 'lucide-react';

interface CO2ResultCardProps {
  co2Value: number | null;
  isLoading: boolean;
}

export function CO2ResultCard({ co2Value, isLoading }: CO2ResultCardProps) {
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
    <div className="p-4 bg-sky-50 border-l-4 border-sky-500 rounded-lg">
      <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-3">
        <Leaf className="w-6 h-6 text-sky-700 mt-1 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-sky-800 uppercase tracking-wide">
            Estimated Carbon Sequestration
          </p>
          <p className="font-bold text-sky-900 text-lg">
            {co2Value.toFixed(2)} kg CO₂e
          </p>
          <p className="text-xs text-gray-500 mt-1">
            This is an estimate of the total carbon dioxide equivalent sequestered over the tree's lifetime.
          </p>
        </div>
      </div>
    </div>
  );
}