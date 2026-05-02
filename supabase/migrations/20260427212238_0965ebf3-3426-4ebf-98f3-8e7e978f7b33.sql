
-- Tighten incidents UPDATE policy: only owner, responder, or admin
DROP POLICY IF EXISTS "Authenticated users can change status or responders" ON public.incidents;

CREATE POLICY "Owner or staff can update incidents"
ON public.incidents
FOR UPDATE
TO authenticated
USING (
  auth.uid() = reporter_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'responder'::public.app_role)
)
WITH CHECK (
  status = ANY (ARRAY['active','investigating','resolved'])
  AND (
    auth.uid() = reporter_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'responder'::public.app_role)
  )
);

-- incident_events: restrict INSERT to authenticated, tie actor_id, restrict kind
DROP POLICY IF EXISTS "Anyone can append events" ON public.incident_events;

CREATE POLICY "Authenticated users can append their own events"
ON public.incident_events
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND kind = ANY (ARRAY['reported','investigating','resolved','responder','note'])
);

ALTER TABLE public.incident_events
  DROP CONSTRAINT IF EXISTS chk_event_kind;

ALTER TABLE public.incident_events
  ADD CONSTRAINT chk_event_kind
  CHECK (kind IN ('reported','investigating','resolved','responder','note'));

-- Storage policies: restrict to incidents/ folder; allow owner/admin manage
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%incident-photos%' OR with_check ILIKE '%incident-photos%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Incident photos readable under incidents folder"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'incident-photos'
  AND (storage.foldername(name))[1] = 'incidents'
);

CREATE POLICY "Anyone can upload incident photos under incidents folder"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'incident-photos'
  AND (storage.foldername(name))[1] = 'incidents'
);

CREATE POLICY "Owners or admins can update their incident photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'incident-photos'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
)
WITH CHECK (
  bucket_id = 'incident-photos'
  AND (storage.foldername(name))[1] = 'incidents'
);

CREATE POLICY "Owners or admins can delete their incident photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'incident-photos'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
);
