'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from '@/hooks/useToast';

interface PackBuilderProps {
  albumId: string;
}

export function PackBuilder({ albumId }: PackBuilderProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState('Sticker Pack');
  const [author, setAuthor] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [lastPack, setLastPack] = useState<any | null>(null);
  const [shareInfo, setShareInfo] = useState<any | null>(null);

  const { data } = useQuery({
    queryKey: ['album', albumId, 'stickers'],
    queryFn: async () => {
      const response = await fetch(`/api/albums/${albumId}/stickers`);
      if (!response.ok) throw new Error('Gagal memuat sticker');
      return response.json();
    }
  });

  const stickers = data?.data ?? [];

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const move = (id: string, direction: number) => {
    setSelected((prev) => {
      const index = prev.indexOf(id);
      if (index === -1) return prev;
      const nextIndex = Math.max(0, Math.min(prev.length - 1, index + direction));
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      next.splice(nextIndex, 0, removed);
      return next;
    });
  };

  const packMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId, name, author, stickerIds: selected })
      });
      if (!response.ok) throw new Error('Gagal membuat pack');
      return response.json();
    },
    onSuccess: (payload) => {
      showToast({ title: 'Pack dibuat', description: 'ZIP siap diunduh', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['packs', albumId] });
      setSelected([]);
      setLastPack(payload);
      setShareInfo(null);
      return payload;
    },
    onError: (error: unknown) => {
      showToast({ title: 'Gagal', description: (error as Error).message, variant: 'destructive' });
    }
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!lastPack?.id) throw new Error('Belum ada pack untuk dipublish');
      const response = await fetch(`/api/packs/${lastPack.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ makePublic: true })
      });
      if (!response.ok) throw new Error('Gagal mempublish pack');
      return response.json();
    },
    onSuccess: (data) => {
      setShareInfo(data);
      showToast({ title: 'Pack siap dibagikan', variant: 'success' });
    },
    onError: (error: unknown) => {
      showToast({ title: 'Gagal', description: (error as Error).message, variant: 'destructive' });
    }
  });

  const selectedStickers = useMemo(() => {
    return selected.map((id) => stickers.find((item: any) => item.id === id)).filter(Boolean);
  }, [selected, stickers]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama pack" />
          <Input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Nama pembuat" />
          <Button
            onClick={() => packMutation.mutate()}
            disabled={selected.length === 0 || packMutation.isPending}
            className="w-full"
          >
            {packMutation.isPending ? 'Memproses...' : 'Buat & Export ZIP'}
          </Button>
          {packMutation.data?.exported_zip_url && (
            <a
              href={packMutation.data.exported_zip_url}
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
              {publishMutation.isPending ? 'Menyiapkan share...' : 'Publish & Buat Link'}
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
        <div className="rounded-3xl border border-border p-4">
          <p className="mb-3 text-sm font-medium">Sticker dipilih ({selected.length})</p>
          <div className="space-y-3">
            {selectedStickers.length ? (
              selectedStickers.map((sticker: any) => (
                <div key={sticker.id} className="flex items-center gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-muted">
                    <Image src={sticker.thumb_url ?? sticker.file_url} alt={sticker.title ?? 'Sticker'} fill className="object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{sticker.title ?? 'Tanpa nama'}</p>
                    <p className="text-xs text-muted-foreground">{sticker.size_kb}KB</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => move(sticker.id, -1)}>
                      ↑
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => move(sticker.id, 1)}>
                      ↓
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(sticker.id)}>
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
      <div>
        <p className="mb-3 text-sm font-medium">Semua Sticker</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {stickers.map((sticker: any) => (
            <button
              key={sticker.id}
              onClick={() => toggle(sticker.id)}
              className={`relative overflow-hidden rounded-3xl border border-border p-2 transition ${
                selected.includes(sticker.id) ? 'ring-2 ring-primary' : 'hover:border-primary'
              }`}
            >
              <div className="relative h-28 w-full overflow-hidden rounded-2xl bg-muted">
                <Image src={sticker.thumb_url ?? sticker.file_url} alt={sticker.title ?? 'Sticker'} fill className="object-cover" />
              </div>
              <p className="mt-2 text-xs font-medium">{sticker.title ?? 'Tanpa nama'}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
