import React, { useCallback, useState } from 'react';
import { ToastContext, ToastVariant } from './toast';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const handleDismiss = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed inset-x-0 top-4 z-60 flex justify-center pointer-events-none">
        <div className="w-full max-w-md px-4 space-y-2">
          {toasts.map((toast) => (
            <button
              key={toast.id}
              type="button"
              onClick={() => handleDismiss(toast.id)}
              className={[
                'w-full text-left rounded-xl px-4 py-3 shadow-lg border pointer-events-auto transition-transform transform hover:translate-y-0.5',
                toast.variant === 'error' && 'bg-red-500/10 border-red-500/40 text-red-100',
                toast.variant === 'success' && 'bg-green-500/10 border-green-500/40 text-green-100',
                toast.variant === 'info' && 'bg-white/5 border-white/20 text-white'
              ].filter(Boolean).join(' ')}
            >
              <span className="text-sm font-medium">{toast.message}</span>
            </button>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};
