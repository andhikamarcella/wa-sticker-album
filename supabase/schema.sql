-- profiles (opsional untuk nama)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text unique,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- albums
create table if not exists albums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  cover_url text,
  visibility text not null default 'private', -- 'public' | 'unlisted' | 'private'
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- album_collaborators (edit access)
create table if not exists album_collaborators (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unique(album_id, user_id)
);

-- stickers
create table if not exists stickers (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  file_url text not null,
  thumb_url text,
  title text,
  size_kb int,
  sort_index int not null default 0,
  created_at timestamp with time zone default now()
);

-- packs
create table if not exists packs (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  author text,
  exported_zip_url text,
  public_url text,
  wa_share_url text,
  created_at timestamp with time zone default now()
);

-- pack_stickers (urutan sticker dalam pack)
create table if not exists pack_stickers (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references packs(id) on delete cascade,
  sticker_id uuid not null references stickers(id) on delete cascade,
  ord int not null
);

-- indexes
create index if not exists idx_albums_slug on albums(slug);
create index if not exists idx_stickers_album on stickers(album_id);

-- RLS
alter table profiles enable row level security;
alter table albums enable row level security;
alter table album_collaborators enable row level security;
alter table stickers enable row level security;
alter table packs enable row level security;
alter table pack_stickers enable row level security;

-- policies (ringkas):
-- profiles
create policy "read own profile" on profiles for select using (auth.uid() = id);
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "update own profile" on profiles for update using (auth.uid() = id);

-- albums
create policy "read public or member" on albums for select using (
  visibility in ('public','unlisted') or owner_id = auth.uid() or
  exists(select 1 from album_collaborators c where c.album_id = albums.id and c.user_id = auth.uid())
);
create policy "insert own album" on albums for insert with check (owner_id = auth.uid());
create policy "update own or collaborator" on albums for update using (
  owner_id = auth.uid() or exists(select 1 from album_collaborators c where c.album_id = albums.id and c.user_id = auth.uid())
);
create policy "delete own album" on albums for delete using (owner_id = auth.uid());

-- album_collaborators
create policy "read collab if member" on album_collaborators for select using (
  exists(select 1 from albums a where a.id = album_collaborators.album_id
    and (a.owner_id = auth.uid() or exists(select 1 from album_collaborators c where c.album_id = a.id and c.user_id = auth.uid())))
);
create policy "manage collab owner only" on album_collaborators for all using (
  exists(select 1 from albums a where a.id = album_collaborators.album_id and a.owner_id = auth.uid())
) with check (
  exists(select 1 from albums a where a.id = album_collaborators.album_id and a.owner_id = auth.uid())
);

-- stickers
create policy "read stickers if can read album" on stickers for select using (
  exists(select 1 from albums a where a.id = stickers.album_id and
    (a.visibility in ('public','unlisted') or a.owner_id = auth.uid() or
     exists(select 1 from album_collaborators c where c.album_id = a.id and c.user_id = auth.uid())))
);
create policy "insert stickers owner or collaborator" on stickers for insert with check (
  owner_id = auth.uid() and
  exists(select 1 from albums a where a.id = stickers.album_id and (a.owner_id = auth.uid()
    or exists(select 1 from album_collaborators c where c.album_id = a.id and c.user_id = auth.uid())))
);
create policy "update/delete stickers owner or collaborator" on stickers for update using (
  owner_id = auth.uid()
) with check (owner_id = auth.uid());
create policy "delete stickers owner or collaborator using album" on stickers for delete using (
  exists(select 1 from albums a where a.id = stickers.album_id and (a.owner_id = auth.uid()
    or exists(select 1 from album_collaborators c where c.album_id = a.id and c.user_id = auth.uid())))
);

-- packs
create policy "read packs if can read album" on packs for select using (
  exists(select 1 from albums a where a.id = packs.album_id and
    (a.visibility in ('public','unlisted') or a.owner_id = auth.uid() or
     exists(select 1 from album_collaborators c where c.album_id = a.id and c.user_id = auth.uid())))
);
create policy "insert/update/delete packs owner or collaborator" on packs for all using (
  owner_id = auth.uid()
) with check (owner_id = auth.uid());

-- pack_stickers (owner album saja)
create policy "manage pack_stickers owner" on pack_stickers for all using (
  exists(select 1 from packs p where p.id = pack_stickers.pack_id and p.owner_id = auth.uid())
) with check (
  exists(select 1 from packs p where p.id = pack_stickers.pack_id and p.owner_id = auth.uid())
);
