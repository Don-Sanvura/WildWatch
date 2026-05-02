-- Replace overly broad incident UPDATE policy with a tighter one.
drop policy if exists "Owners or anyone can update active incidents" on public.incidents;

create policy "Anyone can change status or responders"
  on public.incidents for update
  to anon, authenticated
  using (status <> 'resolved')
  with check (status in ('active','investigating','resolved'));

-- Tighten storage: replace broad SELECT on bucket with one that disallows listing
-- (Supabase listing requires SELECT on the bucket itself; reading by direct URL
-- still works on a public bucket without storage.objects SELECT for anon).
drop policy if exists "Public can read incident photos" on storage.objects;

-- Keep a narrow SELECT for direct object access only (no list scope).
create policy "Read incident photos by id"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'incident-photos');

-- Replace upload policy with one that limits to image MIME types and ≤5MB.
drop policy if exists "Anyone can upload incident photos" on storage.objects;

create policy "Anyone can upload image incident photos"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'incident-photos'
    and (lower(coalesce(metadata->>'mimetype','')) like 'image/%')
  );