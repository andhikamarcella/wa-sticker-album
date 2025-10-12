import { randomUUID } from 'node:crypto';

import { slugify } from '@/lib/slug';

export type MockAlbumVisibility = 'public' | 'unlisted' | 'private';

export type MockAlbum = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  visibility: MockAlbumVisibility;
  createdAt: string;
  updatedAt: string;
};

export type MockSticker = {
  id: string;
  albumId: string;
  ownerId: string;
  fileUrl: string;
  thumbUrl: string;
  title: string | null;
  sizeKb: number | null;
  sortIndex: number;
  createdAt: string;
};

export type MockPack = {
  id: string;
  albumId: string;
  ownerId: string;
  name: string;
  author: string | null;
  stickerIds: string[];
  exportedZipDataUrl: string;
  publicUrl: string | null;
  waShareUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type MockDb = {
  albums: Map<string, MockAlbum>;
  stickers: Map<string, MockSticker>;
  packs: Map<string, MockPack>;
};

const globalStore = globalThis as typeof globalThis & { __waStickerMockDb?: MockDb };

function getStore(): MockDb {
  if (!globalStore.__waStickerMockDb) {
    globalStore.__waStickerMockDb = {
      albums: new Map(),
      stickers: new Map(),
      packs: new Map(),
    };
  }

  return globalStore.__waStickerMockDb;
}

function ensureUniqueSlug(baseSlug: string, excludeId?: string): string {
  const db = getStore();
  const base = baseSlug.length > 0 ? baseSlug : 'album';
  let candidate = base;
  let suffix = 1;

  const hasConflict = (slug: string) =>
    Array.from(db.albums.values()).some((album) => album.slug === slug && album.id !== excludeId);

  while (hasConflict(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function mockCreateAlbum(ownerId: string, name: string, visibility: MockAlbumVisibility): MockAlbum {
  const db = getStore();
  const now = new Date().toISOString();
  const baseSlug = slugify(name) || `album-${Math.random().toString(36).slice(2, 8)}`;
  const slug = ensureUniqueSlug(baseSlug);

  const album: MockAlbum = {
    id: randomUUID(),
    ownerId,
    name,
    slug,
    visibility,
    createdAt: now,
    updatedAt: now,
  };

  db.albums.set(album.id, album);
  return album;
}

export function mockUpdateAlbum(
  id: string,
  changes: Partial<Pick<MockAlbum, 'name' | 'visibility'>>,
): MockAlbum | null {
  const db = getStore();
  const current = db.albums.get(id);

  if (!current) {
    return null;
  }

  const next: MockAlbum = { ...current };

  if (typeof changes.name === 'string' && changes.name.trim().length > 0 && changes.name !== current.name) {
    const cleanedName = changes.name.trim();
    next.name = cleanedName;
    const baseSlug = slugify(cleanedName) || current.slug;
    next.slug = ensureUniqueSlug(baseSlug, id);
  }

  if (
    typeof changes.visibility === 'string' &&
    (changes.visibility === 'public' || changes.visibility === 'unlisted' || changes.visibility === 'private')
  ) {
    next.visibility = changes.visibility;
  }

  next.updatedAt = new Date().toISOString();
  db.albums.set(id, next);
  return next;
}

export function mockDeleteAlbum(id: string): boolean {
  const db = getStore();
  const existed = db.albums.delete(id);

  if (!existed) {
    return false;
  }

  for (const sticker of Array.from(db.stickers.values())) {
    if (sticker.albumId === id) {
      db.stickers.delete(sticker.id);
    }
  }

  for (const pack of Array.from(db.packs.values())) {
    if (pack.albumId === id) {
      db.packs.delete(pack.id);
    }
  }

  return true;
}

export function mockListAlbumsByOwner(ownerId: string): MockAlbum[] {
  const db = getStore();
  return Array.from(db.albums.values()).filter((album) => album.ownerId === ownerId);
}

export function mockListAlbumsByVisibility(visibility: MockAlbumVisibility[]): MockAlbum[] {
  const db = getStore();
  const allow = new Set(visibility);
  return Array.from(db.albums.values()).filter((album) => allow.has(album.visibility));
}

export function mockFindAlbumBySlug(slug: string): MockAlbum | null {
  const db = getStore();
  for (const album of db.albums.values()) {
    if (album.slug === slug) {
      return album;
    }
  }

  return null;
}

export function mockGetAlbum(id: string): MockAlbum | null {
  const db = getStore();
  return db.albums.get(id) ?? null;
}

export function mockListStickers(albumId: string): MockSticker[] {
  const db = getStore();
  return Array.from(db.stickers.values())
    .filter((sticker) => sticker.albumId === albumId)
    .sort((a, b) => {
      if (a.sortIndex === b.sortIndex) {
        return a.createdAt.localeCompare(b.createdAt);
      }

      return a.sortIndex - b.sortIndex;
    });
}

export function mockAddStickers(
  albumId: string,
  ownerId: string,
  entries: Array<{ fileUrl: string; thumbUrl: string; title: string | null; sizeKb: number | null }>,
): MockSticker[] {
  const db = getStore();
  const existing = mockListStickers(albumId);
  let lastSort = existing.length > 0 ? existing[existing.length - 1].sortIndex : -1;
  const inserted: MockSticker[] = [];

  for (const entry of entries) {
    lastSort += 1;
    const createdAt = new Date().toISOString();
    const sticker: MockSticker = {
      id: randomUUID(),
      albumId,
      ownerId,
      fileUrl: entry.fileUrl,
      thumbUrl: entry.thumbUrl,
      title: entry.title ?? null,
      sizeKb: entry.sizeKb ?? null,
      sortIndex: lastSort,
      createdAt,
    };

    db.stickers.set(sticker.id, sticker);
    inserted.push(sticker);
  }

  const album = db.albums.get(albumId);
  if (album) {
    album.updatedAt = new Date().toISOString();
    db.albums.set(albumId, album);
  }

  return inserted;
}

export function mockReorderStickers(albumId: string, orders: Array<{ id: string; sort_index: number }>): void {
  const db = getStore();
  let touched = false;

  for (const order of orders) {
    const sticker = db.stickers.get(order.id);
    if (sticker && sticker.albumId === albumId) {
      sticker.sortIndex = order.sort_index;
      db.stickers.set(sticker.id, sticker);
      touched = true;
    }
  }

  if (touched) {
    mockTouchAlbum(albumId);
  }
}

export function mockDeleteStickers(albumId: string, ids: string[]): number {
  const db = getStore();
  let removed = 0;

  for (const id of ids) {
    const sticker = db.stickers.get(id);
    if (sticker && sticker.albumId === albumId) {
      db.stickers.delete(id);
      removed += 1;
    }
  }

  if (removed > 0) {
    mockTouchAlbum(albumId);
  }

  return removed;
}

export function mockTouchAlbum(id: string): void {
  const db = getStore();
  const album = db.albums.get(id);

  if (!album) {
    return;
  }

  album.updatedAt = new Date().toISOString();
  db.albums.set(id, album);
}

export function mockCreatePack(params: {
  albumId: string;
  ownerId: string;
  name: string;
  author: string | null;
  stickerIds: string[];
  exportedZipDataUrl: string;
}): MockPack {
  const db = getStore();
  const now = new Date().toISOString();
  const pack: MockPack = {
    id: randomUUID(),
    albumId: params.albumId,
    ownerId: params.ownerId,
    name: params.name,
    author: params.author,
    stickerIds: [...params.stickerIds],
    exportedZipDataUrl: params.exportedZipDataUrl,
    publicUrl: null,
    waShareUrl: null,
    createdAt: now,
    updatedAt: now,
  };

  db.packs.set(pack.id, pack);
  mockTouchAlbum(pack.albumId);
  return pack;
}

export function mockGetPack(id: string): MockPack | null {
  const db = getStore();
  return db.packs.get(id) ?? null;
}

export function mockPublishPack(id: string, publicUrl: string, waShareUrl: string): MockPack | null {
  const db = getStore();
  const pack = db.packs.get(id);

  if (!pack) {
    return null;
  }

  const next: MockPack = {
    ...pack,
    publicUrl,
    waShareUrl,
    updatedAt: new Date().toISOString(),
  };

  db.packs.set(id, next);
  mockTouchAlbum(pack.albumId);
  return next;
}

export function mockListPacksByAlbum(albumId: string): MockPack[] {
  const db = getStore();
  return Array.from(db.packs.values())
    .filter((pack) => pack.albumId === albumId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
