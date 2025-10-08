'use client';
import React, { createContext, useCallback, useContext, useState } from 'react';

type Toast = { id: string; title?: string; description?: string };
type ToastContextValue = {
  toasts: Toast[];
  showToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, ...t }]);
      setTimeout(() => dismissToast(id), 3000);
    },
    [dismissToast]
  );

  const value: ToastContextValue = { toasts, showToast, dismissToast };
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
