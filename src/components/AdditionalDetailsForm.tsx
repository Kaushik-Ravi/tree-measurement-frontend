// src/components/AdditionalDetailsForm.tsx
import React from 'react';
import { ChevronDown, Edit3 } from 'lucide-react';

export interface AdditionalData {
  condition: string;
  ownership: string;
  remarks: string;
}

interface AdditionalDetailsFormProps {
  data: AdditionalData;
  onUpdate: (field: keyof AdditionalData, value: string) => void;
}

const conditionOptions = ['Healthy', 'Average', 'Poor', 'Dead'];
const ownershipOptions = [
  'Avenues', 'Garden', 'Government', 'In Well', 'Industrial',
  'On Bridge', 'On Divider', 'On Foot Path', 'On Road', 'On Wall',
  'Private', 'Public', 'Semi Government'
];

export function AdditionalDetailsForm({ data, onUpdate }: AdditionalDetailsFormProps) {
  return (
    <details className="group border border-gray-200 rounded-lg bg-white">
      <summary className="flex items-center justify-between p-3 cursor-pointer list-none hover:bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Additional Details (Optional)</span>
        </div>
        <ChevronDown className="w-5 h-5 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="p-4 border-t border-gray-200 space-y-4">
        <div>
          <label htmlFor="condition" className="block text-xs font-medium text-gray-600 mb-1">Condition</label>
          <select
            id="condition"
            value={data.condition}
            onChange={(e) => onUpdate('condition', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Select condition...</option>
            {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ownership" className="block text-xs font-medium text-gray-600 mb-1">Ownership</label>
          <select
            id="ownership"
            value={data.ownership}
            onChange={(e) => onUpdate('ownership', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Select ownership...</option>
            {ownershipOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="remarks" className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
          <textarea
            id="remarks"
            value={data.remarks}
            onChange={(e) => onUpdate('remarks', e.target.value)}
            rows={3}
            placeholder="e.g., Leaning towards east, evidence of fungal growth..."
            className="w-full p-2 border border-gray-300 rounded-md text-sm resize-y"
          />
        </div>
      </div>
    </details>
  );
}