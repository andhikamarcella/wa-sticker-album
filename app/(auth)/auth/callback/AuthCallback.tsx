'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';

export default function AuthCallback() {
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

      // Kompatibel lintas versi supabase-js
      try {
        const authAny = supabase.auth as any;
        const resp =
          typeof authAny.exchangeCodeForSession === 'function' &&
          authAny.exchangeCodeForSession.length >= 1
            ? await authAny.exchangeCodeForSession(code) // versi lama: (code: string)
            : await authAny.exchangeCodeForSession();    // versi baru: tanpa argumen

        if (resp?.error) {
          showToast({
            title: 'Gagal login',
            description: resp.error.message ?? 'Tidak bisa menukar kode menjadi sesi.',
            variant: 'destructive',
          });
          router.replace('/login?error=magic-link');
          return;
        }
      } catch (e: any) {
        showToast({
          title: 'Gagal login',
          description: e?.message ?? 'Terjadi kesalahan saat menyelesaikan login.',
          variant: 'destructive',
        });
        router.replace('/login?error=magic-link');
        return;
      }

      router.replace('/dashboard');
    })();
  }, [router, sp, supabase, showToast]);

  return null;
}
