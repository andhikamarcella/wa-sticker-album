import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getServerClient, type SupabaseServerClient } from '@/lib/supabaseServer';
import { isSupabaseConfigured } from '@/lib/env';
import {
  mockAddStickers,
  mockDeleteStickers,
  mockGetAlbum,
  mockListStickers,
  mockReorderStickers,
  type MockSticker,
} from '@/lib/mockDb';
import { SupabaseSchemaMissingError, shouldUseMockFromSupabaseError } from '@/lib/utils';

const ACCEPTED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const reorderSchema = z.object({
  orders: z
    .array(
      z.object({
        id: z.string().uuid('Sticker id tidak valid'),
        sort_index: z.number().int().min(0, 'Index harus positif'),
      }),
    )
    .min(1, 'Minimal satu sticker untuk diurutkan'),
});

const deleteSchema = z.object({
  ids: z.array(z.string().uuid('Sticker id tidak valid')).min(1, 'Minimal satu sticker untuk dihapus'),
});

type AlbumRow = { id: string; owner_id: string };
type StickerRow = {
  id: string;
  file_url: string;
  thumb_url: string | null;
  title: string | null;
  size_kb: number | null;
  sort_index: number;
  created_at: string | null;
};

function mapMockStickerToRow(sticker: MockSticker): StickerRow {
  return {
    id: sticker.id,
    file_url: sticker.fileUrl,
    thumb_url: sticker.thumbUrl,
    title: sticker.title,
    size_kb: sticker.sizeKb,
    sort_index: sticker.sortIndex,
    created_at: sticker.createdAt,
  };
}

function mapMockStickersToRows(albumId: string): StickerRow[] {
  return mockListStickers(albumId).map(mapMockStickerToRow);
}

async function fetchAlbum(supabase: SupabaseServerClient, albumId: string): Promise<AlbumRow | null> {
  const { data, error } = await (supabase.from('albums') as any)
    .select('id, owner_id')
    .eq('id', albumId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    if (shouldUseMockFromSupabaseError(error)) {
      throw new SupabaseSchemaMissingError(error.message);
    }
    throw error;
  }
  return (data as AlbumRow | null) ?? null;
}

async function canWriteAlbum(supabase: SupabaseServerClient, userId: string, albumId: string): Promise<boolean> {
  const album = await fetchAlbum(supabase, albumId);
  if (!album) return false;
  if (album.owner_id === userId) return true;

  const { data, error } = await (supabase.from('album_collaborators') as any)
    .select('id')
    .eq('album_id', albumId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return false;
    if (shouldUseMockFromSupabaseError(error)) {
      throw new SupabaseSchemaMissingError(error.message);
    }
    throw error;
  }
  return Boolean(data);
}

function getExtension(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/jpeg') return 'jpg';
  const nameParts = file.name.split('.');
  return nameParts.length > 1 ? nameParts.pop()!.toLowerCase() : 'png';
}

