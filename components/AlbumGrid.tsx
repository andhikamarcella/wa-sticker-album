'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { AlbumCard, type AlbumVisibility } from '@/components/AlbumCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/useToast';
import { resolveAppUrl } from '@/lib/env';
import { cn } from '@/lib/utils';
import { buildWaMessage, buildWaUrl } from '@/lib/whatsapp';

import { CreateAlbumDialog } from '@/components/CreateAlbumDialog';
import { ShareButtons } from '@/components/ShareButtons';

export type AlbumScope = 'all' | 'owned' | 'shared';

type AlbumListItem = {
  id: string;
  name: string;
  slug: string;
  visibility: AlbumVisibility;
  updatedAt: string;
  stickersCount: number;
  thumbnails: string[];
};

type AlbumGridProps = {
  search?: string;
  defaultScope?: AlbumScope;
};

const responseSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        visibility: z.union([z.literal('public'), z.literal('unlisted'), z.literal('private')]),
        updatedAt: z.string(),
        stickersCount: z.number().int().nonnegative(),
        thumbnails: z.array(z.string()).optional(),
      }),
    )
    .default([]),
});

const updatePayloadSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  visibility: z.union([z.literal('public'), z.literal('unlisted'), z.literal('private')]).optional(),
});

const visibilityOptions: { value: AlbumVisibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'private', label: 'Private' },
];

