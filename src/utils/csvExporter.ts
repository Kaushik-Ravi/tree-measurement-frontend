// src/utils/csvExporter.ts

import { TreeResult } from '../apiService';

export function downloadResultsAsCSV(results: TreeResult[]): void {
  if (results.length === 0) {
    console.warn("No results to download.");
    return;
  }

  const headers = [
    'ID', 'Date Created', 'File Name', 'Image URL', 'Species', 'Common Names', 'Confidence Score', 
    'Height (m)', 'Canopy (m)', 'DBH (cm)', 'Distance (m)',
    'Wood Density (g/cm^3)', 'Wood Density Source Region',
    'CO2 Sequestered (kg)',
    'Condition', 'Ownership', 'Remarks',
    'Latitude', 'Longitude'
  ];
  
  const rows = results.map(result => [
    `"${result.id}"`,
    `"${new Date(result.created_at).toLocaleString()}"`,
    `"${result.file_name.replace(/"/g, '""')}"`,
    `"${result.image_url ?? 'N/A'}"`,
    `"${result.species?.scientificName ?? 'N/A'}"`,
    `"${result.species?.commonNames.join(', ') ?? 'N/A'}"`,
    result.species ? (result.species.score * 100).toFixed(1) : 'N/A',
    result.metrics.height_m.toFixed(2),
    result.metrics.canopy_m.toFixed(2),
    result.metrics.dbh_cm.toFixed(2),
    // --- MODIFIED: Added distance_m to the export ---
    result.distance_m ? result.distance_m.toFixed(2) : 'N/A',
    // --- END MODIFIED BLOCK ---
    result.wood_density ? result.wood_density.value.toFixed(2) : 'N/A',
    `"${result.wood_density?.sourceRegion ?? 'N/A'}"`,
    result.co2_sequestered_kg ? result.co2_sequestered_kg.toFixed(2) : 'N/A',
    `"${result.condition ?? 'N/A'}"`,
    `"${result.ownership ?? 'N/A'}"`,
    `"${(result.remarks ?? 'N/A').replace(/"/g, '""')}"`,
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