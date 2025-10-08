import { NextResponse } from 'next/server';
import { whatsappShareSchema } from '@/lib/zod-schemas';
import { buildWaMessage, buildWaUrl } from '@/lib/whatsapp';
import { makeQrPngDataUrl } from '@/lib/qr';

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = whatsappShareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const message = buildWaMessage({ albumName: parsed.data.albumName, albumUrl: parsed.data.albumUrl });
  const waUrl = buildWaUrl({ phone: parsed.data.phone, message });
  const qrDataUrl = await makeQrPngDataUrl(waUrl);

  return NextResponse.json({ waUrl, message, qrDataUrl });
}
