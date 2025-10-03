// src/utils/csvExporter.ts

import { Metrics, SpeciesInfo, WoodDensityInfo } from '../apiService';

export interface TreeResult {
  id: string;
  fileName: string;
  metrics: Metrics;
  species?: SpeciesInfo;
  woodDensity?: WoodDensityInfo;
  co2_sequestered_kg?: number;
  condition?: string;
  ownership?: string;
  remarks?: string;
  // --- NEW FIELDS ---
  latitude?: number;
  longitude?: number;
}

export function downloadResultsAsCSV(results: TreeResult[]): void {
  if (results.length === 0) {
    console.warn("No results to download.");
    return;
  }

  const headers = [
    'File Name', 'Species', 'Common Names', 'Confidence Score', 
    'Height (m)', 'Canopy (m)', 'DBH (cm)', 
    'Wood Density (g/cm^3)', 'Wood Density Source Region',
    'CO2 Sequestered (kg)',
    'Condition', 'Ownership', 'Remarks',
    // --- NEW HEADERS ---
    'Latitude', 'Longitude'
  ];
  
  const rows = results.map(result => [
    `"${result.fileName.replace(/"/g, '""')}"`,
    `"${result.species?.scientificName ?? 'N/A'}"`,
    `"${result.species?.commonNames.join(', ') ?? 'N/A'}"`,
    result.species ? (result.species.score * 100).toFixed(1) : 'N/A',
    result.metrics.height_m.toFixed(2),
    result.metrics.canopy_m.toFixed(2),
    result.metrics.dbh_cm.toFixed(2),
    result.woodDensity ? result.woodDensity.value.toFixed(2) : 'N/A',
    `"${result.woodDensity?.sourceRegion ?? 'N/A'}"`,
    result.co2_sequestered_kg ? result.co2_sequestered_kg.toFixed(2) : 'N/A',
    `"${result.condition ?? 'N/A'}"`,
    `"${result.ownership ?? 'N/A'}"`,
    `"${(result.remarks ?? 'N/A').replace(/"/g, '""')}"`,
    // --- NEW VALUES ---
    result.latitude ? result.latitude.toFixed(6) : 'N/A',
    result.longitude ? result.longitude.toFixed(6) : 'N/A'
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `tree_measurements_${timestamp}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}