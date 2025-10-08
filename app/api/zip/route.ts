import { NextResponse } from 'next/server';
import { zipRequestSchema } from '@/lib/zod-schemas';
import { supabaseAdmin } from '@/lib/db';
import { buildPackZip } from '@/lib/zip';

const PACK_BUCKET = 'packs';

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = zipRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { stickerIds, packName, author } = parsed.data;
  const { data: stickers, error } = await supabaseAdmin
    .from('stickers')
    .select('id,title,file_url')
    .in('id', stickerIds);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const zipBuffer = await buildPackZip({ stickers: stickers ?? [], packName, author });
  const filePath = `packs/${packName.replace(/\s+/g, '_')}_${Date.now()}.zip`;
  const { error: uploadError } = await supabaseAdmin.storage.from(PACK_BUCKET).upload(filePath, zipBuffer, {
    contentType: 'application/zip',
    upsert: false
  });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const url = supabaseAdmin.storage.from(PACK_BUCKET).getPublicUrl(filePath).data.publicUrl;
  return NextResponse.json({ url });
}
