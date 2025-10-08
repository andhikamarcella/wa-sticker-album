create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  role text default 'user',
  created_at timestamptz default now()
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  cover_url text,
  visibility text not null default 'public',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists albums_owner_id_idx on public.albums(owner_id);

create table if not exists public.album_collaborators (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references public.albums(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'editor',
  created_at timestamptz default now()
);

create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  title text,
  orig_url text not null,
  file_url text not null,
  thumb_url text,
  width int,
  height int,
  size_kb int,
  tags text[] default '{}',
  created_at timestamptz default now()
);

create index if not exists stickers_album_id_idx on public.stickers(album_id);

create table if not exists public.packs (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references public.albums(id) on delete cascade,
  name text not null,
  author text,
  exported_zip_url text,
  version text default '1.0.0',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pack_items (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid references public.packs(id) on delete cascade,
  sticker_id uuid references public.stickers(id) on delete cascade,
  order_index int default 0
);

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  kind text not null,
  url text not null,
  qr_png_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.albums enable row level security;
alter table public.album_collaborators enable row level security;
alter table public.stickers enable row level security;
alter table public.packs enable row level security;
alter table public.pack_items enable row level security;
alter table public.shares enable row level security;

-- profiles policies
create policy if not exists "Public read profiles" on public.profiles for select using (true);
create policy if not exists "Users manage own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- albums policies
create policy if not exists "Public read albums" on public.albums
  for select using (
    visibility in ('public', 'unlisted') or owner_id = auth.uid() or exists (
      select 1 from public.album_collaborators ac
      where ac.album_id = albums.id and ac.user_id = auth.uid()
    )
  );
create policy if not exists "Owner insert album" on public.albums
  for insert with check (owner_id = auth.uid());
create policy if not exists "Owner or collaborator update" on public.albums
  for update using (
    owner_id = auth.uid() or exists (
      select 1 from public.album_collaborators ac
      where ac.album_id = albums.id and ac.user_id = auth.uid()
    )
  ) with check (
    owner_id = auth.uid() or exists (
      select 1 from public.album_collaborators ac
      where ac.album_id = albums.id and ac.user_id = auth.uid()
    )
  );
create policy if not exists "Owner delete album" on public.albums
  for delete using (owner_id = auth.uid());

-- album collaborators policies
create policy if not exists "Collaborator access" on public.album_collaborators
  for select using (
    user_id = auth.uid() or exists (
      select 1 from public.albums a where a.id = album_collaborators.album_id and a.owner_id = auth.uid()
    )
  );
create policy if not exists "Owner manage collaborators" on public.album_collaborators
  for all using (
    exists (
      select 1 from public.albums a where a.id = album_collaborators.album_id and a.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.albums a where a.id = album_collaborators.album_id and a.owner_id = auth.uid()
    )
  );

-- stickers policies
create policy if not exists "Read stickers based on album" on public.stickers
  for select using (
    exists (
      select 1 from public.albums a
      where a.id = stickers.album_id and (
        a.visibility in ('public', 'unlisted') or a.owner_id = auth.uid() or exists (
          select 1 from public.album_collaborators ac
          where ac.album_id = a.id and ac.user_id = auth.uid()
        )
      )
    )
  );
create policy if not exists "Manage stickers for album members" on public.stickers
  for all using (
    exists (
      select 1 from public.albums a
      where a.id = stickers.album_id and (
        a.owner_id = auth.uid() or exists (
          select 1 from public.album_collaborators ac
          where ac.album_id = a.id and ac.user_id = auth.uid()
        )
      )
    )
  ) with check (
    exists (
      select 1 from public.albums a
      where a.id = stickers.album_id and (
        a.owner_id = auth.uid() or exists (
          select 1 from public.album_collaborators ac
          where ac.album_id = a.id and ac.user_id = auth.uid()
        )
      )
    )
  );

-- packs policies
create policy if not exists "Read packs matching album policy" on public.packs
  for select using (
    album_id is null or exists (
      select 1 from public.albums a
      where a.id = packs.album_id and (
        a.visibility in ('public', 'unlisted') or a.owner_id = auth.uid() or exists (
          select 1 from public.album_collaborators ac
          where ac.album_id = a.id and ac.user_id = auth.uid()
        )
      )
    )
  );
create policy if not exists "Manage packs for album members" on public.packs
  for all using (
    album_id is null or exists (
      select 1 from public.albums a
      where a.id = packs.album_id and (
        a.owner_id = auth.uid() or exists (
          select 1 from public.album_collaborators ac
          where ac.album_id = a.id and ac.user_id = auth.uid()
        )
      )
    )
  ) with check (
    album_id is null or exists (
      select 1 from public.albums a
      where a.id = packs.album_id and (
        a.owner_id = auth.uid() or exists (
          select 1 from public.album_collaborators ac
          where ac.album_id = a.id and ac.user_id = auth.uid()
        )
      )
    )
  );

-- pack items policies
create policy if not exists "Pack items follow pack" on public.pack_items
  for all using (
    exists (
      select 1 from public.packs p
      where p.id = pack_items.pack_id and (
        p.album_id is null or exists (
          select 1 from public.albums a
          where a.id = p.album_id and (
            a.owner_id = auth.uid() or exists (
              select 1 from public.album_collaborators ac
              where ac.album_id = a.id and ac.user_id = auth.uid()
            )
          )
        )
      )
    )
  ) with check (
    exists (
      select 1 from public.packs p
      where p.id = pack_items.pack_id and (
        p.album_id is null or exists (
          select 1 from public.albums a
          where a.id = p.album_id and (
            a.owner_id = auth.uid() or exists (
              select 1 from public.album_collaborators ac
              where ac.album_id = a.id and ac.user_id = auth.uid()
            )
          )
        )
      )
    )
  );

-- shares policies
create policy if not exists "Read shares for public assets" on public.shares
  for select using (true);
create policy if not exists "Manage shares for members" on public.shares
  for all using (
    exists (
      select 1 from public.albums a
      where a.id = shares.target_id and (
        shares.target_type = 'album' and (
          a.owner_id = auth.uid() or exists (
            select 1 from public.album_collaborators ac
            where ac.album_id = a.id and ac.user_id = auth.uid()
          )
        )
      )
    )
    or exists (
      select 1 from public.packs p
      where p.id = shares.target_id and (
        p.album_id is null or exists (
          select 1 from public.albums a
          where a.id = p.album_id and (
            a.owner_id = auth.uid() or exists (
              select 1 from public.album_collaborators ac
              where ac.album_id = a.id and ac.user_id = auth.uid()
            )
          )
        )
      )
    )
  ) with check (
    true
  );
