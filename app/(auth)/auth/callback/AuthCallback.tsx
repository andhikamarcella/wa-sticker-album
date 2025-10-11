'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';

export default function AuthCallback() {
  const router = useRouter();
  const sp = useSearchParams();
  const { showToast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    (async () => {
      const code = sp?.get?.('code') ?? '';
      if (!code) { router.replace('/login'); return; }

      if (!supabase) {
        showToast({
          title: 'Konfigurasi belum lengkap',
          description:
            'Supabase belum terkonfigurasi. Hubungi administrator untuk melengkapi environment variable.',
          variant: 'destructive',
        });
        router.replace('/login?error=magic-link');
        return;
      }

      try {
        // Kompatibel lintas versi supabase-js
        const authAny = supabase.auth as any;
        const resp =
          typeof authAny.exchangeCodeForSession === 'function' &&
          authAny.exchangeCodeForSession.length >= 1
            ? await authAny.exchangeCodeForSession(code)   // versi lama: (code: string)
            : await authAny.exchangeCodeForSession();      // versi baru: tanpa argumen

        if (resp?.error) {
          showToast({
            title: 'Gagal login',
            description: resp.error.message ?? 'Tidak bisa menukar kode.',
            variant: 'destructive',
          });
          router.replace('/login?error=magic-link');
          return;
        }

        // Penting: refresh agar RSC membaca cookie sesi yang baru
        router.replace('/dashboard');
        router.refresh();
      } catch (e: any) {
        showToast({ title: 'Gagal login', description: e?.message ?? 'Terjadi kesalahan.', variant: 'destructive' });
        router.replace('/login?error=magic-link');
      }
    })();
  }, [router, sp, supabase, showToast]);

  return null;
}
