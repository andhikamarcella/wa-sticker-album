import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export default async function DashboardPage() {
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <div className="p-6">Halo, {user.email}</div>;
}
