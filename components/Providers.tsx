'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ToastProvider } from '@/hooks/useToast';
import { Toaster } from '@/components/Toaster'; // biarkan sesuai proyekmu

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {children}
          <Toaster />
        </ToastProvider>

        {/* Hilangkan prop position biar kompatibel di semua versi */}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </NextThemesProvider>
  );
}