async function touchAlbum(supabase: SupabaseServerClient, albumId: string) {
  const { error } = await (supabase.from('albums') as any)
    .update({ updated_at: new Date().toISOString() })
    .eq('id', albumId);
  if (error && error.code !== 'PGRST116') {
    if (shouldUseMockFromSupabaseError(error)) {
      throw new SupabaseSchemaMissingError(error.message);
    }
    throw error;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const albumId = params.id;

  if (!isSupabaseConfigured()) {
    const album = mockGetAlbum(albumId);
    if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 });

    const stickers = mockListStickers(albumId).map<StickerRow>((s) => ({
      id: s.id,
      file_url: s.fileUrl,
      thumb_url: s.thumbUrl,
      title: s.title,
      size_kb: s.sizeKb,
      sort_index: s.sortIndex,
      created_at: s.createdAt,
    }));

    return NextResponse.json<{ data: StickerRow[] }>({ data: stickers });
  }

  try {
    const supabase = getServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const album = await fetchAlbum(supabase, albumId);
    if (!album) return NextResponse.json({ error: 'Album tidak ditemukan' }, { status: 404 });

    const { data, error } = await (supabase.from('stickers') as any)
      .select('id, file_url, thumb_url, title, size_kb, sort_index, created_at')
      .eq('album_id', albumId)
      .order('sort_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      if (shouldUseMockFromSupabaseError(error)) {
        throw new SupabaseSchemaMissingError(error.message);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json<{ data: StickerRow[] }>({ data: (data as StickerRow[]) ?? [] });
  } catch (error) {
    if (error instanceof SupabaseSchemaMissingError || shouldUseMockFromSupabaseError(error)) {
      const album = mockGetAlbum(albumId);
      if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 });

      return NextResponse.json<{ data: StickerRow[] }>({ data: mapMockStickersToRows(albumId) });
    }

    console.error('Failed to fetch stickers', error);
    return NextResponse.json({ error: 'Failed to load stickers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const albumId = params.id;

  if (!isSupabaseConfigured()) {
    return handleMockUpload(req, albumId);
  }

  try {
    const supabase = getServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const writable = await canWriteAlbum(supabase, user.id, albumId);
    if (!writable) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await req.formData();
    const files = formData.getAll('files').filter((v): v is File => v instanceof File && v.size > 0);
    if (files.length === 0) return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 });

    for (const file of files) {
      if (!ACCEPTED_MIME_TYPES.has(file.type))
        return NextResponse.json({ error: `Tipe file tidak didukung: ${file.type}` }, { status: 400 });
      if (file.size > MAX_FILE_SIZE_BYTES)
        return NextResponse.json({ error: `${file.name} melebihi batas ukuran 2MB` }, { status: 400 });
    }

    const { data: maxSortRow, error: maxSortError } = await (supabase.from('stickers') as any)
      .select('sort_index')
      .eq('album_id', albumId)
      .order('sort_index', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxSortError && maxSortError.code !== 'PGRST116') {
      if (shouldUseMockFromSupabaseError(maxSortError)) {
        throw new SupabaseSchemaMissingError(maxSortError.message);
      }
      return NextResponse.json({ error: maxSortError.message }, { status: 500 });
    }

    let lastSortIndex = (maxSortRow as { sort_index: number } | null)?.sort_index ?? -1;
    const insertPayload: Array<{
      album_id: string;
      owner_id: string;
      file_url: string;
      thumb_url: string | null;
      title: string | null;
      size_kb: number | null;
      sort_index: number;
    }> = [];

    for (const file of files) {
      const extension = getExtension(file);
      const path = `${albumId}/${user.id}/${randomUUID()}.${extension}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage.from('stickers').upload(path, buffer, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

      const { data: publicUrlData } = supabase.storage.from('stickers').getPublicUrl(path);
      const publicUrl = publicUrlData.publicUrl;

      lastSortIndex += 1;
      insertPayload.push({
        album_id: albumId,
        owner_id: user.id,
        file_url: publicUrl,
        thumb_url: publicUrl,
        title: file.name.replace(/\.[^/.]+$/, '') || null,
        size_kb: Math.max(1, Math.round(file.size / 1024)),
        sort_index: lastSortIndex,
      });
    }

    const { data: inserted, error: insertError } = await (supabase.from('stickers') as any)
      .insert(insertPayload)
      .select('id, file_url, thumb_url, title, size_kb, sort_index, created_at');
    if (insertError) {
      if (shouldUseMockFromSupabaseError(insertError)) {
        throw new SupabaseSchemaMissingError(insertError.message);
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await touchAlbum(supabase, albumId);
    return NextResponse.json({ data: inserted ?? [] });
  } catch (error) {
    if (error instanceof SupabaseSchemaMissingError || shouldUseMockFromSupabaseError(error)) {
      return handleMockUpload(req, albumId);
    }

    console.error('Failed to upload stickers', error);
    return NextResponse.json({ error: 'Failed to upload stickers' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const albumId = params.id;

  const body = await req.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return handleMockReorder(albumId, parsed.data.orders);
  }

  try {
    const supabase = getServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const writable = await canWriteAlbum(supabase, user.id, albumId);
    if (!writable) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    for (const order of parsed.data.orders) {
      const { error } = await (supabase.from('stickers') as any)
        .update({ sort_index: order.sort_index })
        .eq('id', order.id)
        .eq('album_id', albumId);
      if (error) {
        if (shouldUseMockFromSupabaseError(error)) {
          throw new SupabaseSchemaMissingError(error.message);
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    await touchAlbum(supabase, albumId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SupabaseSchemaMissingError || shouldUseMockFromSupabaseError(error)) {
      return handleMockReorder(albumId, parsed.data.orders);
    }

    console.error('Failed to reorder stickers', error);
    return NextResponse.json({ error: 'Failed to reorder stickers' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const albumId = params.id;

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return handleMockDelete(albumId, parsed.data.ids);
  }

  try {
    const supabase = getServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const writable = await canWriteAlbum(supabase, user.id, albumId);
    if (!writable) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await (supabase.from('stickers') as any).delete().eq('album_id', albumId).in('id', parsed.data.ids);
    if (error) {
      if (shouldUseMockFromSupabaseError(error)) {
        throw new SupabaseSchemaMissingError(error.message);
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await touchAlbum(supabase, albumId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SupabaseSchemaMissingError || shouldUseMockFromSupabaseError(error)) {
      return handleMockDelete(albumId, parsed.data.ids);
    }

    console.error('Failed to delete stickers', error);
    return NextResponse.json({ error: 'Failed to delete stickers' }, { status: 500 });
  }
}

async function handleMockUpload(req: NextRequest, albumId: string) {
  const album = mockGetAlbum(albumId);
  if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll('files').filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length === 0) return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 });

  for (const file of files) {
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Tipe file tidak didukung: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: `${file.name} melebihi batas ukuran 2MB` }, { status: 400 });
    }
  }

  const entries = await Promise.all(
    files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${file.type || 'image/png'};base64,${base64}`;
      return {
        fileUrl: dataUrl,
        thumbUrl: dataUrl,
        title: file.name.replace(/\.[^/.]+$/, '') || null,
        sizeKb: Math.max(1, Math.round(buffer.length / 1024)),
      };
    }),
  );

  const inserted = mockAddStickers(albumId, album.ownerId, entries).map(mapMockStickerToRow);
  return NextResponse.json({ data: inserted });
}

function handleMockReorder(albumId: string, orders: Array<{ id: string; sort_index: number }>) {
  const album = mockGetAlbum(albumId);
  if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 });
  mockReorderStickers(albumId, orders);
  return NextResponse.json({ ok: true });
}

function handleMockDelete(albumId: string, ids: string[]) {
  const album = mockGetAlbum(albumId);
  if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 });
  mockDeleteStickers(albumId, ids);
  return NextResponse.json({ ok: true });
}
