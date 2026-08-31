-- =============================================================================
-- 00000000000005_booking_requests_pricing_and_settings.sql
--
-- Follow-up round of additive fixes/features:
--
--   1. Instant Book vs Request to Book. Every booking used to behave
--      identically (immediate creation + payment) with no way for a host to
--      require approval first, and nothing telling the guest which applies.
--      Adds `listings.instant_book` (default true, so existing listings keep
--      today's behavior) and `approve_booking_request()` - the one new
--      privileged transition (pending -> pending_payment) that the existing
--      booking RLS policies don't cover; declining reuses the existing
--      host "-> cancelled" policy from 00000000000001, no new status needed.
--
--   2. Host-managed blackout dates. Previously a listing's unavailable
--      dates were derived ONLY from actual bookings - a host had no way to
--      block off dates for personal use. Adds `listing_blackout_dates`.
--
--   3. Calendar-based per-date pricing. `calculateTotalPrice()` only ever
--      knew a single flat `price_per_night` - the `Availability.priceOverride`
--      field in src/types/index.ts was never backed by a real table. Adds
--      `listing_price_overrides` (one row per date) as that real table.
--
--   4. Notification preferences. Adds `notification_preferences` so the
--      Account page's "Notifications" setting is backed by something real
--      instead of a permanently-disabled "Coming soon" badge.
--
--   5. Abandoned pending bookings. A booking is inserted as 'pending' or
--      'pending_payment' before payment happens; if a guest closes the
--      checkout modal (or a request is never approved), that row sat
--      unresolved forever with no cleanup. Adds a hourly pg_cron job that
--      cancels rows stuck in that state for 48+ hours (no refund needed -
--      payment_status stays 'pending', nothing was ever charged).
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
-- DROP POLICY/FUNCTION IF EXISTS before every CREATE.
-- =============================================================================


-- =============================================================================
-- 1. INSTANT BOOK VS REQUEST TO BOOK
-- =============================================================================

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS instant_book BOOLEAN NOT NULL DEFAULT true;

-- The only booking-status transition a host needs that the existing RLS
-- policies (00000000000001, "Hosts can update own bookings") don't already
-- allow: pending -> pending_payment, when approving a request-to-book.
-- Declining reuses that existing policy's already-allowed "-> cancelled".
CREATE OR REPLACE FUNCTION public.approve_booking_request(p_booking_id UUID)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  IF v_booking.host_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the host can approve this request';
  END IF;
  IF v_booking.status != 'pending' THEN
    RAISE EXCEPTION 'Only a pending request can be approved';
  END IF;

  UPDATE public.bookings SET status = 'pending_payment', updated_at = NOW()
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_booking_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_booking_request(UUID) TO authenticated;


-- =============================================================================
-- 2. HOST-MANAGED BLACKOUT DATES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.listing_blackout_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_blackout_listing_id ON public.listing_blackout_dates(listing_id);

ALTER TABLE public.listing_blackout_dates ENABLE ROW LEVEL SECURITY;

-- Public SELECT: a guest's availability calendar needs to see blocked dates
-- on any listing, the same way bookings' dates are effectively public via
-- getUnavailableDates() today.
DROP POLICY IF EXISTS "Anyone can view blackout dates" ON public.listing_blackout_dates;
CREATE POLICY "Anyone can view blackout dates" ON public.listing_blackout_dates
  FOR SELECT USING (true);

-- Must also confirm `listing_id` actually belongs to this host, not just
-- that `host_id` (a plain column on this row) equals the caller - checking
-- only the latter let any authenticated user insert a row naming themselves
-- as host_id against a listing_id they don't own, planting bogus blackout
-- dates on someone else's listing (caught by e2e-test.mjs during review).
DROP POLICY IF EXISTS "Hosts can manage own blackout dates" ON public.listing_blackout_dates;
CREATE POLICY "Hosts can manage own blackout dates" ON public.listing_blackout_dates
  FOR ALL USING (
    auth.uid() = host_id
    AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.host_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.host_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_blackout_dates TO authenticated;
GRANT SELECT ON public.listing_blackout_dates TO anon;


-- =============================================================================
-- 3. PER-DATE PRICE OVERRIDES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.listing_price_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  price_per_night INTEGER NOT NULL CHECK (price_per_night > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, date)
);

CREATE INDEX IF NOT EXISTS idx_price_overrides_listing_id ON public.listing_price_overrides(listing_id, date);

ALTER TABLE public.listing_price_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view price overrides" ON public.listing_price_overrides;
CREATE POLICY "Anyone can view price overrides" ON public.listing_price_overrides
  FOR SELECT USING (true);

-- Same fix as listing_blackout_dates above: also confirm `listing_id`
-- actually belongs to this host, not just that `host_id` equals the caller.
DROP POLICY IF EXISTS "Hosts can manage own price overrides" ON public.listing_price_overrides;
CREATE POLICY "Hosts can manage own price overrides" ON public.listing_price_overrides
  FOR ALL USING (
    auth.uid() = host_id
    AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.host_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.host_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_price_overrides TO authenticated;
GRANT SELECT ON public.listing_price_overrides TO anon;


-- =============================================================================
-- 4. NOTIFICATION PREFERENCES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_booking_updates BOOLEAN NOT NULL DEFAULT true,
  email_messages BOOLEAN NOT NULL DEFAULT true,
  email_marketing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own notification preferences" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can upsert own notification preferences" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own notification preferences" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;

-- Lets an edge function (service role) check a recipient's preference
-- before sending a transactional email without needing a user JWT.
GRANT SELECT ON public.notification_preferences TO service_role;


-- =============================================================================
-- 5. SCHEDULED JOB: cancel abandoned pending/pending_payment bookings
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auto_cancel_abandoned_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings
  SET status = 'cancelled', cancelled_at = NOW()
  WHERE status IN ('pending', 'pending_payment')
    AND created_at < NOW() - INTERVAL '48 hours';
END;
$$;

REVOKE ALL ON FUNCTION public.auto_cancel_abandoned_bookings() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'auto-cancel-abandoned-bookings',
  '0 * * * *', -- every hour, on the hour
  $$ SELECT public.auto_cancel_abandoned_bookings(); $$
);

-- =============================================================================
-- End of 00000000000005_booking_requests_pricing_and_settings.sql
-- =============================================================================
