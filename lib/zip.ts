import JSZip from 'jszip';

interface ZipOptions {
  stickers: Array<{
    id: string;
    title: string | null;
    file_url: string;
  }>;
  packName: string;
  author?: string | null;
}

export async function buildPackZip({ stickers, packName, author }: ZipOptions) {
  const zip = new JSZip();
  const folder = zip.folder(packName) ?? zip;

  const stickerEntries: Array<{ id: string; title: string | null; filename: string }> = [];

  await Promise.all(
    stickers.map(async (sticker, index) => {
      const res = await fetch(sticker.file_url);
      if (!res.ok) {
        throw new Error(`Failed to download sticker ${sticker.id}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const filename = `${String(index + 1).padStart(2, '0')}_${sticker.id}.webp`;
      stickerEntries.push({ id: sticker.id, title: sticker.title, filename });
      folder.file(filename, arrayBuffer);
    })
  );

  const metadata = {
    pack_name: packName,
    author: author ?? undefined,
    stickers: stickerEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      file: entry.filename
    }))
  };

  folder.file('metadata.json', JSON.stringify(metadata, null, 2));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
