'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';

/** Komponen dalam Suspense: tempat kita akses search params */
function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  useEffect(() => {
    (async () => {
      // Pakai optional chaining supaya aman bagi TS
      const code = searchParams?.get('code') ?? '';
      if (!code) {
        router.replace('/login');
        return;
      }

      if (!supabase) {
        showToast({
          title: 'Konfigurasi belum lengkap',
          description:
            'Supabase belum terkonfigurasi. Hubungi administrator untuk melengkapi environment variable.',
          variant: 'destructive',
        });
        router.replace('/login');
        return;
      }

      // Tukar code -> session (PKCE)
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        showToast({
          title: 'Gagal login',
          description: error.message,
          variant: 'destructive',
        });
        router.replace('/login');
        return;
      }

      router.replace('/dashboard');
    })();
    // searchParams adalah object stable; dependensinya aman
  }, [searchParams, router, supabase, showToast]);

  return <div className="p-6 text-sm">Menyelesaikan login…</div>;
}

/** Page dibungkus Suspense (sesuai saran Next) */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Memuat…</div>}>
      <CallbackInner />
    </Suspense>
  );
}
