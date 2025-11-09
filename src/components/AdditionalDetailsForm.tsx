// src/components/AdditionalDetailsForm.tsx

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

// --- START: SURGICAL REPLACEMENT (THEMING) ---
export function AdditionalDetailsForm({ data, onUpdate }: AdditionalDetailsFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="condition" className="block text-xs font-medium text-content-subtle mb-1">Condition</label>
        <select
          id="condition"
          value={data.condition}
          onChange={(e) => onUpdate('condition', e.target.value)}
          className="w-full p-2 border border-stroke-default rounded-md text-sm bg-background-default text-content-default focus:ring-2 focus:ring-brand-primary"
        >
          <option value="">Select condition...</option>
          {conditionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="ownership" className="block text-xs font-medium text-content-subtle mb-1">Ownership</label>
        <select
          id="ownership"
          value={data.ownership}
          onChange={(e) => onUpdate('ownership', e.target.value)}
          className="w-full p-2 border border-stroke-default rounded-md text-sm bg-background-default text-content-default focus:ring-2 focus:ring-brand-primary"
        >
          <option value="">Select ownership...</option>
          {ownershipOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="remarks" className="block text-xs font-medium text-content-subtle mb-1">Remarks</label>
        <textarea
          id="remarks"
          value={data.remarks}
          onChange={(e) => onUpdate('remarks', e.target.value)}
          rows={3}
          placeholder="e.g., Leaning towards east, evidence of fungal growth..."
          className="w-full p-2 border border-stroke-default rounded-md text-sm resize-y bg-background-default text-content-default focus:ring-2 focus:ring-brand-primary"
        />
      </div>
    </div>
  );
}
// --- END: SURGICAL REPLACEMENT (THEMING) ---