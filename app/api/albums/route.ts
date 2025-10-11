import { NextRequest, NextResponse } from 'next/server';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { getServerClient, type SupabaseServerClient } from '@/lib/supabaseServer';
import { getSupabaseMissingMessage, isSupabaseConfigured } from '@/lib/env';
import { slugify } from '@/lib/slug';

const createAlbumSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  visibility: z.union([z.literal('public'), z.literal('unlisted'), z.literal('private')]).default('private').optional(),
});

const scopeSchema = z.union([z.literal('all'), z.literal('owned'), z.literal('shared')]);

type AlbumRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  visibility: 'public' | 'unlisted' | 'private';
  created_at: string | null;
  updated_at: string | null;
};

type StickerRow = {
  thumb_url: string | null;
  file_url: string | null;
};

type ListResponse = {
  data: Array<{
    id: string;
    name: string;
    slug: string;
    visibility: 'public' | 'unlisted' | 'private';
    updatedAt: string;
    stickersCount: number;
    thumbnails: string[];
  }>;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: getSupabaseMissingMessage() }, { status: 503 });
  }

  const supabase = getServerClient();
  const url = new URL(request.url);
  const scopeParam = url.searchParams.get('scope');
  const searchQuery = url.searchParams.get('q')?.trim() ?? '';
  const scopeResult = scopeSchema.safeParse(scopeParam);
  const scope = scopeResult.success ? scopeResult.data : 'all';

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json<ListResponse>({ data: [] });
  }

  const ownedAlbums = await fetchOwnedAlbums(supabase, user.id, searchQuery);
  if (ownedAlbums.error) {
    return NextResponse.json({ error: ownedAlbums.error }, { status: 500 });
  }

  const sharedAlbums = await fetchSharedAlbums(supabase, user.id, searchQuery);
  if (sharedAlbums.error) {
    return NextResponse.json({ error: sharedAlbums.error }, { status: 500 });
  }

  let albums: AlbumRow[] = [];
  if (scope === 'owned') {
    albums = ownedAlbums.albums;
  } else if (scope === 'shared') {
    albums = sharedAlbums.albums;
  } else {
    const merged = new Map<string, AlbumRow>();
    ownedAlbums.albums.forEach((album) => {
      merged.set(album.id, album);
    });
    sharedAlbums.albums.forEach((album) => {
      merged.set(album.id, album);
    });
    albums = Array.from(merged.values()).sort((a, b) => {
      const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      return bTime - aTime;
    });
  }

  const detailedAlbums = await Promise.all(
    albums.map(async (album) => {
      const stats = await fetchAlbumStats(supabase, album.id);
      if (stats.error) {
        return {
          id: album.id,
          name: album.name,
          slug: album.slug,
          visibility: album.visibility,
          updatedAt: album.updated_at ?? album.created_at ?? new Date().toISOString(),
          stickersCount: 0,
          thumbnails: [],
        };
      }

      return {
        id: album.id,
        name: album.name,
        slug: album.slug,
        visibility: album.visibility,
        updatedAt: album.updated_at ?? album.created_at ?? new Date().toISOString(),
        stickersCount: stats.count,
        thumbnails: stats.thumbnails,
      };
    }),
  );

  return NextResponse.json<ListResponse>({ data: detailedAlbums });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: getSupabaseMissingMessage() }, { status: 503 });
  }

  const supabase = getServerClient();
  const client = supabase as unknown as SupabaseClient<any>;
  const body = await request.json().catch(() => null);
  const parsed = createAlbumSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

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

  const baseSlug = slugify(parsed.data.name) || `album-${Math.random().toString(36).slice(2, 8)}`;
  const slug = await ensureUniqueSlug(client, baseSlug);

  const albumsTable = client.from('albums') as any;
  const { data, error } = (await albumsTable
    .insert([
      {
        owner_id: user.id,
        name: parsed.data.name,
        visibility: parsed.data.visibility ?? 'private',
        slug,
        updated_at: new Date().toISOString(),
      },
    ])
    .select('id, name, slug, visibility, updated_at, created_at')
    .single()) as {
    data: { id: string; name: string; slug: string; visibility: AlbumRow['visibility']; updated_at: string | null; created_at: string | null } | null;
    error: PostgrestError | null;
  };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Failed to create album' }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    slug: data.slug,
    visibility: data.visibility,
    updatedAt: data.updated_at ?? data.created_at ?? new Date().toISOString(),
  });
}

async function ensureUniqueSlug(client: SupabaseClient<any>, baseSlug: string) {
  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    const { data, error } = await client.from('albums').select('id').eq('slug', candidate).limit(1).maybeSingle();
    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }
    if (!data) {
      return candidate;
    }
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function fetchAlbumStats(client: SupabaseServerClient, albumId: string) {
  const supabase = client as unknown as SupabaseClient<any>;
  const thumbnailsResponse = (await supabase
    .from('stickers')
    .select('thumb_url, file_url')
    .eq('album_id', albumId)
    .order('sort_index', { ascending: true, nullsFirst: false })
    .limit(6)) as { data: StickerRow[] | null; error: PostgrestError | null };

  if (thumbnailsResponse.error) {
    return { error: thumbnailsResponse.error.message, thumbnails: [], count: 0 };
  }

  const countResponse = (await supabase
    .from('stickers')
    .select('id', { head: true, count: 'exact' })
    .eq('album_id', albumId)) as { error: PostgrestError | null; count: number | null };

  if (countResponse.error) {
    return { error: countResponse.error.message, thumbnails: [], count: 0 };
  }

  const thumbnails = (thumbnailsResponse.data ?? [])
    .map((item) => item.thumb_url ?? item.file_url)
    .filter((item): item is string => typeof item === 'string' && item.length > 0);

  return {
    error: null,
    thumbnails,
    count: countResponse.count ?? thumbnails.length,
  };
}

async function fetchOwnedAlbums(client: SupabaseServerClient, ownerId: string, search: string) {
  const supabase = client as unknown as SupabaseClient<any>;
  let query = supabase
    .from('albums')
    .select('id, owner_id, name, slug, visibility, created_at, updated_at')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false, nullsFirst: false });

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = (await query) as { data: AlbumRow[] | null; error: PostgrestError | null };

  if (error) {
    return { albums: [] as AlbumRow[], error: error.message };
  }

  return { albums: data ?? [], error: null };
}

async function fetchSharedAlbums(client: SupabaseServerClient, userId: string, search: string) {
  const supabase = client as unknown as SupabaseClient<any>;
  let query = supabase
    .from('albums')
    .select('id, owner_id, name, slug, visibility, created_at, updated_at, album_collaborators!inner(user_id)')
    .eq('album_collaborators.user_id', userId)
    .neq('owner_id', userId)
    .order('updated_at', { ascending: false, nullsFirst: false });

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = (await query) as {
    data: (AlbumRow & { album_collaborators: Array<{ user_id: string }> })[] | null;
    error: PostgrestError | null;
  };

  if (error) {
    return { albums: [] as AlbumRow[], error: error.message };
  }

  const albums = (data ?? []).map((album) => ({
    id: album.id,
    owner_id: album.owner_id,
    name: album.name,
    slug: album.slug,
    visibility: album.visibility,
    created_at: album.created_at,
    updated_at: album.updated_at,
  }));

  return { albums, error: null };
}
