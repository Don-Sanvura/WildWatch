-- Incidents
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  animal text not null,
  emoji text not null default '🐾',
  severity text not null check (severity in ('critical','high','medium','low')),
  status text not null default 'active' check (status in ('active','investigating','resolved')),
  location text not null,
  reporter text not null,
  reporter_id uuid references auth.users(id) on delete set null,
  description text not null,
  lat double precision,
  lng double precision,
  photo_path text,
  responders integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_incidents_created_at on public.incidents (created_at desc);
create index idx_incidents_status on public.incidents (status);
create index idx_incidents_severity on public.incidents (severity);

alter table public.incidents enable row level security;

create policy "Incidents are viewable by everyone"
  on public.incidents for select
  to anon, authenticated
  using (true);

create policy "Anyone can submit incidents"
  on public.incidents for insert
  to anon, authenticated
  with check (true);

create policy "Owners or anyone can update active incidents"
  on public.incidents for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Owners can delete their incidents"
  on public.incidents for delete
  to authenticated
  using (auth.uid() = reporter_id);

create trigger incidents_set_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();

-- Audit timeline
create table public.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  kind text not null check (kind in ('reported','investigating','resolved','responder','note')),
  label text not null,
  detail text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_incident_events_incident on public.incident_events (incident_id, created_at);

alter table public.incident_events enable row level security;

create policy "Events are viewable by everyone"
  on public.incident_events for select
  to anon, authenticated
  using (true);

create policy "Anyone can append events"
  on public.incident_events for insert
  to anon, authenticated
  with check (true);

-- Realtime
alter publication supabase_realtime add table public.incidents;
alter publication supabase_realtime add table public.incident_events;

-- Storage bucket for photos (public read)
insert into storage.buckets (id, name, public)
values ('incident-photos', 'incident-photos', true)
on conflict (id) do nothing;

create policy "Public can read incident photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'incident-photos');

create policy "Anyone can upload incident photos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'incident-photos');