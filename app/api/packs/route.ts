import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getServerClient, type SupabaseServerClient } from '@/lib/supabaseServer';
import { slugify } from '@/lib/slug';
import { isSupabaseConfigured } from '@/lib/env';
import { mockCreatePack, mockGetAlbum, mockListStickers } from '@/lib/mockDb';

const createPackSchema = z.object({
  albumId: z.string().uuid('Album id tidak valid'),
  name: z.string().trim().min(1, 'Nama pack wajib diisi').max(120, 'Nama terlalu panjang'),
  author: z
    .string()
    .trim()
    .max(120, 'Nama pembuat terlalu panjang')
    .optional(),
  stickerIds: z
    .array(z.string().uuid('Sticker id tidak valid'))
    .nonempty('Minimal satu sticker diperlukan'),
});

type AlbumRow = {
  id: string;
  owner_id: string;
};

type StickerRow = {
  id: string;
  album_id: string;
  file_url: string;
  thumb_url: string | null;
  title: string | null;
};

async function fetchAlbum(
  supabase: SupabaseServerClient,
  albumId: string,
): Promise<AlbumRow | null> {
  const { data, error } = await (supabase.from('albums') as any)
    .select('id, owner_id')
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

function extractStoragePath(publicUrl: string): string | null {
  try {
    const parsed = new URL(publicUrl);
    const marker = '/storage/v1/object/public/stickers/';
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) {
      return null;
    }
    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch (error) {
    console.error('[packs] Failed to parse sticker public url', error);
    return null;
  }
}

function resolveFileName(position: number, sticker: StickerRow, storagePath: string): string {
  const fallback = `sticker-${position + 1}`;
  const base = slugify(sticker.title ?? fallback) || fallback;
  const pathSegment = storagePath.split('/').pop() ?? `${base}.webp`;
  const extensionMatch = pathSegment.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  const extensionRaw = extensionMatch ? extensionMatch[1].toLowerCase() : 'png';
  const extension = extensionRaw === 'jpeg' ? 'jpg' : extensionRaw;
  return `${String(position + 1).padStart(2, '0')}-${base}.${extension}`;
}

async function downloadStickerBuffer(
  supabase: SupabaseServerClient,
  storagePath: string,
): Promise<Buffer> {
  const { data, error } = await supabase.storage.from('stickers').download(storagePath);
  if (error || !data) {
    throw new Error(error?.message ?? 'Gagal mengunduh file sticker');
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createPackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { albumId, name, author, stickerIds } = parsed.data;

  if (!isSupabaseConfigured()) {
    const album = mockGetAlbum(albumId);
    if (!album) {
      return NextResponse.json({ error: 'Album tidak ditemukan' }, { status: 404 });
    }

    const stickers = mockListStickers(albumId);
    if (stickers.length === 0) {
      return NextResponse.json({ error: 'Album belum memiliki sticker' }, { status: 400 });
    }

    const stickerMap = new Map(stickers.map((sticker) => [sticker.id, sticker]));
    const ordered = stickerIds.map((id) => stickerMap.get(id)).filter((value): value is typeof stickers[number] => Boolean(value));

    if (ordered.length !== stickerIds.length) {
      return NextResponse.json({ error: 'Sticker tidak ditemukan dalam album' }, { status: 400 });
    }

    const zip = new JSZip();

    for (let index = 0; index < ordered.length; index += 1) {
      const sticker = ordered[index];
      const dataUrl = sticker.fileUrl;
      const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
      if (!match) {
        return NextResponse.json({ error: 'Sticker data URL tidak valid' }, { status: 400 });
      }
      const mime = match[1] || 'image/png';
      const base64 = match[2];
      const buffer = Buffer.from(base64, 'base64');
      const extension = mime.endsWith('png') ? 'png' : mime.endsWith('jpeg') ? 'jpg' : mime.endsWith('webp') ? 'webp' : 'png';
      const baseName = slugify(sticker.title ?? `sticker-${index + 1}`) || `sticker-${index + 1}`;
      const fileName = `${String(index + 1).padStart(2, '0')}-${baseName}.${extension}`;
      zip.file(fileName, buffer);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const dataUrl = `data:application/zip;base64,${zipBuffer.toString('base64')}`;
    const pack = mockCreatePack({
      albumId,
      ownerId: album.ownerId,
      name,
      author: author ?? null,
      stickerIds,
      exportedZipDataUrl: dataUrl,
    });

    return NextResponse.json({ id: pack.id, exported_zip_url: pack.exportedZipDataUrl });
  }

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

  const allowed = await canWriteAlbum(supabase, user.id, albumId);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: stickerRows, error: stickerError } = await (supabase.from('stickers') as any)
    .select('id, album_id, file_url, thumb_url, title')
    .in('id', stickerIds)
    .eq('album_id', albumId);

  if (stickerError) {
    return NextResponse.json({ error: stickerError.message }, { status: 500 });
  }

  const stickerMap = new Map(
    ((stickerRows as StickerRow[]) ?? []).map((sticker) => [sticker.id, sticker]),
  );

  const orderedStickers: StickerRow[] = [];
  for (const id of stickerIds) {
    const sticker = stickerMap.get(id);
    if (!sticker) {
      return NextResponse.json({ error: 'Sticker tidak ditemukan dalam album' }, { status: 400 });
    }
    orderedStickers.push(sticker);
  }

  const packId = randomUUID();
  const zip = new JSZip();

  for (let index = 0; index < orderedStickers.length; index += 1) {
    const sticker = orderedStickers[index];
    const storagePath = extractStoragePath(sticker.file_url);
    if (!storagePath) {
      return NextResponse.json({ error: 'URL sticker tidak valid' }, { status: 400 });
    }

    const buffer = await downloadStickerBuffer(supabase, storagePath);
    const fileName = resolveFileName(index, sticker, storagePath);
    zip.file(fileName, buffer);
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const objectPath = `${albumId}/${packId}.zip`;

  const { error: uploadError } = await supabase.storage.from('packs').upload(objectPath, zipBuffer, {
    cacheControl: '3600',
    contentType: 'application/zip',
    upsert: true,
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from('packs').getPublicUrl(objectPath);
  const exportedUrl = publicUrlData.publicUrl;

  const { data: insertedPack, error: insertError } = await (supabase.from('packs') as any)
    .insert({
      id: packId,
      album_id: albumId,
      owner_id: user.id,
      name,
      author: author ?? null,
      exported_zip_url: exportedUrl,
    })
    .select('id, exported_zip_url')
    .maybeSingle();

  if (insertError || !insertedPack) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Gagal menyimpan pack' },
      { status: 500 },
    );
  }

  const packStickerPayload = orderedStickers.map((sticker, index) => ({
    pack_id: packId,
    sticker_id: sticker.id,
    ord: index,
  }));

  if (packStickerPayload.length > 0) {
    const { error: packStickerError } = await (supabase.from('pack_stickers') as any).insert(
      packStickerPayload,
    );
    if (packStickerError) {
      console.error('[packs] Failed to store pack stickers', packStickerError.message);
    }
  }

  await touchAlbum(supabase, albumId);

  return NextResponse.json({
    id: insertedPack.id as string,
    exported_zip_url: (insertedPack as { exported_zip_url: string | null }).exported_zip_url ?? null,
  });
}
