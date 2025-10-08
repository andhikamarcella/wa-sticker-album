import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client untuk komponen “use client”
export const supabase = createClient(url, anon);

// default export biar gampang di-import
export default supabase;
