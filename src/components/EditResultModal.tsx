// src/components/EditResultModal.tsx
import { useState, useEffect } from 'react';
import { TreeResult } from '../apiService';
import { AdditionalData } from './AdditionalDetailsForm';
import { LocationPicker } from './LocationPicker';
import { X, Save, MapPin } from 'lucide-react';

type LocationData = { lat: number; lng: number } | null;

interface EditResultModalProps {
  result: TreeResult;
  onClose: () => void;
  onSave: (updatedData: AdditionalData, updatedLocation: LocationData) => void;
  theme?: 'light' | 'dark';
}

export function EditResultModal({ result, onClose, onSave, theme = 'dark' }: EditResultModalProps) {
  const [editableData, setEditableData] = useState<AdditionalData>({
    condition: '',
    ownership: '',
    remarks: ''
  });
  
  const [editableLocation, setEditableLocation] = useState<LocationData>(null);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

  useEffect(() => {
    // Populate the form state when the modal opens with a result
    if (result) {
      setEditableData({
        condition: result.condition || '',
        ownership: result.ownership || '',
        remarks: result.remarks || ''
      });
      setEditableLocation(
        result.latitude && result.longitude
          ? { lat: result.latitude, lng: result.longitude }
          : null
      );
    }
  }, [result]);

  const handleDataUpdate = (field: keyof AdditionalData, value: string) => {
    setEditableData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationConfirm = (location: LocationData) => {
    setEditableLocation(location);
    setIsLocationPickerOpen(false);
  };

  const handleSaveChanges = () => {
    onSave(editableData, editableLocation);
  };

  if (isLocationPickerOpen) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
        <div className="w-full h-full max-w-4xl max-h-[85vh] bg-background-default rounded-lg shadow-xl">
           <LocationPicker 
              onConfirm={handleLocationConfirm} 
              onCancel={() => setIsLocationPickerOpen(false)} 
              initialLocation={editableLocation}
              theme={theme}
            />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-down">
      <div className="bg-background-default rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b border-stroke-default">
          <h2 className="text-lg font-semibold text-content-default">Edit Measurement</h2>
          <button onClick={onClose} className="p-1 text-content-subtle hover:text-content-default rounded-full hover:bg-background-inset transition-colors">
            <X size={20} />
          </button>
        </header>

        <main className="flex-grow p-6 overflow-y-auto space-y-6">
          <div>
            <h3 className="text-base font-medium text-content-default mb-2">Details</h3>
            {/* The AdditionalDetailsForm is reused here, but we don't need its <details> wrapper */}
            <div className="p-4 border border-stroke-default rounded-lg space-y-4 bg-background-subtle">
               <div>
                 <label htmlFor="edit-condition" className="block text-xs font-medium text-content-subtle mb-1">Condition</label>
                 <select id="edit-condition" value={editableData.condition} onChange={(e) => handleDataUpdate('condition', e.target.value)} className="w-full p-2 border border-stroke-default rounded-md text-sm bg-background-default text-content-default">
                   <option value="">Select condition...</option>
                   {['Healthy', 'Average', 'Poor', 'Dead'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                 </select>
               </div>
               <div>
                 <label htmlFor="edit-ownership" className="block text-xs font-medium text-content-subtle mb-1">Ownership</label>
                 <select id="edit-ownership" value={editableData.ownership} onChange={(e) => handleDataUpdate('ownership', e.target.value)} className="w-full p-2 border border-stroke-default rounded-md text-sm bg-background-default text-content-default">
                   <option value="">Select ownership...</option>
                   {['Avenues', 'Garden', 'Government', 'In Well', 'Industrial', 'On Bridge', 'On Divider', 'On Foot Path', 'On Road', 'On Wall', 'Private', 'Public', 'Semi Government'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                 </select>
               </div>
               <div>
                 <label htmlFor="edit-remarks" className="block text-xs font-medium text-content-subtle mb-1">Remarks</label>
                 <textarea id="edit-remarks" value={editableData.remarks} onChange={(e) => handleDataUpdate('remarks', e.target.value)} rows={3} placeholder="e.g., Leaning towards east..." className="w-full p-2 border border-stroke-default rounded-md text-sm resize-y bg-background-default text-content-default placeholder:text-content-subtle" />
               </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-base font-medium text-content-default mb-2">Location</h3>
            <button onClick={() => setIsLocationPickerOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-background-default border border-stroke-default text-content-default rounded-lg hover:bg-background-inset transition-colors">
              <MapPin className="w-5 h-5 text-brand-secondary" />
              <span className="text-sm">
                {editableLocation ? `Lat: ${editableLocation.lat.toFixed(4)}, Lng: ${editableLocation.lng.toFixed(4)}` : 'Set Location on Map'}
              </span>
            </button>
          </div>
        </main>
        
        <footer className="flex-shrink-0 flex justify-end gap-3 p-4 border-t border-stroke-default bg-background-subtle">
          <button onClick={onClose} className="px-4 py-2 text-sm text-content-default bg-background-inset rounded-lg hover:bg-background-subtle transition-colors">
            Cancel
          </button>
          <button onClick={handleSaveChanges} className="flex items-center gap-2 px-6 py-2 bg-brand-primary text-content-on-brand rounded-lg font-medium hover:bg-brand-primary-hover transition-colors">
            <Save size={16} />
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
}