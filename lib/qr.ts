import QRCode from 'qrcode';

export async function makeQrPngDataUrl(text: string) {
  return QRCode.toDataURL(text, {
    type: 'image/png',
    scale: 8,
    margin: 1
  });
}
