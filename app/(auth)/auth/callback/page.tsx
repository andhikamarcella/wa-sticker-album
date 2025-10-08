'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams(); // bisa dipersepsikan null di tipe tertentu
  const { showToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      // guard aman untuk TS: kalau sp null, code jadi null
      const code = sp?.get?.('code') ?? null;

      if (!code) {
        router.replace('/login');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession();
      if (error) {
        showToast({
          title: 'Gagal login',
          description: error.message,
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
