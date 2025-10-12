import { redirect, notFound } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import Providers from '@/components/Providers';
import AlbumDetailShell, { type AlbumCollaborator } from '@/components/AlbumDetailShell';
import { isSupabaseConfigured, resolveAppUrl } from '@/lib/env';
import { mockFindAlbumBySlug } from '@/lib/mockDb';
import { getServerClient } from '@/lib/supabaseServer';

type AlbumVisibility = 'public' | 'unlisted' | 'private';

type AlbumRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  visibility: AlbumVisibility;
};

type CollaboratorRow = {
  user_id: string;
};

type ProfileRow = {
  id: string;
  name: string | null;
};

function resolveUserLabel(user: User): string | null {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name : undefined;
  if (fullName && fullName.trim().length > 0) {
    return fullName.trim();
  }

  const displayName = typeof metadata.display_name === 'string' ? metadata.display_name : undefined;
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim();
  }

  if (user.email && user.email.length > 0) {
    return user.email;
  }

  if (user.phone && user.phone.length > 0) {
    return user.phone;
  }

  return null;
}

export default async function AlbumPage({ params }: { params: { slug: string } }) {
  const baseUrl = resolveAppUrl().replace(/\/$/, '');

  if (!isSupabaseConfigured()) {
    const album = mockFindAlbumBySlug(params.slug);
    if (!album) {
      notFound();
    }

    const collaborators: AlbumCollaborator[] = [
      {
        id: album.ownerId,
        name: 'Demo Owner',
        role: 'owner',
        email: 'demo@example.com',
      },
    ];

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

  const supabase = getServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    redirect('/login');
  }

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('id, owner_id, name, slug, visibility')
    .eq('slug', params.slug)
    .maybeSingle<AlbumRow>();

  if (albumError) {
    if (albumError.code === 'PGRST116' || albumError.code === '42501') {
      notFound();
    }

    throw albumError;
  }

  if (!album) {
    notFound();
  }

  const { data: collaboratorRows, error: collaboratorError } = await supabase
    .from('album_collaborators' as const)
    .select('user_id')
    .eq('album_id', album.id);

  if (collaboratorError) {
    throw collaboratorError;
  }

  const collaboratorIds = new Set<string>((collaboratorRows as CollaboratorRow[] | null)?.map((row) => row.user_id) ?? []);
  const isOwner = album.owner_id === user.id;
  const canEdit = isOwner || collaboratorIds.has(user.id);

  if (!canEdit && album.visibility === 'private') {
    notFound();
  }

  const profileIds = new Set<string>([album.owner_id, ...collaboratorIds]);
  let profileMap = new Map<string, ProfileRow>();

  if (profileIds.size > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', Array.from(profileIds));

    if (profileError) {
      throw profileError;
    }

    profileMap = new Map<string, ProfileRow>(
      ((profileRows as ProfileRow[] | null) ?? []).map((row) => [row.id, row]),
    );
  }

  const collaborators: AlbumCollaborator[] = [
    {
      id: album.owner_id,
      name: profileMap.get(album.owner_id)?.name ?? resolveUserLabel(user) ?? album.owner_id,
      role: 'owner',
      email: isOwner ? user.email ?? undefined : undefined,
    },
  ];

  for (const collaboratorId of collaboratorIds) {
    if (collaboratorId === album.owner_id) {
      continue;
    }

    const profile = profileMap.get(collaboratorId);
    collaborators.push({
      id: collaboratorId,
      name: profile?.name ?? collaboratorId,
      role: 'collaborator',
      email: undefined,
    });
  }

  return (
    <Providers>
      <AlbumDetailShell
        albumId={album.id}
        initialName={album.name}
        initialVisibility={album.visibility}
        initialSlug={album.slug}
        canEdit={canEdit}
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
