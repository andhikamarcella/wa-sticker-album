import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

export type SupabaseServerClient = SupabaseClient<any>;

export function getServerClient(): SupabaseServerClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
      from() {
        throw new Error('Supabase environment variables are not configured.');
      },
      storage: {
        from() {
          throw new Error('Supabase environment variables are not configured.');
        },
      },
    } as unknown as SupabaseServerClient;
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
          // ignored because the cookie store can be read-only during SSR
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 });
        } catch {
          // ignored because the cookie store can be read-only during SSR
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
      if (error.status === 401) {
        return { user: null };
      }

      throw error;
    }

    return { user: data.user ?? null };
  } catch (error) {
    return { user: null };
  }
}
