import { NextRequest, NextResponse } from 'next/server';

import { getServerClient, type SupabaseServerClient } from '@/lib/supabaseServer';

type PackRow = {
  id: string;
  album_id: string;
  owner_id: string;
  public_url: string | null;
  wa_share_url: string | null;
};

type AlbumRow = {
  id: string;
  slug: string;
  owner_id: string;
};

async function fetchPack(
  supabase: SupabaseServerClient,
  packId: string,
): Promise<PackRow | null> {
  const { data, error } = await (supabase.from('packs') as any)
    .select('id, album_id, owner_id, public_url, wa_share_url')
    .eq('id', packId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return (data as PackRow | null) ?? null;
}

async function fetchAlbum(
  supabase: SupabaseServerClient,
  albumId: string,
): Promise<AlbumRow | null> {
  const { data, error } = await (supabase.from('albums') as any)
    .select('id, slug, owner_id')
    .eq('id', albumId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return (data as AlbumRow | null) ?? null;
}

async function canWriteAlbum(
  supabase: SupabaseServerClient,
  userId: string,
  albumId: string,
): Promise<boolean> {
  const album = await fetchAlbum(supabase, albumId);
  if (!album) {
    return false;
  }

  if (album.owner_id === userId) {
    return true;
  }

  const { data, error } = await (supabase.from('album_collaborators') as any)
    .select('id')
    .eq('album_id', albumId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      return false;
    }
    throw error;
  }

  return Boolean(data);
}

async function touchAlbum(supabase: SupabaseServerClient, albumId: string) {
  await (supabase.from('albums') as any)
    .update({ updated_at: new Date().toISOString() })
    .eq('id', albumId);
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pack = await fetchPack(supabase, params.id);
  if (!pack) {
    return NextResponse.json({ error: 'Pack tidak ditemukan' }, { status: 404 });
  }

  const album = await fetchAlbum(supabase, pack.album_id);
  if (!album) {
    return NextResponse.json({ error: 'Album tidak ditemukan' }, { status: 404 });
  }

  const allowed = await canWriteAlbum(supabase, user.id, album.id);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const publicUrl = `${baseUrl}/p/${album.slug}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(publicUrl)}`;

  const { data: updated, error: updateError } = await (supabase.from('packs') as any)
    .update({ public_url: publicUrl, wa_share_url: waUrl })
    .eq('id', pack.id)
    .select('public_url, wa_share_url')
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Gagal memperbarui pack' },
      { status: 500 },
    );
  }

  await touchAlbum(supabase, album.id);

  return NextResponse.json({
    publicUrl: (updated as { public_url: string }).public_url,
    waUrl: (updated as { wa_share_url: string }).wa_share_url,
  });
}
