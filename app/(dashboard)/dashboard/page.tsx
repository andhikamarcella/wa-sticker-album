import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import Providers from '@/components/Providers';
import { DashboardShell } from './_components/dashboard-shell';
import getServerUser from '@/lib/supabaseServer';
import { isSupabaseConfigured } from '@/lib/env';

function resolveUserLabel(user: User): string | null {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name : undefined;
  if (fullName && fullName.trim().length > 0) {
    return fullName.trim();
  }

  const displayName = typeof metadata.display_name === 'string' ? metadata.display_name : undefined;
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim();
  }

  if (user.email && user.email.length > 0) {
    return user.email;
  }

  if (user.phone && user.phone.length > 0) {
    return user.phone;
  }

  return null;
}

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <Providers>
        <DashboardShell userLabel={null} />
      </Providers>
    );
  }

  const { user } = await getServerUser();

  if (!user) {
    redirect('/login');
  }

  const displayLabel = resolveUserLabel(user);

  return (
    <Providers>
      <DashboardShell userLabel={displayLabel} />
    </Providers>
  );
}
