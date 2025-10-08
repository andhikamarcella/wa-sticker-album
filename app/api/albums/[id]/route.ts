import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { albumUpdateSchema } from '@/lib/zod-schemas';
import { slugify } from '@/lib/slug';
import type { Database } from '@/types/database';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data, error } = await supabase.from('albums').select('*').eq('id', params.id).single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const body = await request.json();
  const parsed = albumUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.name) {
    payload.slug = slugify(parsed.data.name);
  }

  const { data, error } = await supabase
    .from('albums')
    .update(payload)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
