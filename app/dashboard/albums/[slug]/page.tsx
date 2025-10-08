import { notFound, redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UploadDropzone } from '@/components/UploadDropzone';
import { StickerGrid } from '@/components/StickerGrid';
import { PackBuilder } from '@/components/PackBuilder';
import { ShareButtons } from '@/components/ShareButtons';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { slugify } from '@/lib/slug';

type AlbumPageProps = {
  params: { slug: string };
};

export default async function AlbumPage({ params }: AlbumPageProps) {
  const supabase = getSupabaseServerClient();

  // auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ambil album by slug (BUKAN id)
  const { data: album, error } = await supabase
    .from('albums')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (!album || error) notFound();

  // pakai env yang ada di Vercel
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const publicUrl = `${baseUrl}/albums/${album.slug}`;

  // server action untuk update album
  async function updateAlbum(formData: FormData) {
    'use server';
    const name = formData.get('name')?.toString().trim();
    const visibility = (formData.get('visibility')?.toString() ??
      album.visibility) as 'public' | 'unlisted' | 'private';

    const supabaseServer = getSupabaseServerClient();
    await supabaseServer
      .from('albums')
      .update({
        name: name && name.length ? name : album.name,
        slug: name && name.length ? slugify(name) : album.slug,
        visibility,
      })
      .eq('id', album.id); // update tetap aman pakai primary key id
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{album.name}</h1>
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
            <UploadDropzone albumId={album.id} />
            <div className="rounded-3xl border border-border bg-background p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Sticker dalam album</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Convert WEBP otomatis</span>
                  <span>•</span>
                  <span>Reorder & tag batch</span>
                </div>
              </div>
              <StickerGrid albumId={album.id} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pack">
          <PackBuilder albumId={album.id} />
        </TabsContent>

        <TabsContent value="share">
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Bagikan album ini via tautan publik atau WhatsApp. QR code akan dibuat otomatis.
            </p>
            <ShareButtons albumId={album.id} albumName={album.name} publicUrl={publicUrl} />
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <form action={updateAlbum} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nama album</label>
              <Input name="name" defaultValue={album.name} className="mt-2" />
            </div>
            <div>
              <label className="text-sm font-medium">Visibilitas</label>
              <select
                name="visibility"
                defaultValue={album.visibility}
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

