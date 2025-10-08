'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';

export default function AuthCallbackPage() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClient();
  const { showToast } = useToast();

  useEffect(() => {
    (async () => {
      const code = search.get('code');
      if (!code) {
        router.replace('/login');
        return;
      }

      // Karena detectSessionInUrl:false, kita tukar manual
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
  }, [search, router, supabase, showToast]);

  return <div className="p-6 text-sm">Menyelesaikan login…</div>;
}
