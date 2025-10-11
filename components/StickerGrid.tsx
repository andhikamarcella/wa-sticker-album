'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageOff, Loader2, Trash2 } from 'lucide-react';

import { StickerCard } from '@/components/StickerCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/useToast';
import { formatCount } from '@/lib/utils';

interface StickerGridProps {
  albumId: string;
}

type StickerItem = {
  id: string;
  file_url: string;
  thumb_url: string | null;
  title: string | null;
  size_kb: number | null;
  sort_index: number;
  created_at: string | null;
};

type StickerListResponse = {
  data: StickerItem[];
};

const STICKER_QUERY_KEY = 'stickers';

export function StickerGrid({ albumId }: StickerGridProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<StickerListResponse, Error>({
    queryKey: ['album', albumId, STICKER_QUERY_KEY],
    queryFn: async () => {
      const response = await fetch(`/api/albums/${albumId}/stickers`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = typeof payload?.error === 'string' ? payload.error : 'Gagal memuat sticker';
        throw new Error(message);
      }
      return response.json();
    },
  });

  const stickers = useMemo(() => data?.data ?? [], [data]);

  useEffect(() => {
    if (stickers.length === 0) {
      setSelected([]);
      return;
    }
    setSelected((prev) => prev.filter((id) => stickers.some((sticker) => sticker.id === id)));
  }, [stickers]);

  const reorderMutation = useMutation<
    { ok: true },
    Error,
    { orders: Array<{ id: string; sort_index: number }> }
  >({
    mutationFn: async ({ orders }) => {
      const response = await fetch(`/api/albums/${albumId}/stickers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = typeof payload?.error === 'string' ? payload.error : 'Gagal memperbarui urutan sticker';
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['album', albumId, STICKER_QUERY_KEY] });
      showToast({ title: 'Urutan sticker diperbarui', variant: 'success' });
    },
    onError: (err) => {
      showToast({ title: 'Gagal memperbarui urutan', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation<{ ok: true }, Error, string[]>({
    mutationFn: async (ids) => {
      const response = await fetch(`/api/albums/${albumId}/stickers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = typeof payload?.error === 'string' ? payload.error : 'Gagal menghapus sticker';
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      setSelected((prev) => prev.filter((id) => !variables.includes(id)));
      queryClient.invalidateQueries({ queryKey: ['album', albumId, STICKER_QUERY_KEY] });
      showToast({ title: 'Sticker dihapus', variant: 'success' });
    },
    onError: (err) => {
      showToast({ title: 'Gagal menghapus sticker', description: err.message, variant: 'destructive' });
    },
  });

  const isBusy = reorderMutation.isPending || deleteMutation.isPending;

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }, []);

  const handleMove = useCallback(
    (id: string, direction: 'up' | 'down') => {
      if (isBusy) {
        return;
      }
      const index = stickers.findIndex((sticker) => sticker.id === id);
      if (index === -1) {
        return;
      }
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= stickers.length) {
        return;
      }

      const reordered = [...stickers];
      [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
      const orders = reordered.map((sticker, orderIndex) => ({ id: sticker.id, sort_index: orderIndex }));
      reorderMutation.mutate({ orders });
    },
    [isBusy, reorderMutation, stickers],
  );

  const handleDelete = useCallback(
    (ids: string[]) => {
      if (ids.length === 0 || isBusy) {
        return;
      }
      deleteMutation.mutate(ids);
    },
    [deleteMutation, isBusy],
  );

  const handleClearSelection = useCallback(() => {
    setSelected([]);
  }, []);

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          {error.message}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Coba lagi
        </Button>
      </div>
    );
  }

  const total = stickers.length;

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  } else if (total === 0) {
    content = (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <ImageOff className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="mt-4 text-base font-semibold text-foreground">Belum ada sticker</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Unggah sticker pertamamu melalui dropzone di atas untuk mulai membangun koleksi ini.
        </p>
      </div>
    );
  } else {
    content = (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {stickers.map((sticker) => (
          <StickerCard
            key={sticker.id}
            id={sticker.id}
            thumbUrl={sticker.thumb_url ?? sticker.file_url}
            title={sticker.title}
            selected={selected.includes(sticker.id)}
            onSelectToggle={() => toggleSelect(sticker.id)}
            onMoveUp={() => handleMove(sticker.id, 'up')}
            onMoveDown={() => handleMove(sticker.id, 'down')}
            onDelete={() => handleDelete([sticker.id])}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 p-3 backdrop-blur">
          <p className="text-sm font-medium text-foreground">
            {selected.length} sticker dipilih
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => handleDelete(selected)}
              disabled={isBusy}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus dipilih
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleClearSelection} disabled={isBusy}>
              Batal
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {formatCount(total)} sticker
          {isFetching && !isLoading ? ' · menyegarkan…' : ''}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Muat ulang
        </Button>
      </div>

      {content}
    </div>
  );
}

export default StickerGrid;
