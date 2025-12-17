import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto dismiss
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`
              pointer-events-auto
              flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border
              animate-slide-left transition-all
              ${toast.type === 'success' ? 'bg-background-default border-status-success text-content-default' : ''}
              ${toast.type === 'error' ? 'bg-background-default border-status-error text-content-default' : ''}
              ${toast.type === 'info' ? 'bg-background-default border-status-info text-content-default' : ''}
            `}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-status-success" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-status-error" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-status-info" />}
            
            <p className="text-sm font-medium">{toast.message}</p>
            
            <button onClick={() => removeToast(toast.id)} className="ml-2 hover:opacity-70">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
