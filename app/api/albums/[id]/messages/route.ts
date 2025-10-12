import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { z } from 'zod';

import { isSupabaseConfigured } from '@/lib/env';
import { mockCreateMessage, mockGetAlbum, mockListMessages, type MockMessage } from '@/lib/mockDb';
import { getServerClient, type SupabaseServerClient } from '@/lib/supabaseServer';
import { SupabaseSchemaMissingError, shouldUseMockFromSupabaseError } from '@/lib/utils';

const MOCK_USER_ID = 'local-user';
const DEFAULT_DISPLAY_NAME = 'Sticker Fan';
const MAX_LIMIT = 200;

const createMessageSchema = z.object({
  body: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(500, 'Pesan terlalu panjang'),
});

const messageSelect = 'id, album_id, user_id, display_name, body, created_at';

type MessageRow = {
  id: string;
  album_id: string;
  user_id: string;
  display_name: string | null;
  body: string;
  created_at: string | null;
};

type AlbumRow = { id: string; owner_id: string };

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const albumId = params.id;
  const limit = parseLimit(request);

  if (!isSupabaseConfigured()) {
    const album = mockGetAlbum(albumId);
    if (!album) return NextResponse.json({ error: 'Album tidak ditemukan' }, { status: 404 });
    const messages = mockListMessages(albumId, limit);
    return NextResponse.json({ data: messages.map(mapMockMessageToResponse) });
  }

  try {
    const supabase = getServerClient();
    const { data, error } = await (supabase.from('messages') as any)
      .select(messageSelect)
      .eq('album_id', albumId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      if (shouldUseMockFromSupabaseError(error)) throw new SupabaseSchemaMissingError(error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: (data as MessageRow[] | null) ?? [] });
  } catch (error) {
    if (error instanceof SupabaseSchemaMissingError || shouldUseMockFromSupabaseError(error)) {
      const album = mockGetAlbum(albumId);
      if (!album) return NextResponse.json({ error: 'Album tidak ditemukan' }, { status: 404 });
      const messages = mockListMessages(albumId, limit);
      return NextResponse.json({ data: messages.map(mapMockMessageToResponse) });
    }
    console.error('Failed to load messages', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const albumId = params.id;
  const payload = await request.json().catch(() => null);
  const parsed = createMessageSchema.safeParse(payload ?? {});
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const body = parsed.data.body.trim();
  const headerDisplayName = resolveHeaderDisplayName(request.headers);

  if (!isSupabaseConfigured()) {
    const album = mockGetAlbum(albumId);
    if (!album) return NextResponse.json({ error: 'Album tidak ditemukan' }, { status: 404 });
    const message = mockCreateMessage({
      albumId,
      userId: MOCK_USER_ID,
      displayName: headerDisplayName ?? DEFAULT_DISPLAY_NAME,
      body,
    });
    return NextResponse.json(mapMockMessageToResponse(message));
  }

  try {
    const supabase = getServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const allowed = await canWriteAlbum(supabase, user.id, albumId);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const displayName = headerDisplayName ?? deriveDisplayName(user);
    const { data, error } = await (supabase.from('messages') as any)
      .insert({ album_id: albumId, user_id: user.id, display_name: displayName, body })
      .select(messageSelect)
      .maybeSingle();

    if (error || !data) {
      if (error && shouldUseMockFromSupabaseError(error)) throw new SupabaseSchemaMissingError(error.message);
      return NextResponse.json({ error: error?.message ?? 'Gagal mengirim pesan' }, { status: 500 });
    }

    return NextResponse.json(data as MessageRow);
  } catch (error) {
    if (error instanceof SupabaseSchemaMissingError || shouldUseMockFromSupabaseError(error)) {
      const album = mockGetAlbum(albumId);
      if (!album) return NextResponse.json({ error: 'Album tidak ditemukan' }, { status: 404 });
      const message = mockCreateMessage({
        albumId,
        userId: MOCK_USER_ID,
        displayName: headerDisplayName ?? DEFAULT_DISPLAY_NAME,
        body,
      });
      return NextResponse.json(mapMockMessageToResponse(message));
    }
    console.error('Failed to post message', error);
    return NextResponse.json({ error: 'Gagal mengirim pesan' }, { status: 500 });
  }
}

function parseLimit(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get('limit');
  if (!raw) return MAX_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return MAX_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

function resolveHeaderDisplayName(headers: Headers): string | null {
  const value = headers.get('x-profile-name') ?? headers.get('X-Profile-Name');
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function deriveDisplayName(user: User): string {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fromMetadata = [meta.display_name, meta.full_name, meta.name]
    .find((x) => typeof x === 'string' && x.trim().length > 0) as string | undefined;
  if (fromMetadata) return fromMetadata.trim();
  const fromEmail = user.email?.split('@')[0];
  if (fromEmail && fromEmail.length > 0) return fromEmail;
  return DEFAULT_DISPLAY_NAME;
}

async function fetchAlbum(supabase: SupabaseServerClient, albumId: string): Promise<AlbumRow | null> {
  const { data, error } = await (supabase.from('albums') as any)
    .select('id, owner_id')
    .eq('id', albumId)
    .maybeSingle();
  if (error) {
    if (error.code === 'PGRST116') return null;
    if (shouldUseMockFromSupabaseError(error)) throw new SupabaseSchemaMissingError(error.message);
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
    if (shouldUseMockFromSupabaseError(error)) throw new SupabaseSchemaMissingError(error.message);
    throw error;
  }
  return Boolean(data);
}

function mapMockMessageToResponse(message: MockMessage) {
  return {
    id: message.id,
    album_id: message.albumId,
    user_id: message.userId,
    display_name: message.displayName,
    body: message.body,
    created_at: message.createdAt,
  } satisfies MessageRow;
}
