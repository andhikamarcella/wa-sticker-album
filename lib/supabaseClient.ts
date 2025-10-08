// lib/supabaseClient.ts
'use client';
import { createClient as _createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ✅ default client (boleh dipakai langsung)
export const supabase: SupabaseClient = _createClient(url, anon);
export default supabase;

// ✅ named export (untuk pola: const supabase = createClient();)
export function createClient(): SupabaseClient {
  return _createClient(url, anon);
}
