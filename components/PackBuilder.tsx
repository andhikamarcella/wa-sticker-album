'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from '@/hooks/useToast';

type Sticker = {
  id: string;
  album_id: string;
  file_url: string;
  thumb_url?: string | null;
  title?: string | null;
  size_kb?: number | null;
  order_index?: number | null;
  created_at?: string;
};

type StickersResponse = { data: Sticker[] };

type CreatePackPayload = {
  albumId: string;
  name: string;
  author: string;
  stickerIds: string[];
};

type CreatePackResponse = {
  id: string;
  exported_zip_url?: string;
};

type PublishResponse = {
  publicUrl: string;
  waUrl: string;
};

interface PackBuilderProps {
  albumId: string;
}

export function PackBuilder({ albumId }: PackBuilderProps) {
  const qc = useQueryClient();
  const { showToast } = useToast();

  const [name, setName] = useState('Sticker Pack');
  const [author, setAuthor] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [lastPack, setLastPack] = useState<CreatePackResponse | null>(null);
  const [shareInfo, setShareInfo] = useState<PublishResponse | null>(null);

  /** ───────────────────────────
   *  Load stickers
   *  ─────────────────────────── */
  const { data, isLoading, isError, error } = useQuery<StickersResponse>({
    queryKey: ['album', albumId, 'stickers'],
    queryFn: async () => {
      const res = await fetch(`/api/albums/${albumId}/stickers`);
      if (!res.ok) throw new Error('Gagal memuat sticker');
      return (await res.json()) as StickersResponse;
    },
  });

  // ✅ normalisasi ke variabel stabil (menghindari logical expression di deps)
  const stickersData = data?.data as Sticker[] | undefined;
  const stickers = useMemo<Sticker[]>(() => stickersData ?? [], [stickersData]);

  /** ───────────────────────────
   *  Helpers seleksi
   *  ─────────────────────────── */
  const toggle = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const move = useCallback((id: string, direction: number) => {
    setSelected((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const nextI = Math.max(0, Math.min(prev.length - 1, i + direction));
      if (i === nextI) return prev;
      const next = [...prev];
      const [rm] = next.splice(i, 1);
      next.splice(nextI, 0, rm);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(stickers.map((s) => s.id));
  }, [stickers]);

  const clearSelection = useCallback(() => setSelected([]), []);

  // ✅ derived data stabil
  const selectedStickers = useMemo(
    () => selected.map((id) => stickers.find((s) => s.id === id)).filter(Boolean) as Sticker[],
    [selected, stickers]
  );
  const canBuild = useMemo(() => selected.length > 0, [selected]);

  /** ───────────────────────────
   *  Mutations
   *  ─────────────────────────── */
  const packMutation = useMutation<CreatePackResponse, Error, void>({
    mutationFn: async () => {
      const payload: CreatePackPayload = { albumId, name, author, stickerIds: selected };
      const res = await fetch('/api/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Gagal membuat pack');
      }
      return (await res.json()) as CreatePackResponse;
    },
    onSuccess: (payload) => {
      showToast({ title: 'Pack dibuat', description: 'ZIP siap diunduh', variant: 'success' });
      qc.invalidateQueries({ queryKey: ['packs', albumId] });
      setSelected([]);
      setLastPack(payload);
      setShareInfo(null);
    },
    onError: (e) => {
      showToast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    },
  });

  const publishMutation = useMutation<PublishResponse, Error, void>({
    mutationFn: async () => {
      if (!lastPack?.id) throw new Error('Belum ada pack untuk dipublish');
      const res = await fetch(`/api/packs/${lastPack.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ makePublic: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Gagal mempublish pack');
      }
      return (await res.json()) as PublishResponse;
    },
    onSuccess: (data) => {
      setShareInfo(data);
      showToast({ title: 'Pack siap dibagikan', variant: 'success' });
    },
    onError: (e) => {
      showToast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    },
  });

  /** ───────────────────────────
   *  UI
   *  ─────────────────────────── */
  if (isError) {
    return (
      <div className="rounded-3xl border border-border bg-muted/30 p-4 text-sm text-destructive">
        {(error as Error)?.message ?? 'Gagal memuat sticker'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Panel kiri */}
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama pack" />
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Nama pembuat" />

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={selectAll} disabled={isLoading || stickers.length === 0}>
              Pilih semua
            </Button>
            <Button type="button" variant="ghost" onClick={clearSelection} disabled={selected.length === 0}>
              Bersihkan
            </Button>
          </div>

          <Button
            onClick={() => packMutation.mutate()}
            disabled={!canBuild || packMutation.isPending}
            className="w-full"
          >
            {packMutation.isPending ? 'Memproses…' : 'Buat & Export ZIP'}
          </Button>

          {lastPack?.exported_zip_url && (
            <a
              href={lastPack.exported_zip_url}
              target="_blank"
              rel="noreferrer"
              className="block text-sm text-primary underline"
            >
              Unduh ZIP Terbaru
            </a>
          )}

          {lastPack?.id && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="w-full"
            >
              {publishMutation.isPending ? 'Menyiapkan share…' : 'Publish & Buat Link'}
            </Button>
          )}

          {shareInfo && (
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium">Link Publik:</p>
              <a href={shareInfo.publicUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                {shareInfo.publicUrl}
              </a>
              <p className="mt-2 font-medium">WhatsApp:</p>
              <a href={shareInfo.waUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                {shareInfo.waUrl}
              </a>
            </div>
          )}
        </div>

        {/* Panel kanan: list pilihan */}
        <div className="rounded-3xl border border-border p-4">
          <p className="mb-3 text-sm font-medium">
            Sticker dipilih ({selected.length}) {isLoading ? '• Memuat…' : ''}
          </p>
          <div className="space-y-3">
            {selectedStickers.length ? (
              selectedStickers.map((sticker) => (
                <div key={sticker.id} className="flex items-center gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-muted">
                    <Image
                      src={sticker.thumb_url ?? sticker.file_url}
                      alt={sticker.title ?? 'Sticker'}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{sticker.title ?? 'Tanpa nama'}</p>
                    {typeof sticker.size_kb === 'number' && (
                      <p className="text-xs text-muted-foreground">{sticker.size_kb}KB</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => move(sticker.id, -1)} aria-label="Ke atas">
                      ↑
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => move(sticker.id, 1)} aria-label="Ke bawah">
                      ↓
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(sticker.id)} aria-label="Hapus dari pilihan">
                      ×
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada sticker dipilih.</p>
            )}
          </div>
        </div>
      </div>

      {/* Semua sticker */}
      <div>
        <p className="mb-3 text-sm font-medium">Semua Sticker</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {isLoading && stickers.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-36 rounded-3xl border border-border bg-muted/30" />
            ))
          ) : (
            stickers.map((sticker) => {
              const active = selected.includes(sticker.id);
              return (
                <button
                  key={sticker.id}
                  onClick={() => toggle(sticker.id)}
                  className={`relative overflow-hidden rounded-3xl border border-border p-2 transition ${
                    active ? 'ring-2 ring-primary' : 'hover:border-primary'
                  }`}
                  aria-pressed={active}
                  aria-label={active ? 'Batalkan pilih' : 'Pilih'}
                >
                  <div className="relative h-28 w-full overflow-hidden rounded-2xl bg-muted">
                    <Image
                      src={sticker.thumb_url ?? sticker.file_url}
                      alt={sticker.title ?? 'Sticker'}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-2 line-clamp-1 text-xs font-medium">
                    {sticker.title ?? 'Tanpa nama'}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
