// lib/supabaseClient.ts
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createBrowserClient(url, anon, {
    auth: {
      // <- INI KUNCI PKCE
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      // kita tukar code manual di /auth/callback
      detectSessionInUrl: false,
    },
  });
}

export default createClient;
