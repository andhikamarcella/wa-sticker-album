const DEFAULT_BASE_URL = 'http://localhost:3000';

function clean(value?: string | null) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(clean(process.env.NEXT_PUBLIC_SUPABASE_URL) && clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(isSupabaseConfigured() && clean(process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export function getSupabaseMissingMessage(scope: 'browser' | 'admin' = 'browser'): string {
  if (scope === 'admin') {
    return (
      'Supabase admin credentials are missing. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return 'Supabase credentials are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to continue.';
}

export function resolveAppUrl(): string {
  const explicitApp = clean(process.env.NEXT_PUBLIC_APP_URL);
  if (explicitApp) {
    return explicitApp;
  }

  const siteUrl = clean(process.env.NEXT_PUBLIC_SITE_URL);
  if (siteUrl) {
    return siteUrl;
  }

  const vercelUrl = clean(process.env.NEXT_PUBLIC_VERCEL_URL);
  if (vercelUrl) {
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
  }

  return DEFAULT_BASE_URL;
}
