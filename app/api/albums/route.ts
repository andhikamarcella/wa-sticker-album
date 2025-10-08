import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { albumCreateSchema } from '@/lib/zod-schemas';
import { slugify } from '@/lib/slug';
import type { Database } from '@/types/database';

export async function GET() {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ data: [] });
  }

  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const body = await request.json();
  const parsed = albumCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const slug = slugify(parsed.data.name);

  const { data, error } = await supabase
    .from('albums')
    .insert({
      name: parsed.data.name,
      visibility: parsed.data.visibility ?? 'public',
      cover_url: parsed.data.coverUrl ?? null,
      owner_id: user.id,
      slug
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
