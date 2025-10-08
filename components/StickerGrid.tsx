'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/useToast';

interface StickerGridProps {
  albumId: string;
}

export function StickerGrid({ albumId }: StickerGridProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['album', albumId, 'stickers'],
    queryFn: async () => {
      const response = await fetch(`/api/albums/${albumId}/stickers`);
      if (!response.ok) throw new Error('Gagal memuat sticker');
      return response.json();
    }
  });

  const updateSticker = useMutation({
    mutationFn: async (payload: { id: string; title?: string; tags?: string[] }) => {
      const response = await fetch(`/api/albums/${albumId}/stickers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Gagal memperbarui sticker');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['album', albumId, 'stickers'] });
      showToast({ title: 'Sticker diperbarui', variant: 'success' });
    },
    onError: (error: unknown) => {
      showToast({ title: 'Gagal', description: (error as Error).message, variant: 'destructive' });
    }
  });

  const toggleSelection = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Memuat sticker...</p>;
  }

  const stickers = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{stickers.length} sticker</p>
        {selected.length > 0 && (
          <Badge className="bg-primary/10 text-primary">{selected.length} dipilih</Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {stickers.map((sticker: any) => (
          <div
            key={sticker.id}
            className={`group relative overflow-hidden rounded-3xl border border-border p-2 transition ${
              selected.includes(sticker.id) ? 'ring-2 ring-primary' : 'hover:border-primary'
            }`}
          >
            <button
              onClick={() => toggleSelection(sticker.id)}
              className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-1 text-xs"
            >
              {selected.includes(sticker.id) ? 'Dipilih' : 'Pilih'}
            </button>
            <div className="relative h-32 w-full overflow-hidden rounded-2xl bg-muted">
              <Image src={sticker.thumb_url ?? sticker.file_url} alt={sticker.title ?? 'Sticker'} fill className="object-cover" />
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <Input
                defaultValue={sticker.title ?? ''}
                placeholder="Nama sticker"
                onBlur={(event) =>
                  updateSticker.mutate({ id: sticker.id, title: event.target.value || undefined })
                }
              />
              <Input
                defaultValue={sticker.tags?.join(', ') ?? ''}
                placeholder="Tag (pisahkan koma)"
                onBlur={(event) =>
                  updateSticker.mutate({
                    id: sticker.id,
                    tags: event.target.value
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                  })
                }
              />
              <p className="text-xs text-muted-foreground">{sticker.width}x{sticker.height}px · {sticker.size_kb}KB</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
