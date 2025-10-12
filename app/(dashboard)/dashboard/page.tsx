import { redirect } from 'next/navigation';

import Providers from '@/components/Providers';
import { DashboardShell } from './_components/dashboard-shell';
import getServerUser from '@/lib/supabaseServer';
import { isSupabaseConfigured } from '@/lib/env';

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

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name : undefined;
  const displayLabel = fullName && fullName.trim().length > 0 ? fullName : user.email ?? user.phone ?? undefined;

  return (
    <Providers>
      <DashboardShell userLabel={displayLabel} />
    </Providers>
  );
}
