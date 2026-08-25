-- =============================================================================
-- 00000000000002_saved_listings_and_scheduled_jobs.sql
--
-- Builds on top of 00000000000001_consolidated_baseline.sql. Resolves two of
-- the open items from supabase/migrations/README.md's "Known TODO.md items
-- NOT fully resolved at the schema level":
--
--   1. "Saved listings" feature — the heart/save button on every listing card
--      was purely client-side (useState, resets on refresh). Adds a real
--      `saved_listings` join table with RLS so it persists per-user.
--   2. "Replace the client-side autoCompletePastBookings() polling." — adds
--      a real server-side scheduled job (pg_cron) that marks confirmed
--      bookings whose checkout date has passed as completed, instead of that
--      only happening when a user happens to load Trips.tsx/HostDashboard.tsx.
--
-- Safe to re-run: every statement below is idempotent (IF NOT EXISTS / OR
-- REPLACE / DROP ... IF EXISTS before CREATE).
-- =============================================================================


-- =============================================================================
-- 1. SAVED LISTINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.saved_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_listings_user_id ON public.saved_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_listings_listing_id ON public.saved_listings(listing_id);

ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved listings" ON public.saved_listings;
CREATE POLICY "Users can view own saved listings" ON public.saved_listings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can save listings" ON public.saved_listings;
CREATE POLICY "Users can save listings" ON public.saved_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unsave own listings" ON public.saved_listings;
CREATE POLICY "Users can unsave own listings" ON public.saved_listings
  FOR DELETE USING (auth.uid() = user_id);

-- No UPDATE policy/grant - saving is a pure insert/delete toggle, there is
-- nothing on this table a client should ever need to update in place.
GRANT SELECT, INSERT, DELETE ON public.saved_listings TO authenticated;


-- =============================================================================
-- 2. SCHEDULED JOB: auto-complete past bookings
-- =============================================================================

-- Supabase projects ship with pg_cron available but not always enabled.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Same logic bookingService.autoCompletePastBookings() used to run
-- client-side on every Trips.tsx/HostDashboard.tsx load: any 'confirmed'
-- booking whose checkout date has passed becomes 'completed'.
-- host_earnings generation for the transition is still handled by the
-- existing create_host_earnings_on_completion trigger - this function only
-- flips the status, exactly like the client code did.
CREATE OR REPLACE FUNCTION public.auto_complete_past_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings
  SET status = 'completed'
  WHERE status = 'confirmed'
    AND end_date < CURRENT_DATE;
END;
$$;

-- Never callable over the API by anon/authenticated - this only ever runs
-- as a scheduled internal SQL statement via pg_cron below.
REVOKE ALL ON FUNCTION public.auto_complete_past_bookings() FROM PUBLIC, anon, authenticated;

-- cron.schedule() upserts by job name, so re-running this is safe and just
-- updates the existing job rather than creating a duplicate.
SELECT cron.schedule(
  'auto-complete-past-bookings',
  '0 * * * *', -- every hour, on the hour
  $$ SELECT public.auto_complete_past_bookings(); $$
);
