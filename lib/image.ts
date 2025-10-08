import sharp from 'sharp';

export interface ProcessedImage {
  webpBuffer: Buffer;
  thumbBuffer: Buffer;
  width: number;
  height: number;
  sizeKB: number;
}

export async function toSquareWebp(buffer: Buffer): Promise<ProcessedImage> {
  const metadata = await sharp(buffer).metadata();
  const minSide = Math.min(metadata.width ?? 512, metadata.height ?? 512);
  const resized = sharp(buffer)
    .resize({
      width: minSide,
      height: minSide,
      fit: 'cover',
      position: 'centre'
    })
    .webp({ quality: 80 });

  const webpBuffer = await resized.toBuffer();
  const thumbBuffer = await sharp(webpBuffer)
    .resize(128, 128, { fit: 'cover' })
    .webp({ quality: 70 })
    .toBuffer();

  const { width = 512, height = 512, size = webpBuffer.length } = await sharp(
    webpBuffer
  ).metadata();

  return {
    webpBuffer,
    thumbBuffer,
    width,
    height,
    sizeKB: Math.round(size / 1024)
  };
}
