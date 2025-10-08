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
      if (!code) { router.replace('/login'); return; }

      try {
        // Kompatibel lintas versi supabase-js
        const authAny = supabase.auth as any;
        const resp =
          typeof authAny.exchangeCodeForSession === 'function' &&
          authAny.exchangeCodeForSession.length >= 1
            ? await authAny.exchangeCodeForSession(code)   // versi lama: (code: string)
            : await authAny.exchangeCodeForSession();      // versi baru: tanpa argumen

        if (resp?.error) {
          showToast({ title: 'Gagal login', description: resp.error.message ?? 'Tidak bisa menukar kode.', variant: 'destructive' });
          router.replace('/login?error=magic-link');
          return;
        }

        // ✅ penting: refresh supaya RSC membaca cookie sesi baru
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
