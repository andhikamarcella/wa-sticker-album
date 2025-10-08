'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton client untuk komponen client
export const supabase: SupabaseClient = createBrowserClient(url, anon);
export default supabase;

// Factory (biar bisa dipanggil di mana2)
export function createClient(): SupabaseClient {
  return createBrowserClient(url, anon);
}
