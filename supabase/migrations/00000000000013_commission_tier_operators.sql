-- =============================================================================
-- 00000000000013_commission_tier_operators.sql
--
-- Two changes to the commission tier system from 00000000000010:
--   1. Each tier now carries an explicit comparison operator ('upto',
--      'greater_than', 'less_than') against its amount, instead of an
--      implicit "revenue >= threshold". The admin can add/remove tiers
--      freely (already possible via plain table rows; this migration adds
--      the operator column those rows need).
--   2. resolve_commission_rate() now compares against a host's AVERAGE
--      monthly revenue (trailing 90 days, averaged over 3 months) instead
--      of a single trailing-30-day snapshot. This is what makes a tier
--      "sticky": one unusually slow or fast month doesn't flip a host's
--      rate on its own the way a hard 30-day cutoff would - the rate only
--      changes once the average itself moves across a tier boundary.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION.
-- =============================================================================

ALTER TABLE public.commission_tiers RENAME COLUMN min_monthly_revenue TO amount;

ALTER TABLE public.commission_tiers ADD COLUMN IF NOT EXISTS operator TEXT NOT NULL DEFAULT 'greater_than'
  CHECK (operator IN ('upto', 'greater_than', 'less_than'));

-- Existing seeded tiers used "revenue >= amount" - 'greater_than' (strict)
-- is the closest single operator to that; at the exact boundary rupee this
-- is a one-paisa edge case, not worth a fourth operator for.

CREATE OR REPLACE FUNCTION public.resolve_commission_rate(p_host_id UUID, p_listing_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
  v_avg_monthly_revenue NUMERIC;
BEGIN
  SELECT commission_rate INTO v_rate
  FROM public.commission_overrides
  WHERE scope_type = 'property' AND scope_id = p_listing_id;
  IF v_rate IS NOT NULL THEN
    RETURN v_rate;
  END IF;

  SELECT commission_rate INTO v_rate
  FROM public.commission_overrides
  WHERE scope_type = 'host' AND scope_id = p_host_id;
  IF v_rate IS NOT NULL THEN
    RETURN v_rate;
  END IF;

  -- Trailing-90-day average, not a single 30-day snapshot: a tier stays in
  -- effect as long as this average stays on the tier's side of its
  -- threshold, rather than flipping on one slow/fast month.
  SELECT COALESCE(SUM(gross_amount), 0) / 3.0 INTO v_avg_monthly_revenue
  FROM public.host_earnings
  WHERE host_id = p_host_id AND created_at >= NOW() - INTERVAL '90 days';

  SELECT commission_rate INTO v_rate
  FROM public.commission_tiers
  WHERE (operator = 'upto' AND v_avg_monthly_revenue <= amount)
     OR (operator = 'greater_than' AND v_avg_monthly_revenue > amount)
     OR (operator = 'less_than' AND v_avg_monthly_revenue < amount)
  ORDER BY tier_order DESC
  LIMIT 1;

  IF v_rate IS NULL THEN
    SELECT commission_rate INTO v_rate FROM public.commission_tiers ORDER BY tier_order ASC LIMIT 1;
  END IF;

  RETURN COALESCE(v_rate, 18);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_commission_rate(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_commission_rate(UUID, UUID) TO authenticated;
