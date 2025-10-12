'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { UploadDropzone } from '@/components/UploadDropzone';
import { StickerGrid } from '@/components/StickerGrid';
import { PackBuilder } from '@/components/PackBuilder';
import { ShareButtons } from '@/components/ShareButtons';
import { QRCodeCard } from '@/components/QRCodeCard';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabaseClient';
import type { AlbumVisibility } from '@/components/AlbumCard';

export type AlbumCollaborator = {
  id: string;
  name: string | null;
  role: 'owner' | 'collaborator';
  email?: string | null;
};

type AlbumDetailShellProps = {
  albumId: string;
  initialName: string;
  initialVisibility: AlbumVisibility;
  initialSlug: string;
  canEdit: boolean;
  isOwner: boolean;
  userLabel: string | null;
  collaborators: AlbumCollaborator[];
  publicBaseUrl: string;
  isMockMode: boolean;
  viewerId: string;
};

type UpdateAlbumResponse = {
  id: string;
  name: string;
  slug: string;
  visibility: AlbumVisibility;
  updatedAt: string;
};

type MessageRow = {
  id: string;
  album_id: string;
  user_id: string;
  display_name: string | null;
  body: string;
  created_at: string | null;
};

type MessageListResponse = {
  data: MessageRow[];
};

const visibilityConfig: Record<AlbumVisibility, { label: string; badgeClass: string; blurb: string }> = {
  public: {
    label: 'Public',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blurb: 'Everyone with the link can find and view this album.',
  },
  unlisted: {
    label: 'Unlisted',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    blurb: 'Only people with the link can access the album.',
  },
  private: {
    label: 'Private',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    blurb: 'Restricted to invited collaborators only.',
  },
};

const visibilityOptions: { value: AlbumVisibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'private', label: 'Private' },
];

const TABS = ['stickers', 'pack', 'share', 'settings', 'chat'] as const;

type TabValue = (typeof TABS)[number];

