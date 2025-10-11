// lib/supabaseServer.ts
import { cookies, headers } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client (PKCE/session via cookies).
 * Works in App Router server components, route handlers, and server actions.
 */
export function getSupabaseServerClient(): SupabaseClient {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          cookieStore.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 });
        }
      },
      // forward request headers (helpful for SSR/context)
      headers: {
        get: (key: string) => headers().get(key) ?? undefined
      }
    }
  );
}

export default getSupabaseServerClient;
