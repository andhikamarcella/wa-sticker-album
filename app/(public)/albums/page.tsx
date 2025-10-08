import { AlbumCard } from '@/components/AlbumCard';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export default async function PublicAlbumsPage() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from('albums')
    .select('*')
    .in('visibility', ['public', 'unlisted'])
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Album Publik</h1>
        <p className="text-sm text-muted-foreground">
          Jelajahi koleksi sticker yang bisa kamu unduh dan bagikan.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((album) => (
          <AlbumCard key={album.id} {...album} hideActions />
        )) ?? <p>Tidak ada album.</p>}
      </div>
    </div>
  );
}
