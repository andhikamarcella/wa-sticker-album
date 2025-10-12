import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import Providers from '@/components/Providers';
import AlbumDetailShell, { type AlbumCollaborator } from '@/components/AlbumDetailShell';
import type { AlbumVisibility } from '@/components/AlbumCard';
import { isSupabaseConfigured, resolveAppUrl } from '@/lib/env';
import { mockFindAlbumBySlug } from '@/lib/mockDb';
import { getServerClient, type SupabaseServerClient } from '@/lib/supabaseServer';
import { cn, SupabaseSchemaMissingError, shouldUseMockFromSupabaseError } from '@/lib/utils';

const MAX_MESSAGES = 200;

interface AlbumRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  visibility: AlbumVisibility;
}

interface CollaboratorRow {
  user_id: string;
}

interface ProfileRow {
  id: string;
  name: string | null;
}

interface StickerRow {
  id: string;
  file_url: string;
  thumb_url: string | null;
  title: string | null;
}

interface PackRow {
  id: string;
  exported_zip_url: string | null;
  public_url: string | null;
  wa_share_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface MessageRow {
  id: string;
  album_id: string;
  user_id: string;
  display_name: string | null;
  body: string;
  created_at: string | null;
}

interface PublicAlbumData {
  album: { id: string; name: string; slug: string; visibility: AlbumVisibility };
  stickers: Array<{ id: string; fileUrl: string; thumbUrl: string | null; title: string | null }>;
  latestPack: { id: string; exportedZipUrl: string | null; publicUrl: string | null; waShareUrl: string | null } | null;
  messages: Array<{ id: string; displayName: string | null; body: string; createdAt: string | null }>;
  visibility: AlbumVisibility;
}

async function fetchAlbumForMetadata(slug: string): Promise<{ name: string; visibility: AlbumVisibility } | null> {
  if (!isSupabaseConfigured()) {
    const album = mockFindAlbumBySlug(slug);
    if (!album || album.visibility === 'private') return null;
    return { name: album.name, visibility: album.visibility };
  }

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from('albums')
    .select('id, name, slug, visibility')
    .eq('slug', slug)
    .maybeSingle<Pick(AlbumRow, 'id' | 'name' | 'slug' | 'visibility')>();

  if (error) {
    if (error.code === 'PGRST116' || error.code === '42501') return null;
    if (shouldUseMockFromSupabaseError(error)) throw new SupabaseSchemaMissingError(error.message);
    throw error;
  }

  if (!data || data.visibility === 'private') return null;
  return { name: data.name, visibility: data.visibility };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  let album: { name: string; visibility: AlbumVisibility } | null = null;

  try {
    album = await fetchAlbumForMetadata(params.slug);
  } catch (error) {
    if (error instanceof SupabaseSchemaMissingError || shouldUseMockFromSupabaseError(error)) {
      const mockAlbum = mockFindAlbumBySlug(params.slug);
      album = mockAlbum && mockAlbum.visibility !== 'private'
        ? { name: mockAlbum.name, visibility: mockAlbum.visibility }
        : null;
    } else {
      throw error;
    }
  }

  if (!album) return { title: 'Album tidak ditemukan · WA Sticker Album', robots: { index: false, follow: false } };

  return {
    title: `${album.name} · WA Sticker Album`,
    robots: album.visibility === 'unlisted' ? { index: false, follow: true } : undefined,
    alternates: { canonical: `${resolveAppUrl().replace(/\/$/, '')}/albums/${params.slug}` },
  } satisfies Metadata;
}

export default async function AlbumPage({ params }: { params: { slug: string } }) {
  if (!isSupabaseConfigured()) return renderMockAlbum(params.slug);

  try {
    const supabase = getServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('id, owner_id, name, slug, visibility')
      .eq('slug', params.slug)
      .maybeSingle<AlbumRow>();

    if (albumError) {
      if (albumError.code === 'PGRST116' || albumError.code === '42501') notFound();
      if (shouldUseMockFromSupabaseError(albumError)) throw new SupabaseSchemaMissingError(albumError.message);
      throw albumError;
    }

    if (!album || album.visibility === 'private') notFound();

    const baseUrl = resolveAppUrl().replace(/\/$/, '');

    const collaboratorIds = new Set<string>();
    let collaborators: AlbumCollaborator[] = [];
    let isOwner = false;
    let canEdit = false;

    if (user) {
      const { data: collaboratorRows, error: collaboratorError } = await supabase
        .from('album_collaborators' as const)
        .select('user_id')
        .eq('album_id', album.id);

      if (collaboratorError) {
        if (shouldUseMockFromSupabaseError(collaboratorError)) throw new SupabaseSchemaMissingError(collaboratorError.message);
        throw collaboratorError;
      }

      for (const row of (collaboratorRows as CollaboratorRow[] | null) ?? []) collaboratorIds.add(row.user_id);

      isOwner = album.owner_id === user.id;
      canEdit = isOwner || collaboratorIds.has(user.id);

      if (canEdit) {
        const profileIds = new Set<string>([album.owner_id, ...collaboratorIds]);
        let profileMap = new Map<string, ProfileRow>();

        if (profileIds.size > 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', Array.from(profileIds));

          if (profileError) {
            if (shouldUseMockFromSupabaseError(profileError)) throw new SupabaseSchemaMissingError(profileError.message);
            throw profileError;
          }

          profileMap = new Map<string, ProfileRow>(((profileRows as ProfileRow[] | null) ?? []).map((row) => [row.id, row]));
        }

        collaborators = [
          {
            id: album.owner_id,
            name: profileMap.get(album.owner_id)?.name ?? resolveUserLabel(user) ?? album.owner_id,
            role: 'owner',
            email: user.email ?? undefined,
          },
        ];

        for (const collaboratorId of collaboratorIds) {
          if (collaboratorId === album.owner_id) continue;
          const profile = profileMap.get(collaboratorId);
          collaborators.push({ id: collaboratorId, name: profile?.name ?? collaboratorId, role: 'collaborator', email: undefined });
        }

        return (
          <Providers>
            <AlbumDetailShell
              albumId={album.id}
              initialName={album.name}
              initialVisibility={album.visibility}
              initialSlug={album.slug}
              canEdit
              isOwner={isOwner}
              userLabel={resolveUserLabel(user)}
              collaborators={collaborators}
              publicBaseUrl={baseUrl}
              isMockMode={false}
              viewerId={user.id}
            />
          </Providers>
        );
      }
    }

    const publicData = await loadSupabasePublicAlbum(supabase, album);
    return <PublicAlbumView data={publicData} />;
  } catch (error) {
    if (error instanceof SupabaseSchemaMissingError || shouldUseMockFromSupabaseError(error)) {
      return renderMockAlbum(params.slug);
    }
    throw error;
  }
}

async function renderMockAlbum(slug: string) {
  const album = mockFindAlbumBySlug(slug);
  if (!album || album.visibility === 'private') notFound();

  const baseUrl = resolveAppUrl().replace(/\/$/, '');
  const collaborators: AlbumCollaborator[] = [{ id: album.ownerId, name: 'Demo Owner', role: 'owner', email: 'demo@example.com' }];

  return (
    <Providers>
      <AlbumDetailShell
        albumId={album.id}
        initialName={album.name}
        initialVisibility={album.visibility}
        initialSlug={album.slug}
        canEdit
        isOwner
        userLabel="Demo Owner"
        collaborators={collaborators}
        publicBaseUrl={baseUrl}
        isMockMode
        viewerId={album.ownerId}
      />
    </Providers>
  );
}

function PublicAlbumView({ data }: { data: PublicAlbumData }) {
  const { album, stickers, latestPack, messages, visibility } = data;
  const hasPublishedPack = Boolean(latestPack?.publicUrl);
  const hasDownload = Boolean(latestPack?.exportedZipUrl);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-6 rounded-3xl border border-border/80 bg-background/70 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Sticker Album</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{album.name}</h1>
          </div>
          <VisibilityBadge visibility={visibility} />
        </div>
        {hasPublishedPack && latestPack?.waShareUrl && (
          <div className="flex flex-col gap-3 rounded-2xl bg-emerald-500/10 p-4 text-emerald-900 dark:text-emerald-100 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide">Sticker pack tersedia</p>
              <p className="text-sm text-emerald-900/80 dark:text-emerald-50/80">Bagikan pack ini ke WhatsApp atau unduh file ZIP-nya.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <a
                href={latestPack.waShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                Add to WhatsApp
              </a>
              {hasDownload && latestPack.exportedZipUrl && (
                <a
                  href={latestPack.exportedZipUrl}
                  target={latestPack.exportedZipUrl.startsWith('data:') ? undefined : '_blank'}
                  rel={latestPack.exportedZipUrl.startsWith('data:') ? undefined : 'noopener noreferrer'}
                  download={latestPack.exportedZipUrl.startsWith('data:') ? 'sticker-pack.zip' : undefined}
                  className="inline-flex items-center justify-center rounded-2xl border border-emerald-500/70 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-200"
                >
                  Download ZIP
                </a>
              )}
            </div>
          </div>
        )}
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Stickers</h2>
          <span className="text-sm text-muted-foreground">{stickers.length} sticker</span>
        </div>
        {stickers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
            Album ini belum memiliki sticker.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {stickers.map((sticker) => (
              <div key={sticker.id} className="relative aspect-square overflow-hidden rounded-3xl bg-muted">
                <Image
                  src={sticker.thumbUrl ?? sticker.fileUrl}
                  alt={sticker.title ?? 'Sticker'}
                  fill
                  sizes="(min-width: 1024px) 18vw, (min-width: 640px) 28vw, 40vw"
                  className="object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Obrolan</h2>
        {messages.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            Belum ada percakapan untuk album ini.
          </div>
        ) : (
          <div className="rounded-3xl border border-border/80 bg-card/80 shadow-sm">
            <ul className="divide-y divide-border/60">
              {messages.map((message) => (
                <li key={message.id} className="px-5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-medium">{message.displayName ?? 'Anonim'}</div>
                    {message.createdAt && (
                      <time className="text-xs text-muted-foreground" dateTime={message.createdAt}>
                        {formatDate(message.createdAt)}
                      </time>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message.body}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function VisibilityBadge({ visibility }: { visibility: AlbumVisibility }) {
  const config: Record<AlbumVisibility, { label: string; className: string }> = {
    public: { label: 'Public', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    unlisted: { label: 'Unlisted', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    private: { label: 'Private', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
  };
  const badge = config[visibility];
  return (
    <span className={cn('inline-flex items-center rounded-full border border-transparent px-3 py-1 text-sm font-medium', badge.className)}>
      {badge.label}
    </span>
  );
}

async function loadSupabasePublicAlbum(supabase: SupabaseServerClient, album: AlbumRow): Promise<PublicAlbumData> {
  const { data: stickerRows, error: stickerError } = await supabase
    .from('stickers')
    .select('id, file_url, thumb_url, title')
    .eq('album_id', album.id)
    .order('sort_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (stickerError) {
    if (shouldUseMockFromSupabaseError(stickerError)) throw new SupabaseSchemaMissingError(stickerError.message);
    throw stickerError;
  }

  const { data: packRows, error: packError } = await supabase
    .from('packs')
    .select('id, exported_zip_url, public_url, wa_share_url, created_at, updated_at')
    .eq('album_id', album.id)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });

  if (packError && packError.code !== 'PGRST116') {
    if (shouldUseMockFromSupabaseError(packError)) throw new SupabaseSchemaMissingError(packError.message);
    throw packError;
  }

  const { data: messageRows, error: messageError } = await supabase
    .from('messages')
    .select('id, album_id, user_id, display_name, body, created_at')
    .eq('album_id', album.id)
    .order('created_at', { ascending: true })
    .limit(MAX_MESSAGES);

  if (messageError && messageError.code !== 'PGRST116') {
    if (shouldUseMockFromSupabaseError(messageError)) throw new SupabaseSchemaMissingError(messageError.message);
    throw messageError;
  }

  const stickers = ((stickerRows as StickerRow[] | null) ?? []).map((row) => ({
    id: row.id,
    fileUrl: row.file_url,
    thumbUrl: row.thumb_url,
    title: row.title,
  }));

  const latestPack = selectLatestPack((packRows as PackRow[] | null) ?? []);
  const messages = ((messageRows as MessageRow[] | null) ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    body: row.body,
    createdAt: row.created_at,
  }));

  return {
    album: { id: album.id, name: album.name, slug: album.slug, visibility: album.visibility },
    stickers,
    latestPack,
    messages,
    visibility: album.visibility,
  };
}

function selectLatestPack(rows: PackRow[]): PublicAlbumData['latestPack'] {
  if (!rows || rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
  const pack = sorted[0];
  return {
    id: pack.id,
    exportedZipUrl: pack.exported_zip_url ?? null,
    publicUrl: pack.public_url ?? null,
    waShareUrl: pack.wa_share_url ?? null,
  };
}

function formatDate(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function resolveUserLabel(user: User): string | null {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name : undefined;
  if (fullName && fullName.trim().length > 0) return fullName.trim();

  const displayName = typeof metadata.display_name === 'string' ? metadata.display_name : undefined;
  if (displayName && displayName.trim().length > 0) return displayName.trim();

  if (user.email && user.email.length > 0) return user.email;
  if (user.phone && user.phone.length > 0) return user.phone;
  return null;
}
