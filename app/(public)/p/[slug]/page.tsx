import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ShareButtons } from '@/components/ShareButtons';
import { QRCodeCard } from '@/components/QRCodeCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getServerClient } from '@/lib/supabaseServer';
import { formatCount } from '@/lib/utils';

interface PublicAlbumPageProps {
  params: {
    slug: string;
  };
}

type AlbumRow = {
  id: string;
  name: string;
  slug: string;
  visibility: 'public' | 'unlisted' | 'private';
  updated_at: string | null;
};

type StickerRow = {
  id: string;
  file_url: string | null;
  thumb_url: string | null;
  title: string | null;
  sort_index: number | null;
};

type PackRow = {
  id: string;
  name: string;
  exported_zip_url: string | null;
  public_url: string | null;
  wa_share_url: string | null;
  created_at: string | null;
};

const VISIBILITY_BADGE: Record<'public' | 'unlisted' | 'private', string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

export default async function PublicAlbumPage({ params }: PublicAlbumPageProps) {
  const supabase = getServerClient();
  const { data: album, error: albumError } = await (supabase.from('albums') as any)
    .select('id, name, slug, visibility, updated_at')
    .eq('slug', params.slug)
    .maybeSingle();

  if (albumError) {
    if (albumError.code === 'PGRST116' || albumError.status === 406 || albumError.status === 404) {
      notFound();
    }

    throw albumError;
  }

  const albumData = album as AlbumRow | null;
  if (!albumData || !['public', 'unlisted'].includes(albumData.visibility)) {
    notFound();
  }

  const { data: stickersData, error: stickersError } = await (supabase.from('stickers') as any)
    .select('id, file_url, thumb_url, title, sort_index')
    .eq('album_id', albumData.id)
    .order('sort_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (stickersError) {
    throw stickersError;
  }

  const stickers = (stickersData as StickerRow[] | null) ?? [];

  const { data: packData, error: packError } = await (supabase.from('packs') as any)
    .select('id, name, exported_zip_url, public_url, wa_share_url, created_at')
    .eq('album_id', albumData.id)
    .not('exported_zip_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (packError && packError.code !== 'PGRST116' && packError.status !== 406) {
    throw packError;
  }

  const latestPack = packData && (packData as PackRow).exported_zip_url ? (packData as PackRow) : null;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const publicUrl = `${siteUrl}/p/${albumData.slug}`;
  const updatedAt = albumData.updated_at ? new Date(albumData.updated_at) : null;
  const formattedUpdatedAt = updatedAt && !Number.isNaN(updatedAt.getTime())
    ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(updatedAt)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-6 rounded-3xl border border-border/80 bg-card/80 p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{albumData.name}</h1>
              <Badge variant="secondary" className="rounded-full">
                {VISIBILITY_BADGE[albumData.visibility]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatCount(stickers.length)} stickers ·{' '}
              {formattedUpdatedAt ? `Updated ${formattedUpdatedAt}` : 'Recently updated'}
            </p>
          </div>
          {latestPack?.exported_zip_url ? (
            <Button asChild size="lg" className="rounded-full px-6">
              <Link href={latestPack.exported_zip_url} target="_blank" rel="noopener noreferrer">
                Download latest pack
              </Link>
            </Button>
          ) : (
            <div className="rounded-full border border-dashed border-muted-foreground/40 px-4 py-2 text-sm text-muted-foreground">
              Pack export coming soon
            </div>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ShareButtons publicUrl={publicUrl} waUrl={latestPack?.wa_share_url ?? undefined} />
          <QRCodeCard url={publicUrl} />
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Sticker preview</h2>
          <span className="text-sm text-muted-foreground">Read-only view</span>
        </div>
        {stickers.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stickers.map((sticker) => (
              <Card key={sticker.id} className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-sm">
                <div className="relative aspect-square bg-muted">
                  {sticker.thumb_url || sticker.file_url ? (
                    <Image
                      src={(sticker.thumb_url ?? sticker.file_url) as string}
                      alt={sticker.title ?? 'Sticker preview'}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      No preview
                    </div>
                  )}
                </div>
                {(sticker.title ?? '').trim() && (
                  <CardContent className="p-4">
                    <p className="truncate text-sm font-medium">{sticker.title}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-muted-foreground/30 bg-card/60 p-12 text-center">
            <p className="text-sm text-muted-foreground">No stickers published yet.</p>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-border/70 bg-card/70 p-8 shadow-sm">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Download pack</h2>
          {latestPack?.exported_zip_url ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{latestPack.name || 'Sticker pack'}</p>
                {latestPack.created_at && (
                  <p>Exported on {new Date(latestPack.created_at).toLocaleString()}</p>
                )}
              </div>
              <Button asChild size="lg" className="rounded-full px-6">
                <Link href={latestPack.exported_zip_url} target="_blank" rel="noopener noreferrer">
                  Download ZIP
                </Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Once the owner exports a pack, a download link will appear here.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
