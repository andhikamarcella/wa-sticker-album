import { notFound, redirect } from 'next/navigation';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UploadDropzone } from '@/components/UploadDropzone';
import { StickerGrid } from '@/components/StickerGrid';
import { PackBuilder } from '@/components/PackBuilder';
import { ShareButtons } from '@/components/ShareButtons';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getServerClient } from '@/lib/supabaseServer';
import { slugify } from '@/lib/slug';

import type { Database } from '@/types/database';

type AlbumRow = Database['public']['Tables']['albums']['Row'];
type AlbumUpdate = Database['public']['Tables']['albums']['Update'];

type AlbumPageProps = {
  params: { slug: string };
};

export default async function AlbumPage({ params }: AlbumPageProps) {
  const supabase = getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: album, error } = await supabase
    .from('albums')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle<AlbumRow>();

  if (error) {
    if (error.code === 'PGRST116' || error.code === '42501') {
      notFound();
    }

    throw error;
  }

  if (!album) {
    notFound();
  }

  const albumRow: AlbumRow = album;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const publicUrl = `${baseUrl}/albums/${albumRow.slug}`;

  async function updateAlbum(formData: FormData) {
    'use server';
    const name = formData.get('name')?.toString().trim();
    const visibility = (formData.get('visibility')?.toString() ?? albumRow.visibility) as AlbumRow['visibility'];

    const payload: AlbumUpdate = {
      name: name && name.length ? name : albumRow.name,
      slug: name && name.length ? slugify(name) : albumRow.slug,
      visibility,
    };

    const supabaseServer = getServerClient();
    await (supabaseServer.from('albums') as unknown as {
      update(values: AlbumUpdate): { eq(column: string, value: string): Promise<unknown> };
    })
      .update(payload)
      .eq('id', albumRow.id);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{albumRow.name}</h1>
        <p className="text-sm text-muted-foreground">
          Kelola sticker, pack, dan bagikan album ini.
        </p>
      </div>

      <Tabs defaultValue="stickers">
        <TabsList className="w-full">
          <TabsTrigger value="stickers">Sticker</TabsTrigger>
          <TabsTrigger value="pack">Pack</TabsTrigger>
          <TabsTrigger value="share">Bagikan</TabsTrigger>
          <TabsTrigger value="settings">Pengaturan</TabsTrigger>
        </TabsList>

        <TabsContent value="stickers">
          <div className="space-y-8">
            <UploadDropzone albumId={albumRow.id} />
            <div className="rounded-3xl border border-border bg-background p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Sticker dalam album</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Convert WEBP otomatis</span>
                  <span>•</span>
                  <span>Reorder & tag batch</span>
                </div>
              </div>
              <StickerGrid albumId={albumRow.id} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pack">
          <PackBuilder albumId={albumRow.id} />
        </TabsContent>

        <TabsContent value="share">
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Bagikan album ini via tautan publik atau WhatsApp. QR code akan dibuat otomatis.
            </p>
            <ShareButtons albumId={albumRow.id} albumName={albumRow.name} publicUrl={publicUrl} />
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <form action={updateAlbum} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nama album</label>
              <Input name="name" defaultValue={albumRow.name} className="mt-2" />
            </div>
            <div>
              <label className="text-sm font-medium">Visibilitas</label>
              <select
                name="visibility"
                defaultValue={albumRow.visibility}
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
              >
                <option value="public">Publik</option>
                <option value="unlisted">Tersembunyi</option>
                <option value="private">Pribadi</option>
              </select>
            </div>
            <Button type="submit">Simpan Perubahan</Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
