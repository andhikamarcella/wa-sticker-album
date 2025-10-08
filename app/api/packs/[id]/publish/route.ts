import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { packPublishSchema } from '@/lib/zod-schemas';
import { buildWaMessage, buildWaUrl } from '@/lib/whatsapp';
import { makeQrPngDataUrl } from '@/lib/qr';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function ensureAccess(
  albumId: string,
  userId: string,
  supabase: SupabaseClient<Database>
) {
  const { data: album } = await supabase
    .from('albums')
    .select('id, owner_id')
    .eq('id', albumId)
    .single();
  if (!album) return false;
  if (album.owner_id === userId) return true;
  const { data: collaborator } = await supabase
    .from('album_collaborators')
    .select('id')
    .eq('album_id', albumId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(collaborator);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const body = await request.json();
  const parsed = packPublishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: pack, error } = await supabase
    .from('packs')
    .select('id, name, author, exported_zip_url, album_id, albums(slug, name, visibility)')
    .eq('id', params.id)
    .single();
  if (error || !pack) {
    return NextResponse.json({ error: error?.message ?? 'Pack tidak ditemukan' }, { status: 404 });
  }

  const allowed = await ensureAccess(pack.album_id ?? '', user.id, supabase);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (parsed.data.makePublic && pack.albums?.visibility !== 'public') {
    await supabase
      .from('albums')
      .update({ visibility: 'public' })
      .eq('id', pack.album_id ?? '');
  }

  const albumSlug = pack.albums?.slug ?? '';
  const albumName = pack.albums?.name ?? 'Album Sticker';
  const publicUrl = `${BASE_URL}/albums/${albumSlug}`;
  const message = buildWaMessage({ albumName, albumUrl: publicUrl });
  const waUrl = buildWaUrl({ message });
  const qrDataUrl = await makeQrPngDataUrl(publicUrl);

  await supabase
    .from('shares')
    .insert([
      {
        target_type: 'pack',
        target_id: pack.id,
        kind: 'public_link',
        url: publicUrl,
        qr_png_url: qrDataUrl
      },
      {
        target_type: 'pack',
        target_id: pack.id,
        kind: 'wa_link',
        url: waUrl
      }
    ]);

  return NextResponse.json({ publicUrl, waUrl, message, qrDataUrl, zipUrl: pack.exported_zip_url });
}
