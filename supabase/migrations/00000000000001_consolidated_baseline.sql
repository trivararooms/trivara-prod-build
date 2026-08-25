-- =============================================================================
-- Trivara Stays — Consolidated Baseline Schema
-- =============================================================================
-- This is the single source of truth for the database schema. It supersedes
-- every loose *.sql file at the repo root and every file under /migrations
-- (see supabase/migrations/README.md for the full mapping and rationale).
--
-- Design goals:
--   1. Runs top-to-bottom with zero errors on a brand-new empty Supabase project.
--   2. Safe to re-run on an existing database that already ran the old loose
--      fix scripts (uses CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
--      DROP POLICY IF EXISTS + CREATE POLICY, CREATE OR REPLACE FUNCTION, etc).
--   3. Matches what src/services/*.ts and src/pages/**/*.tsx actually call at
--      runtime (verified by grepping `.from(...)` / `.rpc(...)` usage).
--
-- Section index:
--   1. Extensions
--   2. Tables (profiles, listings, bookings, reviews, host_earnings,
--      payout_requests, host_bank_accounts, app_settings, audit_log)
--   3. Indexes & uniqueness constraints
--   4. Generic trigger helpers (updated_at)
--   5. Auth/profile provisioning (handle_new_user, ensure_profile_exists)
--   6. Host promotion on listing publish
--   7. Host earnings automation
--   8. Listing rating/review_count aggregation
--   9. Payout request/approval RPCs (server-side balance validation)
--  10. Admin dashboard stats RPC
--  11. App settings RPCs (get/update)
--  12. Bank details masking + refund handling (admin tools)
--  13. Audit logging
--  14. Row Level Security policies (all tables)
--  15. Seed data (app_settings defaults)
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gist;    -- exclusion constraint on bookings


