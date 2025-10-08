'use client';

import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export function Toaster() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto w-full max-w-sm rounded-3xl border border-border bg-card p-4 shadow-lg backdrop-blur',
            toast.variant === 'destructive' && 'border-destructive/60 text-destructive',
            toast.variant === 'success' && 'border-emerald-500/60 text-emerald-500'
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
              {toast.description && <p className="text-sm text-muted-foreground">{toast.description}</p>}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="rounded-full p-1 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
