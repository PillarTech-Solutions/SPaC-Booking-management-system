BEGIN;

CREATE TABLE IF NOT EXISTS public.announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (length(trim(title)) > 0),
  message     text NOT NULL CHECK (length(trim(message)) > 0),
  is_pinned   boolean NOT NULL DEFAULT false,
  created_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements (created_at DESC);

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Owner / Admin / Manager (active) can manage announcements
CREATE OR REPLACE FUNCTION public.is_announcement_manager()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
     WHERE id = auth.uid()
       AND COALESCE(status, 'Active') = 'Active'
       AND role IN ('Owner', 'Admin', 'Manager')
  );
$$;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Managers add announcements" ON public.announcements;
DROP POLICY IF EXISTS "Managers edit announcements" ON public.announcements;
DROP POLICY IF EXISTS "Managers delete announcements" ON public.announcements;

CREATE POLICY "Staff read announcements" ON public.announcements
  FOR SELECT USING (public.is_active_staff());
CREATE POLICY "Managers add announcements" ON public.announcements
  FOR INSERT WITH CHECK (public.is_announcement_manager());
CREATE POLICY "Managers edit announcements" ON public.announcements
  FOR UPDATE USING (public.is_announcement_manager()) WITH CHECK (public.is_announcement_manager());
CREATE POLICY "Managers delete announcements" ON public.announcements
  FOR DELETE USING (public.is_announcement_manager());

COMMIT;