export default function AlbumDetailShell(props: AlbumDetailShellProps) {
  const {
    albumId,
    initialName,
    initialVisibility,
    initialSlug,
    canEdit,
    isOwner,
    userLabel,
    collaborators,
    publicBaseUrl,
    isMockMode,
    viewerId,
  } = props;

  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabValue>('stickers');
  const [albumName, setAlbumName] = useState(initialName);
  const [albumVisibility, setAlbumVisibility] = useState<AlbumVisibility>(initialVisibility);
  const [slug, setSlug] = useState(initialSlug);

  const [settingsName, setSettingsName] = useState(initialName);
  const [settingsVisibility, setSettingsVisibility] = useState<AlbumVisibility>(initialVisibility);
  const [inviteEmail, setInviteEmail] = useState('');

  const shareUrl = useMemo(() => {
    const normalizedBase = publicBaseUrl.replace(/\/$/, '');
    return `${normalizedBase}/albums/${slug}`;
  }, [publicBaseUrl, slug]);

  useEffect(() => {
    setSettingsName(initialName);
  }, [initialName]);

  useEffect(() => {
    setSettingsVisibility(initialVisibility);
  }, [initialVisibility]);

  const updateMutation = useMutation<UpdateAlbumResponse, Error, { name?: string; visibility?: AlbumVisibility }>(
    {
      mutationFn: async (payload) => {
        const response = await fetch(`/api/albums/${albumId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error((errorBody as { error?: string }).error ?? 'Failed to update album');
        }

        return (await response.json()) as UpdateAlbumResponse;
      },
      onSuccess: (payload) => {
        setAlbumName(payload.name);
        setAlbumVisibility(payload.visibility);
        setSlug(payload.slug);
        setSettingsName(payload.name);
        setSettingsVisibility(payload.visibility);

        queryClient.invalidateQueries({ queryKey: ['albums'] }).catch(() => undefined);
        showToast({ title: 'Album updated', variant: 'success' });
      },
      onError: (error) => {
        showToast({
          title: 'Unable to update album',
          description: error.message,
          variant: 'destructive',
        });
      },
    },
  );

  const handleSettingsSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!isOwner) {
        showToast({
          title: 'Only the owner can change settings',
          variant: 'destructive',
        });
        return;
      }

      const trimmedName = settingsName.trim();
      const payload: { name?: string; visibility?: AlbumVisibility } = {};

      if (trimmedName.length > 0 && trimmedName !== albumName) {
        payload.name = trimmedName;
      }

      if (settingsVisibility !== albumVisibility) {
        payload.visibility = settingsVisibility;
      }

      if (!payload.name && !payload.visibility) {
        showToast({
          title: 'No changes detected',
          description: 'Update the name or visibility before saving.',
        });
        return;
      }

      updateMutation.mutate(payload);
    },
    [albumName, albumVisibility, isOwner, settingsName, settingsVisibility, showToast, updateMutation],
  );

  const handleInviteSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = inviteEmail.trim();
      if (trimmed.length === 0) {
        return;
      }

      showToast({
        title: 'Invitation not yet available',
        description: isMockMode
          ? 'Collaborator invites are disabled in mock mode.'
          : 'This feature will be available soon.',
      });
      setInviteEmail('');
    },
    [inviteEmail, isMockMode, showToast],
  );

  const headerBadge = visibilityConfig[albumVisibility];

  return (
    <div className="space-y-10 pb-16">
      <header className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{albumName}</h1>
            <Badge className={cn('flex items-center gap-1 border-none px-3 py-1 text-xs', headerBadge.badgeClass)}>
              {headerBadge.label}
            </Badge>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">{headerBadge.blurb}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="rounded-full"
            type="button"
            onClick={() => setActiveTab('share')}
          >
            Share
          </Button>
          <Button className="rounded-full" type="button" onClick={() => setActiveTab('settings')}>
            Edit
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)} className="space-y-6">
        <TabsList className="w-full justify-start gap-2 overflow-x-auto rounded-full bg-muted/60 p-1">
          <TabsTrigger value="stickers" className="rounded-full px-4 py-2">
            Stickers
          </TabsTrigger>
          <TabsTrigger value="pack" className="rounded-full px-4 py-2">
            Pack
          </TabsTrigger>
          <TabsTrigger value="share" className="rounded-full px-4 py-2">
            Share
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-full px-4 py-2">
            Settings
          </TabsTrigger>
          <TabsTrigger value="chat" className="rounded-full px-4 py-2">
            Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stickers" className="space-y-6 focus-visible:outline-none">
          {canEdit ? (
            <UploadDropzone albumId={albumId} />
          ) : (
            <div className="rounded-3xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
              You do not have permission to upload stickers to this album.
            </div>
          )}
          <StickerGrid albumId={albumId} />
        </TabsContent>

        <TabsContent value="pack" className="focus-visible:outline-none">
          {canEdit ? (
            <PackBuilder albumId={albumId} />
          ) : (
            <div className="rounded-3xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
              Only editors can build sticker packs for this album.
            </div>
          )}
        </TabsContent>

        <TabsContent value="share" className="space-y-6 focus-visible:outline-none">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
            <ShareButtons publicUrl={shareUrl} />
            <QRCodeCard url={shareUrl} />
          </div>
          <Card className="rounded-3xl border border-border/80 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Publish a pack to unlock a WhatsApp share link instantly.</p>
              <p>
                Unlisted albums stay hidden from search engines. Private albums require collaborators to log in before viewing.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 focus-visible:outline-none">
          <form
            className="space-y-5 rounded-3xl border border-border bg-card/80 p-6 shadow-sm"
            onSubmit={handleSettingsSubmit}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="album-name">
                Album name
              </label>
              <Input
                id="album-name"
                value={settingsName}
                onChange={(event) => setSettingsName(event.target.value)}
                placeholder="Album name"
                disabled={updateMutation.isPending || !isOwner}
              />
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">Visibility</span>
              <div className="grid gap-3 sm:grid-cols-3">
                {visibilityOptions.map((option) => {
                  const active = settingsVisibility === option.value;
                  const config = visibilityConfig[option.value];
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSettingsVisibility(option.value)}
                      disabled={updateMutation.isPending || !isOwner}
                      className={cn(
                        'flex flex-col items-start gap-2 rounded-2xl border border-border bg-background/80 p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                        active ? 'border-primary shadow-sm' : 'hover:border-primary/60',
                      )}
                    >
                      <span className="text-sm font-semibold text-foreground">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{config.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="submit" className="rounded-full sm:w-auto" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>

          <section className="space-y-4 rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Collaborators</h2>
                <p className="text-sm text-muted-foreground">
                  Invite teammates to upload stickers and chat together.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {collaborators.map((collaborator) => (
                <div
                  key={collaborator.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/60 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                      {collaborator.name?.charAt(0)?.toUpperCase() ?? collaborator.id.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{collaborator.name ?? collaborator.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {collaborator.email ?? (collaborator.role === 'owner' ? 'Owner' : 'Collaborator')}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    {collaborator.role === 'owner' ? 'Owner' : 'Collaborator'}
                  </span>
                </div>
              ))}
            </div>
            <form className="space-y-3" onSubmit={handleInviteSubmit}>
              <Input
                type="email"
                placeholder="Add collaborator by email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                disabled={!isOwner}
              />
              <Button type="submit" className="rounded-full" disabled={!isOwner}>
                Send invite
              </Button>
              {!isOwner ? (
                <p className="text-xs text-muted-foreground">Only the owner can invite new collaborators.</p>
              ) : null}
            </form>
          </section>
        </TabsContent>

        <TabsContent value="chat" className="focus-visible:outline-none">
          <AlbumChatPanel
            albumId={albumId}
            displayName={userLabel}
            canSend={canEdit}
            isMockMode={isMockMode}
            viewerId={viewerId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type ChatPanelProps = {
  albumId: string;
  displayName: string | null;
  canSend: boolean;
  isMockMode: boolean;
  viewerId: string;
};

function AlbumChatPanel({ albumId, displayName, canSend, isMockMode, viewerId }: ChatPanelProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState('');
  const supabase = useMemo(() => createClient(), []);

  const queryKey = useMemo(() => ['album', albumId, 'messages'] as const, [albumId]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<MessageListResponse, Error>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`/api/albums/${albumId}/messages?limit=200`, { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load messages';
        throw new Error(message);
      }

      return (await response.json()) as MessageListResponse;
    },
    refetchOnWindowFocus: false,
    refetchInterval: supabase ? false : 15000,
  });

  const messages = useMemo(() => data?.data ?? [], [data]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel(`album-messages-${albumId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `album_id=eq.${albumId}` },
        (payload) => {
          const newMessage = payload.new as MessageRow;
          queryClient.setQueryData<MessageListResponse>(queryKey, (current) => {
            const existing = current?.data ?? [];
            if (existing.some((item) => item.id === newMessage.id)) {
              return current ?? { data: existing };
            }

            const next = [...existing, newMessage];
            return { data: next };
          });
          requestAnimationFrame(() => {
            if (listRef.current) {
              listRef.current.scrollTop = listRef.current.scrollHeight;
            }
          });
        },
      );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [albumId, queryClient, queryKey, supabase]);

  const mutation = useMutation<
    MessageRow,
    Error,
    { body: string; tempId: string },
    { previous?: MessageListResponse; tempId: string; body: string }
  >({
    mutationFn: async ({ body }) => {
      const response = await fetch(`/api/albums/${albumId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(displayName ? { 'x-profile-name': displayName } : {}),
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to send message';
        throw new Error(message);
      }

      return (await response.json()) as MessageRow;
    },
    onMutate: async ({ body, tempId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MessageListResponse>(queryKey);
      const optimistic: MessageRow = {
        id: tempId,
        album_id: albumId,
        user_id: viewerId,
        display_name: displayName ?? 'You',
        body,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<MessageListResponse>(queryKey, {
        data: [...(previous?.data ?? []), optimistic],
      });

      setMessage('');
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });

      return { previous, tempId, body };
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      showToast({ title: 'Unable to send message', description: err.message, variant: 'destructive' });
      if (context?.body) {
        setMessage(context.body);
      }
    },
    onSuccess: (payload, _variables, context) => {
      queryClient.setQueryData<MessageListResponse>(queryKey, (current) => {
        const base = current?.data ?? [];
        const filtered = base.filter((item) => item.id !== context?.tempId);
        if (filtered.some((item) => item.id === payload.id)) {
          return { data: filtered };
        }
        return { data: [...filtered, payload] };
      });
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey }).catch(() => undefined);
    },
  });

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSend) {
        showToast({ title: 'You cannot send messages in this album', variant: 'destructive' });
        return;
      }

      const trimmed = message.trim();
      if (trimmed.length === 0) {
        return;
      }

      if (trimmed.length > 500) {
        showToast({ title: 'Message too long', description: 'Keep messages under 500 characters.', variant: 'destructive' });
        return;
      }

      const tempId = `temp-${Date.now()}`;
      mutation.mutate({ body: trimmed, tempId });
    },
    [canSend, message, mutation, showToast],
  );

  const remaining = 500 - message.length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
      <div className="flex h-[28rem] flex-col rounded-3xl border border-border bg-card/80 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Album chat</h2>
          {isFetching ? <span className="text-xs text-muted-foreground">Refreshing…</span> : null}
        </div>
        <div
          ref={listRef}
          className="mt-4 flex-1 space-y-3 overflow-y-auto pr-2"
        >
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            ))
          ) : isError ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error?.message ?? 'Failed to load messages'}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                Try again
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
              {isMockMode ? 'Start the conversation by sending the first message.' : 'Say hello to your collaborators!'}
            </div>
          ) : (
            messages.map((messageItem) => {
              const isMine = messageItem.user_id === viewerId;
              return (
                <div key={messageItem.id} className={cn('flex flex-col gap-1', isMine ? 'items-end text-right' : 'items-start text-left')}>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {messageItem.display_name ?? (isMine ? 'You' : 'Anonymous')}
                    </span>
                    <span>{formatTimestamp(messageItem.created_at)}</span>
                  </div>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm',
                      isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                    )}
                  >
                    {messageItem.body}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={canSend ? 'Type your message…' : 'You do not have permission to chat.'}
            maxLength={500}
            disabled={!canSend || mutation.isPending}
            className="min-h-[120px] rounded-2xl"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{remaining} characters left</span>
            <Button type="submit" disabled={!canSend || mutation.isPending || message.trim().length === 0}>
              {mutation.isPending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </form>
      </div>
      <aside className="space-y-4 rounded-3xl border border-border bg-card/60 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Conversation tips</h3>
        <ul className="list-disc space-y-2 pl-4 text-xs text-muted-foreground">
          <li>Keep feedback constructive so everyone can build better sticker packs.</li>
          <li>Messages are visible to all collaborators with access.</li>
          <li>Lost connection? Messages will sync automatically when you are back online.</li>
        </ul>
      </aside>
    </div>
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
