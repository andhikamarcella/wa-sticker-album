// app/api/packs/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

type AlbumRow = { id: string; owner_id: string };
type CollaboratorRow = { id: string };
type PackRow = { id: string; album_id: string; name?: string | null; slug?: string | null };

async function canWriteAlbum(userId: string, albumId: string) {
  const supabase = getSupabaseServerClient();

  const albumRes = await supabase
    .from('albums')
    .select('id, owner_id')
    .eq('id', albumId)
    .maybeSingle();

  if (albumRes.error) return false;
  const album = albumRes.data as AlbumRow | null;
  if (!album) return false;
  if (album.owner_id === userId) return true;

  const collabRes = await supabase
    .from('album_collaborators')
    .select('id')
    .eq('album_id', albumId)
    .eq('user_id', userId)
    .maybeSingle();

  if (collabRes.error) return false;
  const collaborator = collabRes.data as CollaboratorRow | null;
  return !!collaborator;
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServerClient();

  // auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ambil pack yang mau dipublish
  const packRes = await supabase
    .from('packs')
    .select('id, album_id, name, slug')
    .eq('id', params.id)
    .maybeSingle();

  if (packRes.error) return NextResponse.json({ error: packRes.error.message }, { status: 400 });
  const pack = packRes.data as PackRow | null;
  if (!pack) return NextResponse.json({ error: 'Pack not found' }, { status: 404 });

  // cek izin: owner atau collaborator album
  const allowed = await canWriteAlbum(user.id, pack.album_id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // siapkan URL publik & link WhatsApp
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const slug = pack.slug ?? pack.id;
  const publicUrl = `${baseUrl}/packs/${slug}`;
  const message = `Cek sticker pack "${pack.name ?? 'Sticker Pack'}": ${publicUrl}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  // tandai pack sebagai publik (sesuaikan kolom tabelmu)
  await supabase
    .from('packs')
    .update({ is_public: true, public_url: publicUrl })
    .eq('id', pack.id);

  return NextResponse.json({ publicUrl, waUrl });
}
