'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from '@/hooks/useToast';

interface AlbumWizardProps {
  children: React.ReactNode;
}

export function AlbumWizard({ children }: AlbumWizardProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [selectedAlbum, setSelectedAlbum] = useState<string>('');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const router = useRouter();

  const { data: albums } = useQuery({
    queryKey: ['albums'],
    queryFn: async () => {
      const response = await fetch('/api/albums');
      if (!response.ok) throw new Error('Gagal memuat album');
      return response.json();
    },
    enabled: open
  });

  const createAlbum = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, visibility })
      });
      if (!response.ok) throw new Error('Gagal membuat album');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      showToast({ title: 'Album dibuat', variant: 'success' });
      setOpen(false);
      setName('');
      router.refresh();
    },
    onError: (error: unknown) => {
      showToast({ title: 'Gagal', description: (error as Error).message, variant: 'destructive' });
    }
  });

  const addToAlbum = useMutation({
    mutationFn: async () => {
      if (!selectedAlbum) throw new Error('Pilih album terlebih dahulu');
      return selectedAlbum;
    },
    onSuccess: (albumId) => {
      showToast({ title: 'Album dipilih', description: 'Siap menambahkan sticker', variant: 'success' });
      setOpen(false);
      setSelectedAlbum(albumId as string);
      router.push(`/albums/${albumId}`);
    },
    onError: (error: unknown) => {
      showToast({ title: 'Gagal', description: (error as Error).message, variant: 'destructive' });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Album Baru atau Tambahkan</DialogTitle>
          <DialogDescription>Pilih buat album baru atau tambahkan ke album milikmu.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="create">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Buat Baru</TabsTrigger>
            <TabsTrigger value="existing">Tambah ke Album</TabsTrigger>
          </TabsList>
          <TabsContent value="create">
            <div className="space-y-4">
              <Input placeholder="Nama album" value={name} onChange={(event) => setName(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                {(['public', 'unlisted', 'private'] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={visibility === option ? 'default' : 'outline'}
                    onClick={() => setVisibility(option)}
                  >
                    {option === 'public' && 'Publik'}
                    {option === 'unlisted' && 'Tersembunyi'}
                    {option === 'private' && 'Pribadi'}
                  </Button>
                ))}
              </div>
              <Button onClick={() => createAlbum.mutate()} disabled={!name || createAlbum.isPending} className="w-full">
                {createAlbum.isPending ? 'Menyimpan...' : 'Buat Album'}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="existing">
            <div className="space-y-4">
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-border p-2">
                {albums?.data?.length ? (
                  albums.data.map((album: any) => (
                    <button
                      key={album.id}
                      onClick={() => setSelectedAlbum(album.id)}
                      className={`w-full rounded-2xl px-3 py-2 text-left text-sm transition ${
                        selectedAlbum === album.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                      }`}
                    >
                      {album.name}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada album.</p>
                )}
              </div>
              <Button onClick={() => addToAlbum.mutate()} disabled={!selectedAlbum || addToAlbum.isPending} className="w-full">
                {addToAlbum.isPending ? 'Memilih...' : 'Pilih Album'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
