// src/components/InstructionToast.tsx
import React, { useState, useEffect } from 'react';

import { Info } from 'lucide-react';

interface InstructionToastProps {
  message: string;
  show: boolean;
  onClose: () => void;
}

export function InstructionToast({ message, show, onClose }: InstructionToastProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 6000); // Auto-hide after 6 seconds
      return () => clearTimeout(timer);
    }
  }, [show, onClose, message]); // Also re-trigger timer if message changes while shown

  if (!show) {
    return null;
  }

  return (
    <div className="md:hidden fixed top-4 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-md pointer-events-none">
      <div className="flex items-start gap-3 bg-slate-800/95 text-white p-4 rounded-xl shadow-lg backdrop-blur-sm animate-fade-in-down">
        <Info className="w-5 h-5 text-sky-300 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}