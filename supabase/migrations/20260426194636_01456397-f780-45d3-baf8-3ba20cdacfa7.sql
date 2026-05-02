-- Tighten incident updates: require authentication.
drop policy if exists "Anyone can change status or responders" on public.incidents;

create policy "Authenticated users can change status or responders"
  on public.incidents for update
  to authenticated
  using (status <> 'resolved')
  with check (status in ('active','investigating','resolved'));

-- Restrict user_roles SELECT to own row + admins only.
drop policy if exists "Roles viewable by authenticated users" on public.user_roles;

create policy "Users see their own role"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));