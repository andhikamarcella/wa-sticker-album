// app/api/packs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { slugify } from '@/lib/slug';

type AlbumRow = { id: string; owner_id: string };
type PackRow = { id: string; exported_zip_url?: string | null };

async function canWriteAlbum(userId: string, albumId: string) {
  const supabase = getSupabaseServerClient();

  // ambil owner album dengan aman
  const albumRes = await supabase
    .from('albums')
    .select('id, owner_id')
    .eq('id', albumId)
    .maybeSingle();

  if (albumRes.error) return false;
  const album = albumRes.data as AlbumRow | null;
  if (!album) return false;
  if (album.owner_id === userId) return true;

  // cek collaborator
  const collabRes = await supabase
    .from('album_collaborators')
    .select('id')
    .eq('album_id', albumId)
    .eq('user_id', userId)
    .maybeSingle();

  if (collabRes.error) return false;
  return !!collabRes.data;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();

  // auth user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { albumId, name, author, stickerIds } = (body as any) ?? {};
  if (!albumId || !name) {
    return NextResponse.json({ error: 'albumId dan name wajib diisi' }, { status: 400 });
  }

  // izin
  const allowed = await canWriteAlbum(user.id, String(albumId));
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // buat slug unik sederhana: slug-nama + 6 char acak
  const baseSlug = slugify(String(name));
  const suffix = Math.random().toString(36).slice(2, 8);
  const slug = `${baseSlug}-${suffix}`;

  // insert pack
  const packRes = await supabase
    .from('packs')
    .insert({
      album_id: String(albumId),
      name: String(name),
      author: author ? String(author) : null,
      slug,
      is_public: false,
    })
    .select('id, exported_zip_url')
    .maybeSingle();

  if (packRes.error) {
    return NextResponse.json({ error: packRes.error.message }, { status: 400 });
  }

  const pack = packRes.data as PackRow | null;
  if (!pack) {
    return NextResponse.json({ error: 'Failed to create pack' }, { status: 500 });
  }

  // (opsional) simpan relasi stickerIds -> pack_items jika tabel ada
  if (Array.isArray(stickerIds) && stickerIds.length > 0) {
    await supabase
      .from('pack_items')
      .insert(
        (stickerIds as string[]).map((sid, i) => ({
          pack_id: pack.id,
          sticker_id: sid,
          order_index: i,
        }))
      )
      .select()
      .maybeSingle()
      .catch(() => {
        // biarkan silent; jangan gagalkan request kalau tabel ini belum ada
      });
  }

  // TODO: proses generate ZIP di background dan update kolom exported_zip_url
  // Untuk sekarang, kembalikan nilai yang ada (mungkin null)
  return NextResponse.json({
    id: pack.id,
    exported_zip_url: pack.exported_zip_url ?? null,
  });
}
