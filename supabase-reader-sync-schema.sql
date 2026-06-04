create table if not exists public.chunky_reader_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  progress_id text not null,
  progress_data jsonb not null,
  updated_at timestamptz not null,
  primary key (user_id, progress_id)
);

alter table public.chunky_reader_progress enable row level security;

drop policy if exists "Users can read their own chunky reader progress" on public.chunky_reader_progress;
create policy "Users can read their own chunky reader progress"
on public.chunky_reader_progress for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own chunky reader progress" on public.chunky_reader_progress;
create policy "Users can insert their own chunky reader progress"
on public.chunky_reader_progress for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own chunky reader progress" on public.chunky_reader_progress;
create policy "Users can update their own chunky reader progress"
on public.chunky_reader_progress for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
