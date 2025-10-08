// lib/supabaseClient.ts
'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createBrowserClient(url, anon, {
    auth: {
      flowType: 'pkce',          // penting untuk PKCE
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // karena kita tukar code manual di /auth/callback
    },
  });
}

// (opsional) kalau butuh tipe:
export type SupabaseBrowserClient = ReturnType<typeof createClient>;

export default createClient;
