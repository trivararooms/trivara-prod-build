-- =============================================================================
-- 00000000000009_ops_admin_role.sql
--
-- A delegated "ops_admin" role the main admin can grant to other emails,
-- with a fixed, narrower bundle of powers than full admin:
--   - Platform visibility: admin_dashboard_stats(), a live read of every
--     host's listings/bookings/earnings ledger, and (via the existing
--     get_bank_details_for_payout(), which already only ever returns
--     RIGHT(account_number, 4)) bank details masked to the last 4 digits.
--     The raw host_bank_accounts table itself stays admin-only.
--   - Payouts: approve/reject any payout request, request a payout on
--     behalf of any host (bypassing the "must be the host" check),
--     process a manual refund.
--   - NOT included (main-admin only): update_app_setting(), granting or
--     revoking other admins, and (once built by sibling migrations)
--     commission/offers configuration.
--
-- Safe to re-run: CREATE OR REPLACE FUNCTION, DROP POLICY/CONSTRAINT IF
-- EXISTS before CREATE.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. New role value
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('guest', 'host', 'admin', 'ops_admin'));

-- -----------------------------------------------------------------------------
-- 2. is_ops_admin_or_admin() — mirrors is_admin() exactly, true for either
-- role. Existing admin-only RPCs are extended to accept this instead of
-- is_admin() where the ops_admin bundle above says they should.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_ops_admin_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'ops_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_ops_admin_or_admin() TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 3. Extend existing RPCs' internal permission checks. Full bodies
-- reproduced from 00000000000001_consolidated_baseline.sql /
-- 00000000000004_payout_rejection_and_audit.sql with only the auth check
-- changed - every other line is unchanged.
-- -----------------------------------------------------------------------------

-- request_payout_by_booking: the admin-bypass check now also accepts ops_admin.
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

  IF (v_host_id != auth.uid()) AND (v_user_role NOT IN ('admin', 'ops_admin')) THEN
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

-- approve_payout_request
CREATE OR REPLACE FUNCTION public.approve_payout_request(p_payout_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INT;
  v_booking_id UUID;
  v_can_approve BOOLEAN;
BEGIN
  SELECT public.is_ops_admin_or_admin() INTO v_can_approve;

  IF NOT v_can_approve THEN
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

-- reject_payout_request
CREATE OR REPLACE FUNCTION public.reject_payout_request(p_payout_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INT;
  v_can_reject BOOLEAN;
BEGIN
  SELECT public.is_ops_admin_or_admin() INTO v_can_reject;

  IF NOT v_can_reject THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: Admin access required');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_payout_id::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.payout_requests
    WHERE id = p_payout_id AND status = 'pending'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Payout request is not in pending status or does not exist');
  END IF;

  UPDATE public.payout_requests
  SET status = 'rejected', notes = p_reason, updated_at = NOW()
  WHERE id = p_payout_id AND status = 'pending';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Failed to update payout request');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Payout rejected');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_payout_request(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_payout_request(UUID, TEXT) TO authenticated;

-- admin_dashboard_stats
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
  IF NOT public.is_ops_admin_or_admin() THEN
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

-- get_bank_details_for_payout — already returns account_last_four only
-- (RIGHT(account_number, 4)), so extending this to ops_admin already
-- satisfies "masked to last-4" for the payout-processing lookup path.
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
  IF NOT public.is_ops_admin_or_admin() THEN
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

-- process_booking_refund
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
  IF NOT public.is_ops_admin_or_admin() THEN
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


-- -----------------------------------------------------------------------------
-- 4. grant_ops_admin / revoke_ops_admin — main-admin only (is_admin(),
-- strictly, never is_ops_admin_or_admin - an ops_admin can't create more
-- admins).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_ops_admin(p_email TEXT)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the main admin can grant ops_admin access';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE email = p_email;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'No user found with email %', p_email;
  END IF;
  IF v_profile.role = 'admin' THEN
    RAISE EXCEPTION 'Cannot change an existing admin''s role';
  END IF;

  UPDATE public.profiles SET role = 'ops_admin', updated_at = NOW()
  WHERE email = p_email
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_ops_admin(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.grant_ops_admin(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_ops_admin(p_email TEXT)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the main admin can revoke ops_admin access';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE email = p_email AND role = 'ops_admin';
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'No ops_admin found with email %', p_email;
  END IF;

  UPDATE public.profiles
  SET role = CASE WHEN is_host THEN 'host' ELSE 'guest' END, updated_at = NOW()
  WHERE email = p_email
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_ops_admin(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_ops_admin(TEXT) TO authenticated;


-- -----------------------------------------------------------------------------
-- 5. RLS — additive, read-only SELECT policies for ops_admin's "live feed"
-- visibility. Existing is_admin()-only FOR ALL / UPDATE policies on these
-- tables are untouched (ops_admin never gets destructive/manage rights
-- directly - only through the RPCs above, which are SECURITY DEFINER and
-- bypass RLS entirely).
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Ops admins can view all listings" ON public.listings;
CREATE POLICY "Ops admins can view all listings" ON public.listings
  FOR SELECT USING (public.is_ops_admin_or_admin());

DROP POLICY IF EXISTS "Ops admins can view all bookings" ON public.bookings;
CREATE POLICY "Ops admins can view all bookings" ON public.bookings
  FOR SELECT USING (public.is_ops_admin_or_admin());

DROP POLICY IF EXISTS "Admins can view all earnings" ON public.host_earnings;
CREATE POLICY "Admins can view all earnings" ON public.host_earnings
  FOR SELECT USING (public.is_ops_admin_or_admin());

DROP POLICY IF EXISTS "Admins can view all payout requests" ON public.payout_requests;
CREATE POLICY "Admins can view all payout requests" ON public.payout_requests
  FOR SELECT USING (public.is_ops_admin_or_admin());
