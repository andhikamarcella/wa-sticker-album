'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

type Sticker = {
  id: string;
  album_id: string;
  file_url: string;
  thumb_url: string | null;
  title: string | null;
  size_kb: number | null;
  sort_index: number;
  created_at: string | null;
};

type StickersResponse = { data: Sticker[] };

type CreatePackPayload = {
  albumId: string;
  name: string;
  author?: string;
  stickerIds: string[];
};

type CreatePackResponse = {
  id: string;
  exported_zip_url: string | null;
};

type PublishResponse = {
  publicUrl: string;
  waUrl: string;
};

interface PackBuilderProps {
  albumId: string;
}

export function PackBuilder({ albumId }: PackBuilderProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [name, setName] = useState('Sticker Pack');
  const [author, setAuthor] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [lastPack, setLastPack] = useState<CreatePackResponse | null>(null);
  const [shareInfo, setShareInfo] = useState<PublishResponse | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery<StickersResponse>({
    queryKey: ['album', albumId, 'stickers'],
    queryFn: async () => {
      const response = await fetch(`/api/albums/${albumId}/stickers`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? 'Gagal memuat sticker');
      }

      return (await response.json()) as StickersResponse;
    },
  });

  const stickers = useMemo<Sticker[]>(() => ((data?.data ?? []) as Sticker[]), [data]);

  useEffect(() => {
    setSelected((prev) => prev.filter((id) => stickers.some((sticker) => sticker.id === id)));
  }, [stickers]);

  const toggleSelection = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }, []);

  const moveSelection = useCallback((id: string, direction: number) => {
    setSelected((prev) => {
      const index = prev.indexOf(id);
      if (index === -1) {
        return prev;
      }

      const nextIndex = Math.max(0, Math.min(prev.length - 1, index + direction));
      if (index === nextIndex) {
        return prev;
      }

      const draft = [...prev];
      const [item] = draft.splice(index, 1);
      draft.splice(nextIndex, 0, item);
      return draft;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(stickers.map((sticker) => sticker.id));
  }, [stickers]);

  const clearSelection = useCallback(() => {
    setSelected([]);
  }, []);

  const selectedStickers = useMemo(() => {
    const map = new Map(stickers.map((sticker) => [sticker.id, sticker]));
    return selected
      .map((id) => map.get(id))
      .filter((value): value is Sticker => Boolean(value));
  }, [selected, stickers]);

  const canBuild = selected.length > 0 && !isLoading && !isFetching;

  const packMutation = useMutation<CreatePackResponse, Error, void>({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error('Nama pack wajib diisi');
      }
      if (selected.length === 0) {
        throw new Error('Pilih minimal satu sticker');
      }

      const payload: CreatePackPayload = {
        albumId,
        name: trimmedName,
        stickerIds: [...selected],
      };

      const trimmedAuthor = author.trim();
      if (trimmedAuthor) {
        payload.author = trimmedAuthor;
      }

      const response = await fetch('/api/packs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.json().catch(() => ({}));
        throw new Error((message as { error?: string }).error ?? 'Gagal membuat pack');
      }

      return (await response.json()) as CreatePackResponse;
    },
    onSuccess: (payload) => {
      setLastPack(payload);
      setShareInfo(null);
      setSelected([]);
      showToast({
        title: 'Pack dibuat',
        description: 'ZIP siap diunduh',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['packs', albumId] }).catch(() => undefined);
    },
    onError: (err) => {
      showToast({
        title: 'Gagal membuat pack',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const publishMutation = useMutation<PublishResponse, Error, void>({
    mutationFn: async () => {
      if (!lastPack?.id) {
        throw new Error('Belum ada pack yang siap publish');
      }

      const response = await fetch(`/api/packs/${lastPack.id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const message = await response.json().catch(() => ({}));
        throw new Error((message as { error?: string }).error ?? 'Gagal mempublish pack');
      }

      return (await response.json()) as PublishResponse;
    },
    onSuccess: (payload) => {
      setShareInfo(payload);
      showToast({
        title: 'Pack siap dibagikan',
        description: 'Bagikan link publik ke teman-teman',
        variant: 'success',
      });
    },
    onError: (err) => {
      showToast({
        title: 'Gagal publish pack',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  if (isError) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {(error as Error | undefined)?.message ?? 'Terjadi kesalahan saat memuat sticker'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-3">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nama pack"
            />
            <Input
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="Nama pembuat (opsional)"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={selectAll}
              disabled={isLoading || isFetching || stickers.length === 0}
            >
              Pilih semua
            </Button>
            <Button type="button" variant="ghost" onClick={clearSelection} disabled={selected.length === 0}>
              Bersihkan pilihan
            </Button>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              className="w-full"
              onClick={() => packMutation.mutate()}
              disabled={!canBuild || packMutation.isPending}
            >
              {packMutation.isPending ? 'Menyiapkan ZIP…' : 'Buat & Export ZIP'}
            </Button>

            {lastPack?.exported_zip_url ? (
              <a
                href={lastPack.exported_zip_url}
                target="_blank"
                rel="noreferrer"
                className="block text-center text-sm font-medium text-primary underline"
              >
                Unduh ZIP terbaru
              </a>
            ) : null}

            {lastPack?.id ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
              >
                {publishMutation.isPending ? 'Menyiapkan link…' : 'Publish & Buat Link'}
              </Button>
            ) : null}
          </div>

          {shareInfo ? (
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
              <p className="font-semibold">Link Publik</p>
              <a
                href={shareInfo.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-primary underline"
              >
                {shareInfo.publicUrl}
              </a>
              <p className="mt-3 font-semibold">WhatsApp</p>
              <a
                href={shareInfo.waUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-primary underline"
              >
                {shareInfo.waUrl}
              </a>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Sticker dipilih ({selected.length})</p>
            {isFetching ? <p className="text-xs text-muted-foreground">Memuat…</p> : null}
          </div>

          <div className="mt-4 space-y-3">
            {selectedStickers.length > 0 ? (
              selectedStickers.map((sticker) => (
                <div key={sticker.id} className="flex items-center gap-3 rounded-2xl border border-border/60 p-2">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-muted">
                    <Image
                      src={sticker.thumb_url ?? sticker.file_url}
                      alt={sticker.title ?? 'Sticker'}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{sticker.title ?? 'Tanpa nama'}</p>
                    {typeof sticker.size_kb === 'number' ? (
                      <p className="text-xs text-muted-foreground">{sticker.size_kb} KB</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => moveSelection(sticker.id, -1)}
                      aria-label="Geser ke atas"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => moveSelection(sticker.id, 1)}
                      aria-label="Geser ke bawah"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleSelection(sticker.id)}
                      aria-label="Hapus dari pilihan"
                    >
                      <X className="h-4 w-4" />
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

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Semua Sticker</p>
          {isFetching ? <p className="text-xs text-muted-foreground">Memuat…</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {isLoading && stickers.length === 0
            ? Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 rounded-3xl border border-border bg-muted/40 animate-pulse"
                />
              ))
            : null}

          {!isLoading && stickers.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/30 p-10 text-center">
              <p className="text-sm font-medium">Belum ada sticker di album ini.</p>
              <p className="mt-1 text-xs text-muted-foreground">Unggah sticker terlebih dahulu untuk membangun pack.</p>
            </div>
          ) : null}

          {stickers.map((sticker) => {
            const active = selected.includes(sticker.id);
            return (
              <button
                key={sticker.id}
                type="button"
                onClick={() => toggleSelection(sticker.id)}
                className={cn(
                  'group relative overflow-hidden rounded-3xl border border-border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  active ? 'border-primary ring-2 ring-primary' : 'hover:border-primary',
                )}
                aria-pressed={active}
              >
                <div className="relative h-28 w-full overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={sticker.thumb_url ?? sticker.file_url}
                    alt={sticker.title ?? 'Sticker'}
                    fill
                    sizes="120px"
                    className="object-cover transition group-hover:scale-[1.03]"
                  />
                </div>
                <p className="mt-2 line-clamp-1 text-xs font-medium">
                  {sticker.title ?? 'Tanpa nama'}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
