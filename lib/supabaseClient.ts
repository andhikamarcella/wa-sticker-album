// lib/supabaseClient.ts
'use client';

import { createBrowserClient } from '@supabase/ssr';

export type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;

export function createClient(): SupabaseBrowserClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Supabase client credentials are not configured. Set NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY untuk mengaktifkan fitur login.'
      );
    }
    return null;
  }

  return createBrowserClient(url, anon, {
    auth: {
      flowType: 'pkce', // penting untuk PKCE
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // karena kita tukar code manual di /auth/callback
    },
  });
}

export default createClient;
