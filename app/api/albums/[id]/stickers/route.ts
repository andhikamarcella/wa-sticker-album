import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { supabaseAdmin } from '@/lib/db';
import { toSquareWebp } from '@/lib/image';

const STICKER_BUCKET = 'stickers';

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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data, error } = await supabase
    .from('stickers')
    .select('*')
    .eq('album_id', params.id)
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const body = await request.json();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const allowed = await ensureAccess(params.id, user.id, supabase);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, ...payload } = body as { id: string; title?: string; tags?: string[] };
  const { error } = await supabase
    .from('stickers')
    .update({ ...payload })
    .eq('id', id)
    .eq('album_id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const allowed = await ensureAccess(params.id, user.id, supabase);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  if (!files.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const uploads = await Promise.all(
    files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const processed = await toSquareWebp(buffer);
      const id = crypto.randomUUID();
      const ext = file.name.split('.').pop() ?? 'png';
      const originalPath = `original/${params.id}/${id}.${ext}`;
      const processedPath = `processed/${params.id}/${id}.webp`;
      const thumbPath = `thumb/${params.id}/${id}.webp`;

      const [origUpload, processedUpload, thumbUpload] = await Promise.all([
        supabaseAdmin.storage.from(STICKER_BUCKET).upload(originalPath, buffer, {
          contentType: file.type || 'image/png',
          upsert: false
        }),
        supabaseAdmin.storage.from(STICKER_BUCKET).upload(processedPath, processed.webpBuffer, {
          contentType: 'image/webp',
          upsert: false
        }),
        supabaseAdmin.storage.from(STICKER_BUCKET).upload(thumbPath, processed.thumbBuffer, {
          contentType: 'image/webp',
          upsert: false
        })
      ]);

      if (origUpload.error || processedUpload.error || thumbUpload.error) {
        throw new Error('Upload gagal');
      }

      const originalUrl = supabaseAdmin.storage.from(STICKER_BUCKET).getPublicUrl(originalPath).data.publicUrl;
      const processedUrl = supabaseAdmin.storage.from(STICKER_BUCKET).getPublicUrl(processedPath).data.publicUrl;
      const thumbUrl = supabaseAdmin.storage.from(STICKER_BUCKET).getPublicUrl(thumbPath).data.publicUrl;

      const { data: sticker, error } = await supabase
        .from('stickers')
        .insert({
          album_id: params.id,
          orig_url: originalUrl,
          file_url: processedUrl,
          thumb_url: thumbUrl,
          width: processed.width,
          height: processed.height,
          size_kb: processed.sizeKB
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return sticker;
    })
  );

  return NextResponse.json({ data: uploads }, { status: 201 });
}