-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  -- Standardized role convention (src/services/profileService.ts): a simple
  -- role enum PLUS a separate is_host boolean. role='host' and is_host=true
  -- are kept in sync by promote_host_on_publish() below; nothing else should
  -- set them directly from the client (see column-level GRANTs in section 14).
  role TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('guest', 'host', 'admin')),
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- src/pages/AdminDashboard.tsx selects `full_name` directly from profiles
-- (`.select('id, full_name, role')`), but every other part of the app uses
-- first_name/last_name. Rather than invent a column nothing else writes to,
-- expose it as a generated column derived from first_name/last_name so that
-- query keeps working without a separate write path to keep in sync.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN full_name TEXT GENERATED ALWAYS AS (
        NULLIF(TRIM(BOTH ' ' FROM COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
      ) STORED;
  END IF;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- listings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,                      -- human-readable "City, State, Country" string
  details JSONB,                      -- full structured location object (city/state/country/coords/address)
  price_per_night INTEGER NOT NULL CHECK (price_per_night >= 0),
  amenities TEXT[] DEFAULT '{}',
  max_guests INTEGER NOT NULL DEFAULT 1 CHECK (max_guests > 0),
  property_type TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  rating NUMERIC NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  photos TEXT[] DEFAULT '{}',
  bedrooms INTEGER NOT NULL DEFAULT 1,
  bathrooms INTEGER NOT NULL DEFAULT 1,
  beds INTEGER NOT NULL DEFAULT 1,
  house_rules TEXT[] DEFAULT '{}',
  cancellation_policy TEXT NOT NULL DEFAULT 'flexible',
  cleaning_fee INTEGER NOT NULL DEFAULT 0,
  service_fee INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- bookings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES auth.users(id),
  host_id UUID NOT NULL REFERENCES auth.users(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,              -- exclusive (checkout date)
  guests INTEGER NOT NULL DEFAULT 1 CHECK (guests > 0),
  total_price INTEGER NOT NULL CHECK (total_price > 0),
  -- NOTE: default is 'pending', not 'confirmed'. Every original schema dump
  -- defaulted this to 'confirmed', which is a fail-OPEN default: any insert
  -- that forgets to set status would silently create a confirmed booking.
  -- The app always sets status explicitly, so this only changes behavior for
  -- future/careless inserts, in the safe (fail-closed) direction.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'pending_payment', 'confirmed', 'cancelled', 'completed')),
  -- Razorpay integration (razorpay_integration_schema.sql)
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  -- Refund bookkeeping (production_hardening.sql, used by process_booking_refund)
  refund_id TEXT,
  refund_amount INTEGER,
  refunded_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Prevent double-booking race conditions: no two confirmed/completed bookings
-- for the same listing may have overlapping date ranges.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS no_overlapping_bookings;
ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING GIST (
    listing_id WITH =,
    daterange(start_date, end_date, '[)') WITH &&
  ) WHERE (status IN ('confirmed', 'completed'));

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS valid_date_range;
ALTER TABLE public.bookings ADD CONSTRAINT valid_date_range CHECK (end_date > start_date);

-- -----------------------------------------------------------------------------
-- reviews (simple 4-field version — see README "judgment calls" for why the
-- granular cleanliness/accuracy/communication/location/checkIn/value columns
-- referenced by dead frontend code are intentionally NOT added here)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  reviewee_id UUID REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- reviewee_id is nullable: reviewService.createReview() (the live code path
-- used by Trips.tsx) does not currently set it. It's kept on the table
-- because reviewer_id/reviewee_id is the correct long-term shape (matches
-- final_database_schema.sql's intent), but NOT NULL would break inserts
-- until the frontend is updated to populate it.

-- -----------------------------------------------------------------------------
-- host_earnings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.host_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE below (not just an index) is the fix for the duplicate-payout bug
  -- (migrations/fix_duplicate_payouts.sql / CRITICAL_security_fixes.sql):
  -- exactly one earnings ledger row may ever exist per booking.
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users(id),
  listing_id UUID NOT NULL REFERENCES public.listings(id),
  guest_id UUID NOT NULL REFERENCES auth.users(id),
  gross_amount INTEGER NOT NULL CHECK (gross_amount > 0),
  platform_fee INTEGER NOT NULL CHECK (platform_fee >= 0),
  net_amount INTEGER NOT NULL CHECK (net_amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.host_earnings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- payout_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- host_bank_accounts
-- -----------------------------------------------------------------------------
-- NOTE: the original schema dumps (database_schema.sql etc.) call this table
-- `bank_accounts` with a `user_id` column. The ACTUAL, currently-shipping
-- frontend (src/pages/PaymentMethods.tsx, src/pages/AdminDashboard.tsx) reads
-- and writes `host_bank_accounts` with a `host_id` column exclusively — that
-- naming was introduced by migrations/fix_payout_requests_host_bank_accounts_relationship.sql
-- and is what's actually live. We standardize on the name the app uses.
CREATE TABLE IF NOT EXISTS public.host_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.host_bank_accounts ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- app_settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,        -- 'razorpay', 'smtp', 'general'
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- audit_log (production_hardening.sql — payout approval audit trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 3. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_is_host ON public.profiles(is_host);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

CREATE INDEX IF NOT EXISTS idx_listings_host_id ON public.listings(host_id);
CREATE INDEX IF NOT EXISTS idx_listings_published ON public.listings(published);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);

CREATE INDEX IF NOT EXISTS idx_bookings_host_id ON public.bookings(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_id ON public.bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_listing_id ON public.bookings(listing_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON public.bookings(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_listing_dates ON public.bookings(listing_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_host_status ON public.bookings(host_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_status ON public.bookings(guest_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_razorpay_order_id ON public.bookings(razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON public.reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);

CREATE INDEX IF NOT EXISTS idx_host_earnings_host_status ON public.host_earnings(host_id, status);
CREATE INDEX IF NOT EXISTS idx_host_earnings_listing_id ON public.host_earnings(listing_id);

CREATE INDEX IF NOT EXISTS idx_payout_requests_host_status ON public.payout_requests(host_id, status);
CREATE INDEX IF NOT EXISTS idx_payout_booking ON public.payout_requests(booking_id);

-- Only one active (pending) payout request per host at a time
CREATE UNIQUE INDEX IF NOT EXISTS one_active_payout_per_host
  ON public.payout_requests (host_id) WHERE (status = 'pending');

CREATE INDEX IF NOT EXISTS idx_audit_log_record ON public.audit_log(table_name, record_id);


-- =============================================================================
-- 4. GENERIC updated_at TRIGGER HELPER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_listings_updated_at ON public.listings;
CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_host_earnings_updated_at ON public.host_earnings;
CREATE TRIGGER update_host_earnings_updated_at BEFORE UPDATE ON public.host_earnings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payout_requests_updated_at ON public.payout_requests;
CREATE TRIGGER update_payout_requests_updated_at BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_host_bank_accounts_updated_at ON public.host_bank_accounts;
CREATE TRIGGER update_host_bank_accounts_updated_at BEFORE UPDATE ON public.host_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================================
-- 5. AUTH / PROFILE PROVISIONING
-- =============================================================================

-- Hardcoded primary admin account (also checked client-side in AdminDashboard.tsx
-- / admin/AdminSettings.tsx / Login.tsx). Auto-promoting this email to role
-- 'admin' on signup keeps the DB-side "defense in depth" role check
-- (`profiles.role = 'admin'`) working without a manual SQL step post-deploy.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := 'guest';
BEGIN
  IF NEW.email = 'trivararooms@gmail.com' THEN
    v_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, email, first_name, last_name, phone, avatar_url, role, is_host, is_verified, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    v_role,
    FALSE,
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth.users signup because of a profile-side failure.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RPC used by bookingService.ts as a fallback when a profile row is missing
-- (e.g. race between auth signup and first booking, or a user created before
-- the trigger existed).
CREATE OR REPLACE FUNCTION public.ensure_profile_exists(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = user_id) INTO profile_exists;

  IF NOT profile_exists THEN
    INSERT INTO public.profiles (id, email, role, is_host, is_verified, created_at, updated_at)
    SELECT
      id,
      COALESCE(email, ''),
      CASE WHEN email = 'trivararooms@gmail.com' THEN 'admin' ELSE 'guest' END,
      FALSE,
      FALSE,
      NOW(),
      NOW()
    FROM auth.users
    WHERE id = user_id
    ON CONFLICT (id) DO NOTHING;

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile_exists(UUID) TO anon, authenticated;

-- Backfill: make sure every existing auth user has a profile row (safe no-op
-- on a brand new project since auth.users is empty).
INSERT INTO public.profiles (id, email, role, is_host, is_verified, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.email, ''),
  CASE WHEN u.email = 'trivararooms@gmail.com' THEN 'admin' ELSE 'guest' END,
  FALSE,
  FALSE,
  NOW(),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Small helper used throughout RLS policies below. SECURITY DEFINER so it can
-- read `profiles` regardless of the caller's own row-level policies (avoids
-- recursive-policy evaluation issues when used inside profiles' own policies).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;


-- =============================================================================
-- 6. HOST PROMOTION ON LISTING PUBLISH
-- =============================================================================
-- src/services/listingService.ts publishListing() has a comment:
--   "Promote user to host if this is their first published listing... NOTE:
--    This is now handled by the PostgreSQL trigger promote_host_on_publish"
-- No such trigger actually existed in any of the historical migration files —
-- this was an abandoned dead end. This is the real implementation: a user is
-- promoted to host (role='host', is_host=true) the moment any one of their
-- listings transitions to published, and never demoted automatically.

CREATE OR REPLACE FUNCTION public.promote_host_on_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.published = TRUE AND (TG_OP = 'INSERT' OR OLD.published IS DISTINCT FROM TRUE) THEN
    UPDATE public.profiles
    SET is_host = TRUE,
        role = CASE WHEN role = 'guest' THEN 'host' ELSE role END,
        updated_at = NOW()
    WHERE id = NEW.host_id
      AND is_host = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_promote_host_on_publish ON public.listings;
CREATE TRIGGER trigger_promote_host_on_publish
  AFTER INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_host_on_publish();


-- =============================================================================
-- 7. HOST EARNINGS AUTOMATION
-- =============================================================================
-- bookingService.complete() ALSO inserts a host_earnings row from the client
-- (catching unique_violation 23505), so this trigger and the client insert
-- are intentionally redundant — the UNIQUE(booking_id) constraint on
-- host_earnings is what actually prevents duplicates either way.

CREATE OR REPLACE FUNCTION public.create_host_earnings_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gross_amount INTEGER;
  v_platform_fee INTEGER;
  v_net_amount INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    v_gross_amount := NEW.total_price;
    v_platform_fee := ROUND(v_gross_amount * 0.18);
    v_net_amount := v_gross_amount - v_platform_fee;

    INSERT INTO public.host_earnings (
      booking_id, host_id, listing_id, guest_id,
      gross_amount, platform_fee, net_amount, currency, status
    ) VALUES (
      NEW.id, NEW.host_id, NEW.listing_id, NEW.guest_id,
      v_gross_amount, v_platform_fee, v_net_amount, 'INR', 'pending'
    )
    ON CONFLICT (booking_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_host_earnings ON public.bookings;
CREATE TRIGGER trigger_create_host_earnings
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.create_host_earnings_on_completion();

-- One-time backfill for any completed bookings that predate this trigger.
INSERT INTO public.host_earnings (booking_id, host_id, listing_id, guest_id, gross_amount, platform_fee, net_amount, currency, status, created_at)
SELECT
  b.id, b.host_id, b.listing_id, b.guest_id,
  b.total_price,
  ROUND(b.total_price * 0.18),
  b.total_price - ROUND(b.total_price * 0.18),
  'INR', 'pending', b.updated_at
FROM public.bookings b
LEFT JOIN public.host_earnings he ON b.id = he.booking_id
WHERE b.status = 'completed' AND he.id IS NULL
ON CONFLICT (booking_id) DO NOTHING;


-- =============================================================================
-- 8. LISTING RATING / REVIEW_COUNT AGGREGATION
-- =============================================================================
-- None of the 27 historical migration files ever kept listings.rating /
-- review_count in sync with the reviews table (they're set to 0 on create and
-- never touched again). src/components/listings/ListingCard.tsx and
-- src/pages/Search.tsx both render `listing.rating` directly from this
-- column, so without this trigger every listing displays a permanent 0-star
-- rating. This is a genuine, additive fix, not present in any prior file.

CREATE OR REPLACE FUNCTION public.refresh_listing_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id UUID;
BEGIN
  v_listing_id := COALESCE(NEW.listing_id, OLD.listing_id);

  UPDATE public.listings
  SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.reviews WHERE listing_id = v_listing_id), 0),
      review_count = (SELECT COUNT(*) FROM public.reviews WHERE listing_id = v_listing_id)
  WHERE id = v_listing_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_refresh_listing_rating ON public.reviews;
CREATE TRIGGER trigger_refresh_listing_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_listing_rating();


-- =============================================================================
-- 9. PAYOUT REQUEST / APPROVAL RPCs
-- =============================================================================
-- request_payout_by_booking: the ONLY way a payout_requests row should ever
-- be created. Computes+validates the payout amount server-side from
-- host_earnings (never trusts a client-supplied amount). See section 14 for
-- why there is deliberately NO client-facing INSERT policy on payout_requests.

CREATE OR REPLACE FUNCTION public.request_payout_by_booking(p_booking_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id UUID;
  v_net_amount NUMERIC;
  v_earning_status TEXT;
  v_existing_payout_id UUID;
  v_user_role TEXT;
BEGIN
  SELECT host_id, net_amount, status
  INTO v_host_id, v_net_amount, v_earning_status
  FROM public.host_earnings
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'No earnings record found for this booking');
  END IF;

  IF v_earning_status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Earnings for this booking are already ' || v_earning_status);
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

  IF (v_host_id != auth.uid()) AND (v_user_role != 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: Only the host or admin can request this payout');
  END IF;

  SELECT id INTO v_existing_payout_id
  FROM public.payout_requests
  WHERE booking_id = p_booking_id AND status IN ('pending', 'processing');

  IF v_existing_payout_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'A payout request for this booking is already in progress');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payout_requests
    WHERE host_id = v_host_id AND status = 'pending'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You already have another pending payout request. Please wait for it to be processed.');
  END IF;

  INSERT INTO public.payout_requests (host_id, booking_id, amount, currency, status, requested_at)
  VALUES (v_host_id, p_booking_id, v_net_amount, 'INR', 'pending', NOW());

  RETURN json_build_object('success', true, 'message', 'Payout request submitted successfully', 'amount', v_net_amount);

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'This booking already has a payout request (Unique Violation)');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_payout_by_booking(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_payout_by_booking(UUID) TO authenticated;

-- approve_payout_request: admin-only (checked inside the function, not just
-- by GRANT), with an advisory lock so two concurrent approval clicks can't
-- double-process the same request. Also syncs the linked host_earnings row
-- to 'paid' so the ledger and the payout list never disagree.
CREATE OR REPLACE FUNCTION public.approve_payout_request(p_payout_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INT;
  v_booking_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: Admin access required');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_payout_id::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.payout_requests
    WHERE id = p_payout_id AND status = 'pending'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Payout request is not in pending status or does not exist');
  END IF;

  SELECT booking_id INTO v_booking_id FROM public.payout_requests WHERE id = p_payout_id;

  UPDATE public.payout_requests
  SET status = 'paid', paid_at = NOW()
  WHERE id = p_payout_id AND status = 'pending';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Failed to update payout request');
  END IF;

  IF v_booking_id IS NOT NULL THEN
    UPDATE public.host_earnings
    SET status = 'paid'
    WHERE booking_id = v_booking_id;
  END IF;

  RETURN json_build_object('success', true, 'message', 'Payout approved successfully');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_payout_request(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_payout_request(UUID) TO authenticated;


-- =============================================================================
-- 10. ADMIN DASHBOARD STATS RPC
-- =============================================================================
-- Admin-only (checked inside via is_admin(); the earliest version of this
-- function — create_admin_dashboard_stats_function.sql — had NO auth check
-- at all and was granted to `anon`, letting anyone read platform revenue.
-- That has been corrected here.

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS TABLE (
  total_listings BIGINT,
  total_bookings BIGINT,
  active_bookings BIGINT,
  completed_bookings BIGINT,
  platform_revenue NUMERIC,
  pending_payouts BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.listings) AS total_listings,
    (SELECT COUNT(*) FROM public.bookings) AS total_bookings,
    (SELECT COUNT(*) FROM public.bookings WHERE status = 'confirmed') AS active_bookings,
    (SELECT COUNT(*) FROM public.bookings WHERE status = 'completed') AS completed_bookings,
    (SELECT COALESCE(SUM(platform_fee), 0) FROM public.host_earnings) AS platform_revenue,
    (SELECT COUNT(*) FROM public.payout_requests WHERE status = 'pending') AS pending_payouts;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;


-- =============================================================================
-- 11. APP SETTINGS RPCs
-- =============================================================================

-- get_app_setting: only ever returns non-secret values (is_secret = false),
-- called by bookingService.ts to check `razorpay_enabled`.
CREATE OR REPLACE FUNCTION public.get_app_setting(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT value FROM public.app_settings WHERE key = p_key AND is_secret = false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_setting(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_app_setting(p_key TEXT, p_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can update settings';
  END IF;

  UPDATE public.app_settings
  SET value = p_value, updated_at = NOW(), updated_by = auth.uid()
  WHERE key = p_key;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_app_setting(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_app_setting(TEXT, TEXT) TO authenticated;


-- =============================================================================
-- 12. ADMIN TOOLS: MASKED BANK DETAILS + REFUND HANDLING
-- =============================================================================
-- NOTE (open item — see README): src/pages/AdminDashboard.tsx currently reads
-- host_bank_accounts directly (full, unmasked account numbers) rather than
-- calling this function. It's kept available for when the frontend is wired
-- up to use it, since it directly implements the TODO.md item "Show host
-- bank details securely".
CREATE OR REPLACE FUNCTION public.get_bank_details_for_payout(p_host_id UUID)
RETURNS TABLE (
  account_holder_name TEXT,
  bank_name TEXT,
  account_last_four TEXT,
  ifsc_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    b.account_holder_name,
    b.bank_name,
    RIGHT(b.account_number, 4) AS account_last_four,
    b.ifsc_code
  FROM public.host_bank_accounts b
  WHERE b.host_id = p_host_id
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_bank_details_for_payout(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_bank_details_for_payout(UUID) TO authenticated;

-- process_booking_refund: admin-only manual refund recording. Not currently
-- called by any frontend code (no cancellation-refund UI exists yet) but is
-- a coherent complete feature tied to the refund_* columns on bookings, so
-- it's kept available for admin use via RPC / future UI.
CREATE OR REPLACE FUNCTION public.process_booking_refund(
  p_booking_id UUID,
  p_refund_id TEXT,
  p_refund_amount INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_status TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT status INTO v_booking_status FROM public.bookings WHERE id = p_booking_id;

  IF v_booking_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Booking not found');
  END IF;

  UPDATE public.bookings
  SET payment_status = 'refunded',
      refund_id = p_refund_id,
      refund_amount = p_refund_amount,
      refunded_at = NOW(),
      status = 'cancelled'
  WHERE id = p_booking_id;

  UPDATE public.host_earnings
  SET status = 'failed'
  WHERE booking_id = p_booking_id AND status = 'pending';

  RETURN json_build_object('success', true, 'message', 'Refund processed');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_booking_refund(UUID, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_booking_refund(UUID, TEXT, INTEGER) TO authenticated;


-- =============================================================================
-- 13. AUDIT LOGGING
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_payout_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES ('payout_requests', NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_payout_approvals ON public.payout_requests;
CREATE TRIGGER audit_payout_approvals
  AFTER UPDATE ON public.payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_payout_approval();


-- =============================================================================
-- 14. TABLE-LEVEL GRANTS + ROW LEVEL SECURITY POLICIES
-- =============================================================================
-- Supabase projects normally get these base grants for free via platform
-- default privileges, but we set them explicitly here so this file is
-- self-contained and doesn't silently depend on that platform behavior. RLS
-- (below) is what actually restricts *which rows* each grant can touch.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.profiles, public.listings, public.reviews TO anon;
GRANT SELECT, INSERT, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT SELECT, INSERT ON public.bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT, INSERT ON public.host_earnings TO authenticated;
GRANT SELECT, UPDATE ON public.payout_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.host_bank_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
-- Column-level privilege lockdown: regular users may only ever change their
-- own non-privileged fields via the client. `role` and `is_host` are NEVER
-- grantable to the `authenticated` role — they can only be changed by
-- SECURITY DEFINER functions/triggers (which execute as the function owner
-- and therefore bypass ordinary object privileges), i.e. handle_new_user()
-- and promote_host_on_publish() above. This closes a real privilege
-- escalation hole: profileService.updateRole()/setIsHost() are unused today,
-- but the original RLS policies (`FOR UPDATE USING (auth.uid() = id)` with no
-- column restriction) would have let ANY logged-in user set their own
-- `role = 'admin'` via a direct .update() call.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (first_name, last_name, phone, avatar_url, bio, updated_at) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public can view profiles" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- -----------------------------------------------------------------------------
-- listings
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view published listings" ON public.listings;
DROP POLICY IF EXISTS "Users can view published listings" ON public.listings;
CREATE POLICY "Anyone can view published listings" ON public.listings
  FOR SELECT USING (published = true);

DROP POLICY IF EXISTS "Users can view own listings" ON public.listings;
CREATE POLICY "Users can view own listings" ON public.listings
  FOR SELECT USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Users can insert own listings" ON public.listings;
CREATE POLICY "Users can insert own listings" ON public.listings
  FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Users can update own listings" ON public.listings;
CREATE POLICY "Users can update own listings" ON public.listings
  FOR UPDATE USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Users can delete own listings" ON public.listings;
CREATE POLICY "Users can delete own listings" ON public.listings
  FOR DELETE USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Admins can manage all listings" ON public.listings;
CREATE POLICY "Admins can manage all listings" ON public.listings
  FOR ALL USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- bookings
-- -----------------------------------------------------------------------------
-- Column-level lockdown, mirroring the profiles approach: a guest/host may
-- only ever transition `status` (and set `cancelled_at`) via a direct client
-- update. This replaces fix_host_booking_cancellation.sql's
-- "Users can update own bookings" policy, which used
-- `USING (guest_id = auth.uid() OR host_id = auth.uid())` with NO column
-- restriction and NO WITH CHECK — meaning a guest or host could have
-- rewritten total_price, dates, host_id, or payment fields on any booking
-- they were party to.
REVOKE UPDATE ON public.bookings FROM authenticated;
GRANT UPDATE (status, cancelled_at) ON public.bookings TO authenticated;

DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = guest_id OR auth.uid() = host_id);

DROP POLICY IF EXISTS "Users can create own bookings" ON public.bookings;
CREATE POLICY "Users can create own bookings" ON public.bookings
  FOR INSERT WITH CHECK (
    auth.uid() = guest_id
    AND host_id = (SELECT l.host_id FROM public.listings l WHERE l.id = listing_id)
  );

DROP POLICY IF EXISTS "Guests can cancel pending bookings" ON public.bookings;
DROP POLICY IF EXISTS "Guests can cancel or complete own bookings" ON public.bookings;
CREATE POLICY "Guests can cancel or complete own bookings" ON public.bookings
  FOR UPDATE
  USING (auth.uid() = guest_id AND status IN ('pending', 'pending_payment', 'confirmed'))
  WITH CHECK (status IN ('cancelled', 'completed'));

DROP POLICY IF EXISTS "Hosts can cancel or complete own bookings" ON public.bookings;
CREATE POLICY "Hosts can cancel or complete own bookings" ON public.bookings
  FOR UPDATE
  USING (auth.uid() = host_id AND status IN ('pending', 'pending_payment', 'confirmed'))
  WITH CHECK (status IN ('cancelled', 'completed'));

DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can delete own bookings" ON public.bookings;

DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
CREATE POLICY "Admins can manage all bookings" ON public.bookings
  FOR ALL USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- reviews
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view all reviews" ON public.reviews;
CREATE POLICY "Users can view all reviews" ON public.reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can create own reviews" ON public.reviews;
CREATE POLICY "Users can create own reviews" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.status = 'completed'
        AND (b.guest_id = auth.uid() OR b.host_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
CREATE POLICY "Users can update own reviews" ON public.reviews
  FOR UPDATE USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Users can delete own reviews" ON public.reviews;
CREATE POLICY "Users can delete own reviews" ON public.reviews
  FOR DELETE USING (auth.uid() = reviewer_id);

-- -----------------------------------------------------------------------------
-- host_earnings — read-only for hosts; writes only via trigger/RPC
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Hosts can view their own earnings" ON public.host_earnings;
CREATE POLICY "Hosts can view their own earnings" ON public.host_earnings
  FOR SELECT USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Admin can manage all earnings" ON public.host_earnings;
DROP POLICY IF EXISTS "Admins can view all earnings" ON public.host_earnings;
CREATE POLICY "Admins can view all earnings" ON public.host_earnings
  FOR SELECT USING (public.is_admin());

-- bookingService.complete() does insert host_earnings directly from the
-- client as a redundant safety net alongside the trigger (see section 7), so
-- guests/hosts party to the booking need INSERT — but the UNIQUE(booking_id)
-- constraint plus this WITH CHECK is what actually keeps it honest.
DROP POLICY IF EXISTS "Booking participants can insert earnings" ON public.host_earnings;
CREATE POLICY "Booking participants can insert earnings" ON public.host_earnings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.status = 'completed'
        AND (b.guest_id = auth.uid() OR b.host_id = auth.uid())
    )
  );

-- No client UPDATE/DELETE policy: status changes to 'paid'/'failed' only
-- happen via approve_payout_request()/process_booking_refund() (SECURITY
-- DEFINER, bypasses RLS).

-- -----------------------------------------------------------------------------
-- payout_requests
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Hosts can view own payout requests" ON public.payout_requests;
CREATE POLICY "Hosts can view own payout requests" ON public.payout_requests
  FOR SELECT USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Admin can manage all payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Admins can view all payout requests" ON public.payout_requests;
CREATE POLICY "Admins can view all payout requests" ON public.payout_requests
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update payout requests" ON public.payout_requests;
CREATE POLICY "Admins can update payout requests" ON public.payout_requests
  FOR UPDATE USING (public.is_admin());

-- Deliberately NO INSERT policy for `authenticated`/`anon`: every payout
-- request must go through request_payout_by_booking() (SECURITY DEFINER),
-- which validates the amount against host_earnings server-side. The earlier
-- "Hosts can insert own payout requests" policy from CRITICAL_security_fixes.sql
-- (`WITH CHECK (auth.uid() = host_id)`) let a host INSERT a payout_requests
-- row directly with ANY `amount` of their choosing, completely bypassing the
-- server-side balance validation that secure_payout_logic.sql was written to
-- enforce. That policy is intentionally dropped here.
DROP POLICY IF EXISTS "Hosts can insert own payout requests" ON public.payout_requests;

-- -----------------------------------------------------------------------------
-- host_bank_accounts
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own bank accounts" ON public.host_bank_accounts;
DROP POLICY IF EXISTS "Hosts can manage own bank account" ON public.host_bank_accounts;
CREATE POLICY "Hosts can manage own bank account" ON public.host_bank_accounts
  FOR ALL USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

-- Required because src/pages/AdminDashboard.tsx selects host_bank_accounts
-- directly (not via the get_bank_details_for_payout() RPC) to display bank
-- details alongside payout requests. This is what actually fixes the TODO.md
-- item "Prevent host from seeing bank details of others" — hosts still only
-- see their own row via the policy above.
DROP POLICY IF EXISTS "Admins can view all bank accounts" ON public.host_bank_accounts;
CREATE POLICY "Admins can view all bank accounts" ON public.host_bank_accounts
  FOR SELECT USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- app_settings — admin-only; no anon/authenticated access at all (secrets
-- and non-secrets alike are only exposed via get_app_setting()/edge functions
-- using the service role key).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage all settings" ON public.app_settings;
CREATE POLICY "Admins can manage all settings" ON public.app_settings
  FOR ALL USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- audit_log — admin read-only; rows are only ever written by the
-- SECURITY DEFINER log_payout_approval() trigger.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can view audit logs" ON public.audit_log;
CREATE POLICY "Admin can view audit logs" ON public.audit_log
  FOR SELECT USING (public.is_admin());


-- =============================================================================
-- 15. SEED DATA
-- =============================================================================
-- razorpay_enabled defaults to 'false' so a fresh deploy with no admin
-- configuration never accidentally attempts to charge cards / accepts
-- bookings straight to 'confirmed' status via the free/manual-payment path.

INSERT INTO public.app_settings (category, key, value, is_secret, description) VALUES
  ('razorpay', 'razorpay_enabled', 'false', false, 'Enable or disable Razorpay payments'),
  ('razorpay', 'razorpay_key_id', '', false, 'Razorpay Key ID'),
  ('razorpay', 'razorpay_key_secret', '', true, 'Razorpay Key Secret'),
  ('razorpay', 'razorpay_webhook_secret', '', true, 'Razorpay Webhook Secret'),
  ('razorpay', 'razorpay_environment', 'test', false, 'Razorpay Environment (test/live)'),
  ('smtp', 'smtp_enabled', 'false', false, 'Enable or disable transactional emails via SMTP'),
  ('smtp', 'smtp_host', '', false, 'SMTP Server Host'),
  ('smtp', 'smtp_port', '587', false, 'SMTP Server Port'),
  ('smtp', 'smtp_username', '', false, 'SMTP Username'),
  ('smtp', 'smtp_password', '', true, 'SMTP Password'),
  ('smtp', 'smtp_from_name', 'Trivara Stays', false, 'Default From Name for emails'),
  ('smtp', 'smtp_from_email', 'noreply@trivarastays.com', false, 'Default From Email address')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- End of consolidated baseline
-- =============================================================================
