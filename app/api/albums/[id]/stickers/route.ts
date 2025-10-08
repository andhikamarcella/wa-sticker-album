// app/api/albums/[id]/stickers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

type AlbumRow = { id: string; owner_id: string };
type CollaboratorRow = { id: string };

async function canWriteAlbum(userId: string, albumId: string) {
  const supabase = getSupabaseServerClient();

  // Ambil owner album dengan maybeSingle, lalu cek null/error
  const albumRes = await supabase
    .from('albums')
    .select('id, owner_id')
    .eq('id', albumId)
    .maybeSingle();

  if (albumRes.error) return false;
  const album = albumRes.data as AlbumRow | null;
  if (!album) return false;
  if (album.owner_id === userId) return true;

  // Cek kolaborator
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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const albumId = params.id;
  const allowed = await canWriteAlbum(user.id, albumId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // TODO: ambil payload dan buat sticker di sini
  const payload = await req.json();
  // contoh respons sementara
  return NextResponse.json({ ok: true, received: payload });
}
