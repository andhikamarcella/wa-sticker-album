import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { isSupabaseConfigured } from '@/lib/env';
import {
  mockCreateAlbum,
  mockListAlbumsByOwner,
  mockListAlbumsSharedWith,
  mockListStickers,
  type MockAlbum,
} from '@/lib/mockDb';
import { getServerClient } from '@/lib/supabaseServer';
import { slugify } from '@/lib/slug';
import { SupabaseSchemaMissingError, shouldUseMockFromSupabaseError } from '@/lib/utils';

const DEFAULT_SCOPE = 'all' as const;
const MOCK_OWNER_ID = 'local-user';

const scopeSchema = z.enum(['all', 'owned', 'shared']);
const visibilitySchema = z.enum(['public', 'unlisted', 'private']);
const createAlbumSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  visibility: visibilitySchema.optional(),
});

type AlbumVisibility = z.infer<typeof visibilitySchema>;

type AlbumRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  visibility: AlbumVisibility;
  created_at: string | null;
  updated_at: string | null;
};

type AlbumListItem = {
  id: string;
  name: string;
  slug: string;
  visibility: AlbumVisibility;
  updatedAt: string;
  stickersCount: number;
  thumbnails: string[];
};

type AlbumStatsResult =
  | { ok: true; thumbnails: string[]; count: number }
  | { ok: false; error: string };

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const scopeParam = url.searchParams.get('scope');
  const searchQuery = url.searchParams.get('q')?.trim() ?? '';
  const scopeResult = scopeSchema.safeParse(scopeParam ?? undefined);
  const scope = scopeResult.success ? scopeResult.data : DEFAULT_SCOPE;

  if (!isSupabaseConfigured()) {
    return NextResponse.json<{ data: AlbumListItem[] }>({ data: buildMockAlbumItems(scope, searchQuery) });
  }

  try {
    const supabase = getServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.warn('Falling back to mock albums (auth)', userError.message);
      return NextResponse.json<{ data: AlbumListItem[] }>({ data: buildMockAlbumItems(scope, searchQuery) });
    }

    if (!user) {
      return NextResponse.json<{ data: AlbumListItem[] }>({ data: [] });
    }

    const [ownedResult, sharedResult] = await Promise.all([
      fetchOwnedAlbums(supabase, user.id, searchQuery),
      fetchSharedAlbums(supabase, user.id, searchQuery),
    ]);

    if (!ownedResult.ok) {
      console.warn('Falling back to mock albums (owned)', ownedResult.error);
      return NextResponse.json<{ data: AlbumListItem[] }>({ data: buildMockAlbumItems(scope, searchQuery) });
    }

    if (!sharedResult.ok) {
      console.warn('Falling back to mock albums (shared)', sharedResult.error);
      return NextResponse.json<{ data: AlbumListItem[] }>({ data: buildMockAlbumItems(scope, searchQuery) });
    }

    const selected = selectAlbums(scope, ownedResult.albums, sharedResult.albums);
    const stats = await Promise.all(selected.map((album) => fetchAlbumStats(supabase, album.id)));

    const items: AlbumListItem[] = selected.map((album, index) => {
      const stat = stats[index];
      const fallbackUpdatedAt = album.updated_at ?? album.created_at ?? new Date().toISOString();

      if (!stat.ok) {
        return {
          id: album.id,
          name: album.name,
          slug: album.slug,
          visibility: album.visibility,
          updatedAt: fallbackUpdatedAt,
          stickersCount: 0,
          thumbnails: [],
        };
      }

      return {
        id: album.id,
        name: album.name,
        slug: album.slug,
        visibility: album.visibility,
        updatedAt: fallbackUpdatedAt,
        stickersCount: stat.count,
        thumbnails: stat.thumbnails,
      };
    });

    items.sort(sortByUpdatedAtDesc);

    return NextResponse.json<{ data: AlbumListItem[] }>({ data: items });
  } catch (error) {
    const fallback = buildMockAlbumItems(scope, searchQuery);

    if (error instanceof SupabaseSchemaMissingError || shouldUseMockFromSupabaseError(error)) {
      return NextResponse.json<{ data: AlbumListItem[] }>({ data: fallback });
    }

    console.error('Failed to list albums', error);
    return NextResponse.json<{ data: AlbumListItem[]; warning?: string }>(
      {
        data: fallback,
        warning: 'Album list served from mock data due to server error.',
      },
      { status: 200 },
    );
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = createAlbumSchema.safeParse(payload ?? {});

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const visibility = parsed.data.visibility ?? 'private';
  const name = parsed.data.name;

  if (!isSupabaseConfigured()) {
    const album = mockCreateAlbum(MOCK_OWNER_ID, name, visibility);
    return NextResponse.json({
      id: album.id,
      name: album.name,
      slug: album.slug,
      visibility: album.visibility,
      updatedAt: album.updatedAt,
    });
  }

  try {
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

    const slugBase = slugify(name) || `album-${Math.random().toString(36).slice(2, 8)}`;
    const slug = await generateUniqueSlug(supabase, slugBase);

    const insertResult = await insertAlbum(supabase, {
      owner_id: user.id,
      name,
      visibility,
      slug,
    });

    return NextResponse.json({
      id: insertResult.id,
      name: insertResult.name,
      slug: insertResult.slug,
      visibility: insertResult.visibility,
      updatedAt: insertResult.updated_at ?? insertResult.created_at ?? new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof SupabaseSchemaMissingError || shouldUseMockFromSupabaseError(error)) {
      const album = mockCreateAlbum(MOCK_OWNER_ID, name, visibility);
      return NextResponse.json({
        id: album.id,
        name: album.name,
        slug: album.slug,
        visibility: album.visibility,
        updatedAt: album.updatedAt,
      });
    }

    console.error('Failed to create album', error);
    return NextResponse.json({ error: 'Failed to create album' }, { status: 500 });
  }
}

function buildMockAlbumItems(scope: typeof DEFAULT_SCOPE | 'owned' | 'shared', searchQuery: string): AlbumListItem[] {
  const owned = mockListAlbumsByOwner(MOCK_OWNER_ID);
  const shared = mockListAlbumsSharedWith(MOCK_OWNER_ID);
  const selected = selectMockAlbums(scope, owned, shared);
  const filtered = filterMockAlbums(selected, searchQuery);
  return filtered.map(mapMockAlbumToListItem).sort(sortByUpdatedAtDesc);
}

function selectMockAlbums(scope: string, owned: MockAlbum[], shared: MockAlbum[]): MockAlbum[] {
  if (scope === 'owned') return owned;
  if (scope === 'shared') return shared;
  const merged = new Map<string, MockAlbum>();
  for (const album of owned) merged.set(album.id, album);
  for (const album of shared) merged.set(album.id, album);
  return Array.from(merged.values());
}

function filterMockAlbums(albums: MockAlbum[], search: string): MockAlbum[] {
  if (!search) return albums;
  const normalized = search.toLowerCase();
  return albums.filter((album) => album.name.toLowerCase().includes(normalized));
}

function mapMockAlbumToListItem(album: MockAlbum): AlbumListItem {
  const stickers = mockListStickers(album.id);
  const thumbnails = stickers
    .slice(0, 6)
    .map((sticker) => sticker.thumbUrl || sticker.fileUrl)
    .filter((url): url is string => Boolean(url));

  return {
    id: album.id,
    name: album.name,
    slug: album.slug,
    visibility: album.visibility,
    updatedAt: album.updatedAt,
    stickersCount: stickers.length,
    thumbnails,
  };
}

function sortByUpdatedAtDesc(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function selectAlbums(scope: string, owned: AlbumRow[], shared: AlbumRow[]): AlbumRow[] {
  if (scope === 'owned') return owned;
  if (scope === 'shared') return shared;
  const merged = new Map<string, AlbumRow>();
  for (const album of owned) merged.set(album.id, album);
  for (const album of shared) merged.set(album.id, album);
  return Array.from(merged.values());
}

async function fetchOwnedAlbums(client: SupabaseClient<any>, ownerId: string, search: string) {
  let query = client
    .from('albums')
    .select('id, owner_id, name, slug, visibility, created_at, updated_at')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    if (shouldUseMockFromSupabaseError(error)) {
      throw new SupabaseSchemaMissingError(error.message);
    }
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, albums: (data as AlbumRow[] | null) ?? [] };
}

async function fetchSharedAlbums(client: SupabaseClient<any>, userId: string, search: string) {
  let query = client
    .from('album_collaborators')
    .select('albums!inner(id, owner_id, name, slug, visibility, created_at, updated_at)')
    .eq('user_id', userId);

  if (search) {
    query = query.ilike('albums.name', `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    if (shouldUseMockFromSupabaseError(error)) {
      throw new SupabaseSchemaMissingError(error.message);
    }
    return { ok: false as const, error: error.message };
  }

  const albums = new Map<string, AlbumRow>();
  const rows = ((data ?? []) as unknown) as Array<{ albums: AlbumRow | null }>;
  for (const row of rows) {
    if (row.albums) {
      albums.set(row.albums.id, row.albums);
    }
  }

  return { ok: true as const, albums: Array.from(albums.values()) };
}

async function fetchAlbumStats(client: SupabaseClient<any>, albumId: string): Promise<AlbumStatsResult> {
  const { data: thumbnailsData, error: thumbnailsError } = await client
    .from('stickers')
    .select('thumb_url, file_url')
    .eq('album_id', albumId)
    .order('sort_index', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(6);

  if (thumbnailsError) {
    if (shouldUseMockFromSupabaseError(thumbnailsError)) {
      throw new SupabaseSchemaMissingError(thumbnailsError.message);
    }
    return { ok: false, error: thumbnailsError.message };
  }

  const { count, error: countError } = await client
    .from('stickers')
    .select('id', { count: 'exact', head: true })
    .eq('album_id', albumId);

  if (countError) {
    if (shouldUseMockFromSupabaseError(countError)) {
      throw new SupabaseSchemaMissingError(countError.message);
    }
    return { ok: false, error: countError.message };
  }

  const thumbnails = (thumbnailsData as Array<{ thumb_url: string | null; file_url: string | null }> | null) ?? [];
  const sources = thumbnails
    .map((item) => item.thumb_url || item.file_url)
    .filter((url): url is string => Boolean(url));

  return {
    ok: true,
    thumbnails: sources,
    count: typeof count === 'number' ? count : sources.length,
  };
}

async function generateUniqueSlug(client: SupabaseClient<any>, base: string) {
  const normalizedBase = base.length > 0 ? base : 'album';
  let candidate = normalizedBase;
  let suffix = 1;

  while (true) {
    const { data, error } = await client
      .from('albums')
      .select('id')
      .eq('slug', candidate)
      .limit(1);

    if (error) {
      if (shouldUseMockFromSupabaseError(error)) {
        throw new SupabaseSchemaMissingError(error.message);
      }
      throw new Error(error.message);
    }

    const rows = (data as Array<{ id: string }> | null) ?? [];
    if (rows.length === 0) {
      return candidate;
    }

    candidate = `${normalizedBase}-${suffix++}`;
  }
}

async function insertAlbum(
  client: SupabaseClient<any>,
  payload: { owner_id: string; name: string; visibility: AlbumVisibility; slug: string },
): Promise<AlbumRow> {
  const now = new Date().toISOString();
  const { data, error, status } = await client
    .from('albums')
    .insert({
      owner_id: payload.owner_id,
      name: payload.name,
      visibility: payload.visibility,
      slug: payload.slug,
      updated_at: now,
    })
    .select('id, owner_id, name, slug, visibility, created_at, updated_at')
    .single();

  if (error) {
    if (shouldUseMockFromSupabaseError(error)) {
      throw new SupabaseSchemaMissingError(error.message);
    }
    const enrichedError = new Error(error.message);
    (enrichedError as Error & { status?: number }).status = status;
    throw enrichedError;
  }

  if (!data) {
    throw new Error('Failed to create album');
  }

  return data as AlbumRow;
}
