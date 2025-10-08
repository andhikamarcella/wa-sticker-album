'use client';

import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ✅ biarkan TS infer tipenya, jangan pakai anotasi SupabaseClient
export const supabase = createBrowserClient(url, anon);
export default supabase;

// factory untuk pola "const supabase = createClient()"
export function createClient() {
  return createBrowserClient(url, anon);
}
