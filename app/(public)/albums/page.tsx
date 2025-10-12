import { AlbumCard, type AlbumVisibility } from '@/components/AlbumCard';
import { getServerClient } from '@/lib/supabaseServer';
import { isSupabaseConfigured } from '@/lib/env';
import { mockListAlbumsByVisibility, mockListStickers } from '@/lib/mockDb';
import { SupabaseSchemaMissingError, shouldUseMockFromSupabaseError } from '@/lib/utils';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

type AlbumRow = Database['public']['Tables']['albums']['Row'];
type StickerRow = { file_url: string | null; thumb_url: string | null };

type AlbumListItem = {
  id: string;
  name: string;
  slug: string;
  visibility: AlbumVisibility;
  updatedAt: string;
  stickersCount: number;
  thumbnails: string[];
};

export default async function PublicAlbumsPage() {
  const renderList = (items: AlbumListItem[]) => (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Album Publik</h1>
        <p className="text-sm text-muted-foreground">
          Jelajahi koleksi sticker yang bisa kamu unduh dan bagikan.
        </p>
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((album) => (
            <AlbumCard
              key={album.id}
              id={album.id}
              name={album.name}
              slug={album.slug}
              visibility={album.visibility}
              updatedAt={album.updatedAt}
              stickersCount={album.stickersCount}
              thumbnails={album.thumbnails}
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

  const buildMockAlbums = (): AlbumListItem[] =>
    mockListAlbumsByVisibility(['public', 'unlisted'])
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((album) => {
        const stickers = mockListStickers(album.id);
        const thumbnails = stickers
          .slice(0, 6)
          .map((item) => item.thumbUrl || item.fileUrl)
          .filter((value): value is string => Boolean(value));

        return {
          id: album.id,
          name: album.name,
          slug: album.slug,
          visibility: album.visibility,
          updatedAt: album.updatedAt,
          stickersCount: stickers.length,
          thumbnails,
        } satisfies AlbumListItem;
      });

  if (!isSupabaseConfigured()) {
    return renderList(buildMockAlbums());
  }

  try {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from('albums')
      .select('id, name, slug, visibility, updated_at, created_at')
      .in('visibility', ['public', 'unlisted'])
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false });

    if (error) {
      if (shouldUseMockFromSupabaseError(error)) {
        throw new SupabaseSchemaMissingError(error.message);
      }
      throw error;
    }

    const albums = (data ?? []) as (AlbumRow & { created_at: string | null })[];

    const enriched = await Promise.all(
      albums.map(async (album) => {
        const { data: stickersData, count, error: stickersError } = await supabase
          .from('stickers')
          .select('file_url, thumb_url', { count: 'exact' })
          .eq('album_id', album.id)
          .order('sort_index', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(6);

        if (stickersError) {
          if (shouldUseMockFromSupabaseError(stickersError)) {
            throw new SupabaseSchemaMissingError(stickersError.message);
          }
          throw stickersError;
        }

        const thumbnails = ((stickersData as StickerRow[] | null) ?? [])
          .map((item) => item.thumb_url ?? item.file_url)
          .filter((value): value is string => Boolean(value));

        return {
          id: album.id,
          name: album.name,
          slug: album.slug,
          visibility: album.visibility,
          updatedAt: album.updated_at ?? album.created_at ?? new Date().toISOString(),
          stickersCount: typeof count === 'number' ? count : thumbnails.length,
          thumbnails,
        } satisfies AlbumListItem;
      }),
    );

    return renderList(enriched);
  } catch (error) {
    if (error instanceof SupabaseSchemaMissingError || shouldUseMockFromSupabaseError(error)) {
      return renderList(buildMockAlbums());
    }
    throw error;
  }
}
