'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ✅ singleton client (aman untuk komponen client)
export const supabase: SupabaseClient = createBrowserClient(url, anon);
export default supabase;

// ✅ factory (kalau ada kode yang memanggil createClient())
export function createClient(): SupabaseClient {
  return createBrowserClient(url, anon);
}
