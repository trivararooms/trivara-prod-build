-- =============================================================================
-- 00000000000012_home_curation.sql
--
-- Three home-page/search curation changes:
--   1. Featured stays: capped, admin-curated (was: top-4-by-rating with no
--      admin control at all). listings.is_featured is only ever settable
--      through set_listing_featured(), which enforces the cap read from
--      app_settings('featured_stays_max_slots') - so the admin can also
--      change the cap itself.
--   2. listing_booking_counts(): a public aggregate RPC (no PII, just
--      counts) used to rank "Popular stays" by actual bookings instead of
--      review_count, and to pick each destination's most-booked listing
--      photo instead of an arbitrary "first found" one.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP TRIGGER/POLICY IF EXISTS before CREATE, ON CONFLICT DO NOTHING seed.
-- =============================================================================

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS featured_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_listings_is_featured ON public.listings(is_featured) WHERE is_featured = TRUE;

INSERT INTO public.app_settings (category, key, value, is_secret, description) VALUES
  ('general', 'featured_stays_max_slots', '25', false, 'Maximum number of listings that can be featured on the home page at once')
ON CONFLICT (key) DO NOTHING;


-- -----------------------------------------------------------------------------
-- Guard: is_featured/featured_at may only change via set_listing_featured()
-- below, never a direct client .update() - same idea as the profiles
-- role/is_host column lockdown, but done with a session-local flag instead
-- of a column-level REVOKE, since listings' existing GRANT UPDATE is a
-- blanket one and enumerating every other column here would be needlessly
-- invasive to unrelated listing-editing code.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_listing_featured_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_featured IS DISTINCT FROM OLD.is_featured
     AND COALESCE(current_setting('trivara.allow_featured_change', true), '') <> 'true' THEN
    RAISE EXCEPTION 'is_featured can only be changed via set_listing_featured()';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_listing_featured_change ON public.listings;
CREATE TRIGGER trigger_guard_listing_featured_change
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_listing_featured_change();

CREATE OR REPLACE FUNCTION public.set_listing_featured(p_listing_id UUID, p_featured BOOLEAN)
RETURNS public.listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_slots INTEGER;
  v_current_count INTEGER;
  v_listing public.listings;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the main admin can feature a listing';
  END IF;

  IF p_featured THEN
    SELECT COALESCE(value::INTEGER, 25) INTO v_max_slots
    FROM public.app_settings WHERE key = 'featured_stays_max_slots';

    SELECT COUNT(*) INTO v_current_count FROM public.listings WHERE is_featured = TRUE;

    IF v_current_count >= COALESCE(v_max_slots, 25) THEN
      RAISE EXCEPTION 'All % featured slots are in use. Unfeature a listing first, or raise the limit in Admin Settings.', v_max_slots;
    END IF;
  END IF;

  PERFORM set_config('trivara.allow_featured_change', 'true', true);

  UPDATE public.listings
  SET is_featured = p_featured, featured_at = CASE WHEN p_featured THEN NOW() ELSE NULL END
  WHERE id = p_listing_id
  RETURNING * INTO v_listing;

  IF v_listing IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  RETURN v_listing;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_listing_featured(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_listing_featured(UUID, BOOLEAN) TO authenticated;


-- -----------------------------------------------------------------------------
-- listing_booking_counts: public aggregate (listing_id + count only, no
-- guest/host PII) for ranking "Popular stays" and picking each
-- destination's most-booked photo. Bypasses bookings' normal RLS (which
-- only lets a guest/host see their own bookings) since this is
-- SECURITY DEFINER, but only ever returns a count per listing.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listing_booking_counts()
RETURNS TABLE (listing_id UUID, booking_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.listing_id, COUNT(*) AS booking_count
  FROM public.bookings b
  WHERE b.status IN ('confirmed', 'completed')
  GROUP BY b.listing_id;
$$;

GRANT EXECUTE ON FUNCTION public.listing_booking_counts() TO anon, authenticated;
