'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { showToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const code = sp?.get?.('code') ?? '';
      if (!code) {
        router.replace('/login');
        return;
      }

      // Support berbagai versi supabase-js:
      // - v2 older: exchangeCodeForSession(code: string)
      // - v2 newer: exchangeCodeForSession(): Promise<{ error? }>
      // Kita panggil dengan cast any agar lolos type-check di semua versi.
      let resp: any;
      try {
        const authAny = (supabase.auth as any);
        resp =
          authAny.exchangeCodeForSession.length >= 1
            ? await authAny.exchangeCodeForSession(code)      // versi lama
            : await authAny.exchangeCodeForSession();         // versi baru
      } catch (e: any) {
        showToast({
          title: 'Gagal login',
          description: e?.message ?? 'Terjadi kesalahan saat menyelesaikan login.',
          variant: 'destructive',
        });
        router.replace('/login?error=magic-link');
        return;
      }

      if (resp?.error) {
        showToast({
          title: 'Gagal login',
          description: resp.error.message ?? 'Tidak bisa menukar kode menjadi sesi.',
          variant: 'destructive',
        });
        router.replace('/login?error=magic-link');
        return;
      }

      router.replace('/dashboard');
    })();
  }, [router, sp, supabase, showToast]);

  return <div className="p-6 text-sm">Menyelesaikan login…</div>;
}
