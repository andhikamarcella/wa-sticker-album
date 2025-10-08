import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { packCreateSchema } from '@/lib/zod-schemas';
import { buildPackZip } from '@/lib/zip';
import { supabaseAdmin } from '@/lib/db';

const PACK_BUCKET = 'packs';

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

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const body = await request.json();
  const parsed = packCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const allowed = await ensureAccess(parsed.data.albumId, user.id, supabase);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: stickers, error: stickerError } = await supabase
    .from('stickers')
    .select('id,title,file_url')
    .in('id', parsed.data.stickerIds);
  if (stickerError) {
    return NextResponse.json({ error: stickerError.message }, { status: 500 });
  }

  const { data: pack, error: packError } = await supabase
    .from('packs')
    .insert({
      album_id: parsed.data.albumId,
      name: parsed.data.name,
      author: parsed.data.author ?? null
    })
    .select()
    .single();
  if (packError || !pack) {
    return NextResponse.json({ error: packError?.message ?? 'Gagal membuat pack' }, { status: 500 });
  }

  await supabase
    .from('pack_items')
    .insert(
      parsed.data.stickerIds.map((id, index) => ({
        pack_id: pack.id,
        sticker_id: id,
        order_index: index
      }))
    );

  const zipBuffer = await buildPackZip({
    stickers: (stickers ?? []).sort(
      (a, b) => parsed.data.stickerIds.indexOf(a.id) - parsed.data.stickerIds.indexOf(b.id)
    ),
    packName: parsed.data.name,
    author: parsed.data.author
  });

  const filePath = `packs/${pack.id}_${Date.now()}.zip`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(PACK_BUCKET)
    .upload(filePath, zipBuffer, { contentType: 'application/zip', upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const publicUrl = supabaseAdmin.storage.from(PACK_BUCKET).getPublicUrl(filePath).data.publicUrl;
  const { data: updatedPack, error: updateError } = await supabase
    .from('packs')
    .update({ exported_zip_url: publicUrl })
    .eq('id', pack.id)
    .select()
    .single();
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updatedPack, { status: 201 });
}
