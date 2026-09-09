-- Chunky Reader only. Existing apps, buckets and policies are left intact.
create table if not exists public.chunky_reader_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  progress_id text not null,
  progress_data jsonb not null,
  updated_at timestamptz not null,
  primary key (user_id, progress_id)
);
alter table public.chunky_reader_progress enable row level security;
grant select, insert, update on public.chunky_reader_progress to authenticated;
revoke all on public.chunky_reader_progress from anon;
create policy reader_progress_select on public.chunky_reader_progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy reader_progress_insert on public.chunky_reader_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy reader_progress_update on public.chunky_reader_progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('chunky-reader-media', 'chunky-reader-media', true, 52428800,
    array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','image/x-icon','audio/mpeg','audio/wav','audio/ogg','audio/mp4','video/mp4','font/woff2','font/woff','application/octet-stream']),
  ('chunky-reader-private', 'chunky-reader-private', false, 10485760,
    array['image/png','image/jpeg','image/webp','audio/mpeg','audio/wav','audio/ogg','text/plain','application/pdf'])
on conflict (id) do nothing;
-- Public media has no client write policies: only the migration/admin uploader can publish it.

create table public.chunky_reader_private_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  learner_id text not null check (learner_id in ('anna','sarah','100-lessons','shared')),
  name text not null check (length(name) between 1 and 200),
  object_path text not null unique,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  content_type text not null,
  bytes bigint not null check (bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  unique(user_id, learner_id, sha256),
  check (object_path = user_id::text || '/' || learner_id || '/' || id::text)
);
alter table public.chunky_reader_private_assets enable row level security;
grant select, insert, delete on public.chunky_reader_private_assets to authenticated;
revoke all on public.chunky_reader_private_assets from anon;
create policy reader_private_select on public.chunky_reader_private_assets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy reader_private_insert on public.chunky_reader_private_assets for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy reader_private_delete on public.chunky_reader_private_assets for delete to authenticated
  using ((select auth.uid()) = user_id);

create function public.reader_private_quota() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (select count(*) from public.chunky_reader_private_assets where user_id = new.user_id) >= 50
     or (select coalesce(sum(bytes),0) from public.chunky_reader_private_assets where user_id = new.user_id) + new.bytes > 52428800 then
    raise exception 'Private library limit reached (50 files / 50 MB).';
  end if;
  return new;
end;
$$;
revoke all on function public.reader_private_quota() from public, anon, authenticated;
create trigger reader_private_quota before insert on public.chunky_reader_private_assets
for each row execute function public.reader_private_quota();

create policy reader_private_object_select on storage.objects for select to authenticated using (
  bucket_id = 'chunky-reader-private' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy reader_private_object_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'chunky-reader-private' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.chunky_reader_private_assets a
    where a.object_path = storage.objects.name and a.user_id = (select auth.uid())
  )
);
create policy reader_private_object_delete on storage.objects for delete to authenticated using (
  bucket_id = 'chunky-reader-private' and (storage.foldername(name))[1] = (select auth.uid())::text
);