export function AlbumGrid({ search, defaultScope = 'all' }: AlbumGridProps) {
  const [scope, setScope] = useState<AlbumScope>(defaultScope);
  const [renameTarget, setRenameTarget] = useState<AlbumListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlbumListItem | null>(null);
  const [shareTarget, setShareTarget] = useState<AlbumListItem | null>(null);
  const [renameVisibility, setRenameVisibility] = useState<AlbumVisibility>('private');
  const [renameName, setRenameName] = useState('');
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const normalizedSearch = useMemo(() => search?.trim() ?? '', [search]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['albums', scope, normalizedSearch],
    queryFn: async (): Promise<AlbumListItem[]> => {
      const params = new URLSearchParams();
      if (scope !== 'all') {
        params.set('scope', scope);
      }
      if (normalizedSearch) {
        params.set('q', normalizedSearch);
      }

      const response = await fetch(`/api/albums${params.size > 0 ? `?${params.toString()}` : ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      let payload: unknown;

      if (!response.ok) {
        let message = 'Failed to load albums';
        payload = await response.json().catch(() => null);
        if (payload && typeof payload === 'object') {
          const body = payload as { error?: string; message?: string };
          const detail = body.error ?? body.message;
          if (typeof detail === 'string' && detail.trim().length > 0) {
            message = detail;
          }
        }

        throw new Error(message);
      }

      payload = await response.json();
      const parsed = responseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error('Invalid response from server');
      }

      return parsed.data.data.map((album) => ({
        id: album.id,
        name: album.name,
        slug: album.slug,
        visibility: album.visibility,
        updatedAt: album.updatedAt,
        stickersCount: album.stickersCount,
        thumbnails: album.thumbnails ?? [],
      }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ albumId, payload }: { albumId: string; payload: z.infer<typeof updatePayloadSchema> }) => {
      const body = updatePayloadSchema.parse(payload);
      const response = await fetch(`/api/albums/${albumId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error ?? 'Failed to update album');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      showToast({
        title: 'Album updated',
        variant: 'success',
      });
    },
    onError: (mutationError: Error) => {
      showToast({
        title: 'Unable to update album',
        description: mutationError.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setRenameTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (albumId: string) => {
      const response = await fetch(`/api/albums/${albumId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error ?? 'Failed to delete album');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      showToast({
        title: 'Album deleted',
        variant: 'success',
      });
    },
    onError: (mutationError: Error) => {
      showToast({
        title: 'Unable to delete album',
        description: mutationError.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setDeleteTarget(null);
    },
  });

  const handleScopeChange = (value: string) => {
    if (value === scope) return;
    if (value === 'all' || value === 'owned' || value === 'shared') {
      setScope(value);
    }
  };

  const handleRenameRequest = (albumId: string) => {
    const album = data?.find((item) => item.id === albumId);
    if (!album) return;
    setRenameTarget(album);
    setRenameName(album.name);
    setRenameVisibility(album.visibility);
  };

  const handleDeleteRequest = (albumId: string) => {
    const album = data?.find((item) => item.id === albumId);
    if (!album) return;
    setDeleteTarget(album);
  };

  const handleShareRequest = (albumId: string) => {
    const album = data?.find((item) => item.id === albumId);
    if (!album) return;
    setShareTarget(album);
  };

  const handleRenameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameTarget) return;

    const parsed = updatePayloadSchema.safeParse({
      name: renameName.trim(),
      visibility: renameVisibility,
    });

    if (!parsed.success) {
      showToast({
        title: 'Please check the album name',
        description: parsed.error.issues[0]?.message ?? 'Invalid input',
        variant: 'destructive',
      });
      return;
    }

    updateMutation.mutate({ albumId: renameTarget.id, payload: parsed.data });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  };

  const albums = data ?? [];
  const showEmpty = !isLoading && !isError && albums.length === 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={scope} onValueChange={handleScopeChange} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-muted/60 p-1" aria-label="Album scope filter">
            <TabsTrigger value="all" className="rounded-2xl text-sm font-medium">
              All
            </TabsTrigger>
            <TabsTrigger value="owned" className="rounded-2xl text-sm font-medium">
              Owned
            </TabsTrigger>
            <TabsTrigger value="shared" className="rounded-2xl text-sm font-medium">
              Shared
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <CreateAlbumDialog>
          <Button className="rounded-2xl px-5">Create Album</Button>
        </CreateAlbumDialog>
      </div>
      {isLoading && <AlbumGridSkeleton />}
      {isError && (
        <div className="space-y-2 rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          <p className="font-semibold">{error instanceof Error ? error.message : 'Unable to load albums.'}</p>
          {error instanceof Error && error.message.toLowerCase().includes('supabase') ? (
            <p className="text-xs text-destructive/80">
              Update your <code className="rounded bg-destructive/15 px-1.5 py-0.5">.env.local</code> with NEXT_PUBLIC_SUPABASE_URL
              and NEXT_PUBLIC_SUPABASE_ANON_KEY to access your real albums.
            </p>
          ) : null}
        </div>
      )}
      {showEmpty && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 px-8 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl">🗂️</div>
          <h3 className="text-lg font-semibold">No albums yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create your first sticker album to start organizing and sharing your WhatsApp stickers.
          </p>
          <CreateAlbumDialog>
            <Button className="mt-6 rounded-2xl px-6">Create your first album</Button>
          </CreateAlbumDialog>
        </div>
      )}
      {!isLoading && !isError && albums.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              id={album.id}
              name={album.name}
              slug={album.slug}
              visibility={album.visibility}
              updatedAt={album.updatedAt}
              stickersCount={album.stickersCount}
              thumbnails={album.thumbnails}
              onRename={handleRenameRequest}
              onShare={handleShareRequest}
              onDelete={handleDeleteRequest}
            />
          ))}
        </div>
      )}

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            setRenameName('');
            setRenameVisibility('private');
          }
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Rename album</DialogTitle>
            <DialogDescription>Update the album name and visibility.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="album-name" className="text-sm font-medium text-foreground">
                Album name
              </label>
              <Input
                id="album-name"
                value={renameName}
                onChange={(event) => setRenameName(event.target.value)}
                required
                placeholder="My sticker album"
                className="rounded-2xl"
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">Visibility</span>
              <div className="grid grid-cols-3 gap-2">
                {visibilityOptions.map((option) => {
                  const isActive = renameVisibility === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRenameVisibility(option.value)}
                      className={cn(
                        'flex items-center justify-center rounded-2xl border border-border/60 px-3 py-2 text-sm transition',
                        isActive && 'border-primary/60 bg-primary/10 text-primary',
                      )}
                      disabled={updateMutation.isPending}
                      aria-pressed={isActive}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="rounded-2xl"
                onClick={() => setRenameTarget(null)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-2xl" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={shareTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShareTarget(null);
          }
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Share album to WhatsApp</DialogTitle>
            <DialogDescription>
              Copy the public link or jump straight into WhatsApp with a pre-filled message.
            </DialogDescription>
          </DialogHeader>
          {shareTarget ? <ShareDialogContent album={shareTarget} onClose={() => setShareTarget(null)} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Delete album</DialogTitle>
            <DialogDescription>
              This will permanently remove the album and its stickers. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <span>
              Album: <span className="font-medium text-foreground">{deleteTarget?.name}</span>
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="rounded-2xl"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-2xl"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete album'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

type ShareDialogContentProps = {
  album: AlbumListItem;
  onClose: () => void;
};

function ShareDialogContent({ album, onClose }: ShareDialogContentProps) {
  const baseUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return resolveAppUrl();
  }, []);

  const normalizedBase = useMemo(() => baseUrl.replace(/\/$/, ''), [baseUrl]);
  const publicUrl = `${normalizedBase}/p/${album.slug}`;
  const message = useMemo(
    () => buildWaMessage({ albumName: album.name, albumUrl: publicUrl }),
    [album.name, publicUrl],
  );
  const waUrl = useMemo(() => buildWaUrl({ message }), [message]);
  const shareWarning = album.visibility === 'private';

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{album.name}</p>
        <p className="text-xs text-muted-foreground">
          {album.stickersCount > 0
            ? `${album.stickersCount} stickers ready to share.`
            : 'Add stickers to this album to make the share richer.'}
        </p>
      </div>
      {shareWarning ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
          Set this album to <strong>public</strong> or <strong>unlisted</strong> so friends can open the link.
        </div>
      ) : null}
      <ShareButtons publicUrl={publicUrl} waUrl={waUrl} />
      <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">WhatsApp message preview</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{message}</p>
      </div>
      <div className="flex justify-end">
        <Button type="button" className="rounded-2xl" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

function AlbumGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-64 w-full rounded-3xl" />
      ))}
    </div>
  );
}
