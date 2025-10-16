// src/components/EditResultModal.tsx
import React, { useState, useEffect } from 'react';
import { TreeResult } from '../apiService';
import { AdditionalData, AdditionalDetailsForm } from './AdditionalDetailsForm';
import { LocationPicker } from './LocationPicker';
import { X, Save, MapPin } from 'lucide-react';

type LocationData = { lat: number; lng: number } | null;

interface EditResultModalProps {
  result: TreeResult;
  onClose: () => void;
  onSave: (updatedData: AdditionalData, updatedLocation: LocationData) => void;
}

export function EditResultModal({ result, onClose, onSave }: EditResultModalProps) {
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
        <div className="w-full h-full max-w-4xl max-h-[85vh] bg-white rounded-lg shadow-xl">
           <LocationPicker 
              onConfirm={handleLocationConfirm} 
              onCancel={() => setIsLocationPickerOpen(false)} 
              initialLocation={editableLocation} 
            />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-down">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Edit Measurement</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </header>

        <main className="flex-grow p-6 overflow-y-auto space-y-6">
          <div>
            <h3 className="text-base font-medium text-gray-700 mb-2">Details</h3>
            {/* The AdditionalDetailsForm is reused here, but we don't need its <details> wrapper */}
            <div className="p-4 border border-gray-200 rounded-lg space-y-4 bg-gray-50">
               <div>
                 <label htmlFor="edit-condition" className="block text-xs font-medium text-gray-600 mb-1">Condition</label>
                 <select id="edit-condition" value={editableData.condition} onChange={(e) => handleDataUpdate('condition', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm">
                   <option value="">Select condition...</option>
                   {['Healthy', 'Average', 'Poor', 'Dead'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                 </select>
               </div>
               <div>
                 <label htmlFor="edit-ownership" className="block text-xs font-medium text-gray-600 mb-1">Ownership</label>
                 <select id="edit-ownership" value={editableData.ownership} onChange={(e) => handleDataUpdate('ownership', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm">
                   <option value="">Select ownership...</option>
                   {['Avenues', 'Garden', 'Government', 'In Well', 'Industrial', 'On Bridge', 'On Divider', 'On Foot Path', 'On Road', 'On Wall', 'Private', 'Public', 'Semi Government'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                 </select>
               </div>
               <div>
                 <label htmlFor="edit-remarks" className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                 <textarea id="edit-remarks" value={editableData.remarks} onChange={(e) => handleDataUpdate('remarks', e.target.value)} rows={3} placeholder="e.g., Leaning towards east..." className="w-full p-2 border border-gray-300 rounded-md text-sm resize-y" />
               </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-base font-medium text-gray-700 mb-2">Location</h3>
            <button onClick={() => setIsLocationPickerOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100">
              <MapPin className="w-5 h-5 text-blue-600" />
              <span className="text-sm">
                {editableLocation ? `Lat: ${editableLocation.lat.toFixed(4)}, Lng: ${editableLocation.lng.toFixed(4)}` : 'Set Location on Map'}
              </span>
            </button>
          </div>
        </main>
        
        <footer className="flex-shrink-0 flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
            Cancel
          </button>
          <button onClick={handleSaveChanges} className="flex items-center gap-2 px-6 py-2 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800">
            <Save size={16} />
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
}