'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Toast = {
  id: number;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
};

type ToastContextValue = {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    setToasts((prev) => [...prev, { ...toast, id: Date.now() }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ toasts, showToast, dismissToast }), [
    toasts,
    showToast,
    dismissToast
  ]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
