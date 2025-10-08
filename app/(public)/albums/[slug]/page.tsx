import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ShareButtons } from '@/components/ShareButtons';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { PublicDownloadButton } from '@/components/PublicDownloadButton';

interface PublicAlbumPageProps {
  params: { slug: string };
}

export default async function PublicAlbumPage({ params }: PublicAlbumPageProps) {
  const supabase = getSupabaseServerClient();
  const { data: album } = await supabase
    .from('albums')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!album || album.visibility === 'private') {
    notFound();
  }

  const { data: stickers } = await supabase
    .from('stickers')
    .select('*')
    .eq('album_id', album.id)
    .order('created_at', { ascending: false });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const albumUrl = `${baseUrl}/albums/${album.slug}`;
  const stickerIds = stickers?.map((sticker) => sticker.id) ?? [];

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-border bg-card p-8">
        <h1 className="text-3xl font-bold">{album.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Album ini bersifat {album.visibility === 'public' ? 'publik' : 'tautan tersembunyi'}.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ShareButtons albumId={album.id} albumName={album.name} publicUrl={albumUrl} />
          <PublicDownloadButton stickerIds={stickerIds} albumName={album.name} />
        </div>
      </div>
      <div>
        <h2 className="mb-4 text-xl font-semibold">Sticker ({stickers?.length ?? 0})</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {stickers?.map((sticker) => (
            <div key={sticker.id} className="rounded-3xl border border-border p-2">
              <div className="relative h-32 w-full overflow-hidden rounded-2xl bg-muted">
                <Image src={sticker.thumb_url ?? sticker.file_url} alt={sticker.title ?? 'Sticker'} fill className="object-cover" />
              </div>
              <p className="mt-2 text-xs font-medium">{sticker.title ?? 'Tanpa nama'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
