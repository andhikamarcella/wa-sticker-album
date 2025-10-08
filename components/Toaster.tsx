'use client';
import * as React from 'react';
import { useToast } from '@/hooks/useToast';

type Variant = 'default' | 'success' | 'destructive';
const variantClass: Record<Variant, string> = {
  default: 'bg-foreground text-background',
  success: 'bg-emerald-600 text-white',
  destructive: 'bg-red-600 text-white',
};

export function Toaster() {
  const { toasts, dismissToast } = useToast();
  if (!toasts?.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[90vw] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded-2xl px-4 py-3 shadow-lg ${variantClass[(t.variant ?? 'default') as Variant]}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {t.title && <p className="font-semibold leading-snug">{t.title}</p>}
              {t.description && <p className="mt-0.5 break-words text-sm opacity-90">{t.description}</p>}
            </div>
            <button onClick={() => dismissToast(t.id)} className="shrink-0 rounded-md/50 px-2 text-sm/none opacity-80 hover:opacity-100" aria-label="Tutup">×</button>
          </div>
        </div>
      ))}
    </div>
  );
}
export default Toaster;
