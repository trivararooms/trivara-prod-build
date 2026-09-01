-- =============================================================================
-- Payout rejection workflow + audit logging for booking status changes
-- =============================================================================
-- Resolves two of the three open items from supabase/migrations/README.md's
-- "Known TODO.md items NOT fully resolved at the schema level":
--
--   - "Add admin payout approval flow" / "pending -> approved -> paid" -
--     `payout_requests.status` already allowed 'rejected' in its CHECK
--     constraint, but no RPC ever set it. This adds `reject_payout_request()`,
--     mirroring `approve_payout_request()`'s admin-only + advisory-lock shape.
--     The existing `notes` column on payout_requests doubles as the rejection
--     reason - no column addition needed.
--   - "Add audit logs for ... completions." Booking completions and
--     cancellations were not logged to `audit_log` (only payout approvals
--     were). This adds a trigger that logs both transitions, `changed_by`
--     recorded as NULL when the change comes from the unauthenticated
--     `auto_complete_past_bookings()` pg_cron job rather than an admin/host
--     action (audit_log.changed_by is nullable for exactly this reason).
--
-- The third item (bank-detail masking in the admin UI) is a frontend-only
-- change - see src/pages/AdminDashboard.tsx, no schema change required since
-- get_bank_details_for_payout() already existed.

-- -----------------------------------------------------------------------------
-- reject_payout_request: mirrors approve_payout_request's admin-only check +
-- advisory lock, but sets status='rejected' and stores the optional reason in
-- the existing `notes` column instead of syncing host_earnings (a rejected
-- payout doesn't touch the ledger - the host's earnings stay 'pending' and
-- they can request a payout again).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_payout_request(p_payout_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INT;
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

-- -----------------------------------------------------------------------------
-- Extend the existing payout audit trigger to also cover rejections, not just
-- approvals. Same trigger (`audit_payout_approvals`) already exists and is
-- attached to this function - CREATE OR REPLACE is enough, no re-attach needed.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_payout_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('paid', 'rejected') AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES ('payout_requests', NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Audit booking completions and cancellations the same way payout approvals
-- already are. `changed_by` is auth.uid() for a guest/host-initiated
-- cancellation, and NULL for a completion flipped by the unauthenticated
-- auto_complete_past_bookings() pg_cron job - both are valid, expected values
-- for this nullable column.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled') AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES ('bookings', NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_booking_status_changes ON public.bookings;
CREATE TRIGGER audit_booking_status_changes
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_booking_status_change();
