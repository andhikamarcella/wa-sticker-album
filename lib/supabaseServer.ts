import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

export type SupabaseServerClient = SupabaseClient<any>;

export function getServerClient(): SupabaseServerClient {
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
throw new Error('Supabase environment variables are not configured.');
}

const cookieStore = cookies();

return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
cookies: {
get(name: string) {
return cookieStore.get(name)?.value;
},
set(name: string, value: string, options: CookieOptions) {
try {
cookieStore.set({ name, value, ...options });
} catch {
// Ignore write failures during SSR
}
},
remove(name: string, options: CookieOptions) {
try {
cookieStore.set({ name, value: '', ...options, maxAge: 0 });
} catch {
// Ignore write failures during SSR
}
},
},
});
}

export default async function getServerUser(): Promise<{ user: User | null }> {
try {
const supabase = getServerClient();
const { data, error } = await supabase.auth.getUser();
if (error) {
  if ((error as any).status === 401) {
    return { user: null };
  }
  throw error;
}

return { user: data.user ?? null };
} catch {
return { user: null };
}
}