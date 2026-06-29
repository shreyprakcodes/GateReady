create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  trip_id    uuid references public.trips(id) on delete cascade,
  type       text check (type in ('delay', 'gate_change', 'cancellation', 'leave_soon')),
  title      text,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Users can read their own notifications
create policy "notifications: select own"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Users can mark their own notifications as read
create policy "notifications: update own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No INSERT policy: the Inngest job inserts via the service role key,
-- which bypasses RLS entirely.
