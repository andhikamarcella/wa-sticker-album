import { NextResponse } from 'next/server';
import { makeQrPngDataUrl } from '@/lib/qr';

export async function POST(request: Request) {
  const { text } = await request.json();
  if (!text) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }
  const dataUrl = await makeQrPngDataUrl(text);
  return NextResponse.json({ dataUrl });
}
