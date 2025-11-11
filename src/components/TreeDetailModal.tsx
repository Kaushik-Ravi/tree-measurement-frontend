// src/components/TreeDetailModal.tsx
import React, { useEffect } from 'react';
import { X, Edit, Trash2, MapPin, Calendar, Ruler, FlaskConical } from 'lucide-react';
import { TreeResult } from '../apiService';

interface TreeDetailModalProps {
  tree: TreeResult | null;
  onClose: () => void;
  onEdit: (tree: TreeResult) => void;
  onDelete: (id: string) => void;
  onAnalyze?: (treeId: string) => void; // NEW: Optional callback for analyzing pending trees
}

export function TreeDetailModal({ tree, onClose, onEdit, onDelete, onAnalyze }: TreeDetailModalProps) {
  if (!tree) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    // Prevent body scroll when modal is open
    if (tree) {
      document.body.classList.add('modal-open');
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, tree]);

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-background-default rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl border border-stroke-default"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background-default border-b border-stroke-default px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-2xl font-bold text-content-default italic">
              {tree.species?.scientificName || 'Unidentified Tree'}
            </h2>
            {tree.species?.commonNames && tree.species.commonNames.length > 0 && (
              <p className="text-sm text-content-subtle capitalize mt-1">
                {tree.species.commonNames.join(', ')}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-content-subtle hover:text-content-default hover:bg-background-inset rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Image */}
        {tree.image_url && (
          <div className="px-6 pt-4">
            <img 
              src={tree.image_url} 
              alt={tree.file_name}
              className="w-full h-64 object-cover rounded-lg bg-background-inset"
            />
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Measurements */}
          <div>
            <h3 className="text-sm font-semibold text-content-default uppercase tracking-wide mb-3 flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              Measurements
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-background-subtle p-3 rounded-lg border border-stroke-subtle">
                <p className="text-xs text-content-subtle mb-1">Height</p>
                <p className="text-lg font-mono font-semibold text-content-default">
                  {tree.metrics?.height_m?.toFixed(2) ?? '--'} m
                </p>
              </div>
              <div className="bg-background-subtle p-3 rounded-lg border border-stroke-subtle">
                <p className="text-xs text-content-subtle mb-1">Canopy</p>
                <p className="text-lg font-mono font-semibold text-content-default">
                  {tree.metrics?.canopy_m?.toFixed(2) ?? '--'} m
                </p>
              </div>
              <div className="bg-background-subtle p-3 rounded-lg border border-stroke-subtle">
                <p className="text-xs text-content-subtle mb-1">DBH</p>
                <p className="text-lg font-mono font-semibold text-content-default">
                  {tree.metrics?.dbh_cm?.toFixed(2) ?? '--'} cm
                </p>
              </div>
            </div>
          </div>

          {/* CO2 Sequestration */}
          {tree.co2_sequestered_kg && (
            <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-lg p-4">
              <p className="text-xs font-semibold text-brand-primary uppercase tracking-wide">
                Annual CO₂ Sequestration
              </p>
              <p className="text-2xl font-bold text-content-default mt-1">
                {tree.co2_sequestered_kg.toFixed(2)} <span className="text-sm font-normal text-content-subtle">kg/year</span>
              </p>
            </div>
          )}

          {/* Wood Density */}
          {tree.wood_density && (
            <div>
              <h3 className="text-sm font-semibold text-content-default mb-2">Wood Density</h3>
              <div className="bg-background-subtle p-3 rounded-lg border border-stroke-subtle">
                <p className="text-lg font-mono font-semibold text-content-default">
                  {tree.wood_density.value?.toFixed(3) ?? '--'} <span className="text-sm font-normal text-content-subtle">{tree.wood_density.unit}</span>
                </p>
              </div>
            </div>
          )}

          {/* Additional Details Grid */}
          <div>
            <h3 className="text-sm font-semibold text-content-default uppercase tracking-wide mb-3">
              Additional Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {tree.distance_m !== undefined && tree.distance_m !== null && (
                <div>
                  <p className="font-semibold text-content-default">Distance</p>
                  <p className="text-content-subtle">{tree.distance_m.toFixed(2)} m</p>
                </div>
              )}
              {tree.scale_factor !== undefined && tree.scale_factor !== null && (
                <div>
                  <p className="font-semibold text-content-default">Scale Factor</p>
                  <p className="text-content-subtle font-mono">{tree.scale_factor.toFixed(4)}</p>
                </div>
              )}
              {tree.device_heading !== undefined && tree.device_heading !== null && (
                <div>
                  <p className="font-semibold text-content-default">Device Heading</p>
                  <p className="text-content-subtle">{tree.device_heading.toFixed(1)}°</p>
                </div>
              )}
              {tree.condition && (
                <div>
                  <p className="font-semibold text-content-default">Condition</p>
                  <p className="text-content-subtle capitalize">{tree.condition}</p>
                </div>
              )}
              {tree.ownership && (
                <div>
                  <p className="font-semibold text-content-default">Ownership</p>
                  <p className="text-content-subtle capitalize">{tree.ownership}</p>
                </div>
              )}
              {tree.status && (
                <div>
                  <p className="font-semibold text-content-default">Status</p>
                  <p className={`font-medium ${
                    tree.status === 'COMPLETE' 
                      ? 'text-status-success'
                      : tree.status === 'VERIFIED'
                      ? 'text-brand-secondary'
                      : tree.status === 'PENDING_ANALYSIS'
                      ? 'text-brand-accent'
                      : 'text-content-subtle'
                  }`}>
                    {tree.status}
                  </p>
                </div>
              )}
              <div>
                <p className="font-semibold text-content-default flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Recorded
                </p>
                <p className="text-content-subtle">
                  {new Date(tree.created_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              {tree.file_name && (
                <div>
                  <p className="font-semibold text-content-default">File Name</p>
                  <p className="text-content-subtle text-xs truncate">{tree.file_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          {tree.latitude && tree.longitude && (
            <div>
              <p className="font-semibold text-content-default mb-2 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Location
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${tree.latitude},${tree.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-secondary hover:underline flex items-center gap-1 text-sm"
              >
                {tree.latitude.toFixed(6)}, {tree.longitude.toFixed(6)}
              </a>
            </div>
          )}

          {/* Remarks */}
          {tree.remarks && (
            <div>
              <p className="font-semibold text-content-default mb-2">Remarks</p>
              <p className="text-content-subtle text-sm whitespace-pre-wrap break-words bg-background-subtle p-3 rounded-lg border border-stroke-subtle">
                {tree.remarks}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-background-default border-t border-stroke-default px-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {tree.status === 'PENDING_ANALYSIS' && onAnalyze && (
              <button
                onClick={() => {
                  onAnalyze(tree.id);
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-accent text-white rounded-lg font-medium hover:bg-brand-accent-hover transition-colors shadow-md"
              >
                <FlaskConical className="w-4 h-4" />
                Complete Analysis
              </button>
            )}
            <button
              onClick={() => {
                onEdit(tree);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-secondary text-white rounded-lg font-medium hover:bg-brand-secondary-hover transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit Details
            </button>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this tree?')) {
                  onDelete(tree.id);
                  onClose();
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-status-error text-white rounded-lg font-medium hover:bg-status-error/90 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Tree
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
