import { NextRequest, NextResponse } from 'next/server';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { getServerClient } from '@/lib/supabaseServer';
import { getSupabaseMissingMessage, isSupabaseConfigured } from '@/lib/env';
import { slugify } from '@/lib/slug';

const updateAlbumSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long').optional(),
    visibility: z.union([z.literal('public'), z.literal('unlisted'), z.literal('private')]).optional(),
  })
  .refine((value) => value.name || value.visibility, {
    message: 'At least one field must be provided',
  });

type AlbumRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  visibility: 'public' | 'unlisted' | 'private';
  created_at: string | null;
  updated_at: string | null;
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: getSupabaseMissingMessage() }, { status: 503 });
  }

  const supabase = getServerClient();
  const client = supabase as unknown as SupabaseClient<any>;
  const body = await request.json().catch(() => ({}));
  const parsed = updateAlbumSchema.safeParse(body ?? {});

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 });
  }

  const albumId = params.id;

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

  const { data: existingAlbum, error: existingError } = (await client
    .from('albums')
    .select('id, owner_id, name, slug, visibility, created_at, updated_at')
    .eq('id', albumId)
    .maybeSingle()) as { data: AlbumRow | null; error: PostgrestError | null };

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existingAlbum) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 });
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.name) {
    updatePayload.name = parsed.data.name;
    const newSlugBase = slugify(parsed.data.name);
    if (newSlugBase.length > 0) {
      const uniqueSlug = await ensureUniqueSlug(client, newSlugBase, albumId);
      updatePayload.slug = uniqueSlug;
    }
  }

  if (parsed.data.visibility) {
    updatePayload.visibility = parsed.data.visibility;
  }

  const { data, error } = (await client
    .from('albums')
    .update(updatePayload as Record<string, unknown>)
    .eq('id', albumId)
    .select('id, name, slug, visibility, updated_at, created_at')
    .maybeSingle()) as {
    data: { id: string; name: string; slug: string; visibility: AlbumRow['visibility']; updated_at: string | null; created_at: string | null } | null;
    error: PostgrestError | null;
  };

  if (error) {
    const status = error.code === 'PGRST302' ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  if (!data) {
    return NextResponse.json({ error: 'Failed to update album' }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    slug: data.slug,
    visibility: data.visibility,
    updatedAt: data.updated_at ?? data.created_at ?? new Date().toISOString(),
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: getSupabaseMissingMessage() }, { status: 503 });
  }

  const supabase = getServerClient();
  const client = supabase as unknown as SupabaseClient<any>;
  const albumId = params.id;

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

  const { data: album, error: albumError } = (await client
    .from('albums')
    .select('id, owner_id, name, slug, visibility, created_at, updated_at')
    .eq('id', albumId)
    .maybeSingle()) as { data: AlbumRow | null; error: PostgrestError | null };

  if (albumError) {
    return NextResponse.json({ error: albumError.message }, { status: 500 });
  }

  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 });
  }

  if (album.owner_id !== user.id) {
    return NextResponse.json({ error: 'Only the owner can delete this album' }, { status: 403 });
  }

  const { error } = await client.from('albums').delete().eq('id', albumId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function ensureUniqueSlug(client: SupabaseClient<any>, baseSlug: string, currentId?: string) {
  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    const { data, error } = await client
      .from('albums')
      .select('id')
      .eq('slug', candidate)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    if (!data || data.id === currentId) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}
