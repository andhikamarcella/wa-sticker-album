// app/(dashboard)/albums/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export default async function AlbumPage({
  params,
}: { params: { slug: string } }) {
  const supabase = getSupabaseServerClient();

  const { data: album, error } = await supabase
    .from('albums')
    .select('id, name, slug, visibility, owner_id, updated_at')
    .eq('slug', params.slug)
    .maybeSingle();

  // Treat "not found" OR "RLS denied" as 404
  if (!album) {
    // You can log error?.code if you want, but don't use error.status (it isn't typed).
    // console.warn('album fetch error', error?.code, error?.message);
    notFound();
  }

  // ...render rest of the page with "album"
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{album.name}</h1>
      {/* your tabs/components here */}
    </div>
  );
}
