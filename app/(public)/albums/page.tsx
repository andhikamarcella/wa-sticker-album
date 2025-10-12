import { AlbumCard } from '@/components/AlbumCard';
import { getServerClient } from '@/lib/supabaseServer';
import { isSupabaseConfigured } from '@/lib/env';
import { mockListAlbumsByVisibility, mockListStickers } from '@/lib/mockDb';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

type AlbumRow = Database['public']['Tables']['albums']['Row'];
type PublicAlbum = Pick<AlbumRow, 'id' | 'name' | 'slug' | 'visibility' | 'updated_at'>;

export default async function PublicAlbumsPage() {
  if (!isSupabaseConfigured()) {
    const albums = mockListAlbumsByVisibility(['public', 'unlisted']).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Album Publik</h1>
          <p className="text-sm text-muted-foreground">
            Jelajahi koleksi sticker yang bisa kamu unduh dan bagikan.
          </p>
        </div>
        {albums.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => {
              const stickers = mockListStickers(album.id);
              return (
                <AlbumCard
                  key={album.id}
                  id={album.id}
                  name={album.name}
                  slug={album.slug}
                  visibility={album.visibility}
                  updatedAt={album.updatedAt}
                  stickersCount={stickers.length}
                  thumbnails={stickers.slice(0, 6).map((item) => item.thumbUrl || item.fileUrl)}
                  href={`/p/${album.slug}`}
                />
              );
            })}
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed border-border/60 bg-card/50 p-8 text-center text-sm text-muted-foreground">
            Tidak ada album.
          </p>
        )}
      </div>
    );
  }

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from('albums')
    .select('id, name, slug, visibility, updated_at')
    .in('visibility', ['public', 'unlisted'])
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const albums = (data ?? []) as PublicAlbum[];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Album Publik</h1>
        <p className="text-sm text-muted-foreground">
          Jelajahi koleksi sticker yang bisa kamu unduh dan bagikan.
        </p>
      </div>
      {albums.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              id={album.id}
              name={album.name}
              slug={album.slug}
              visibility={album.visibility}
              updatedAt={album.updated_at ?? ''}
              stickersCount={undefined}
              thumbnails={[]}
              href={`/p/${album.slug}`}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-3xl border border-dashed border-border/60 bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Tidak ada album.
        </p>
      )}
    </div>
  );
}
