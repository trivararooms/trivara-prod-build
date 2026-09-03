-- =============================================================================
-- 00000000000010_commission_engine.sql
--
-- Configurable platform commission, replacing the hardcoded 18% in
-- create_host_earnings_on_completion(). Locked design (the user's own
-- words): "I want it to be like I can set commissions based on
-- hosts/properties however using the admin account, but globally by
-- default for all have 3 tiers for monthly rev generated and the
-- commissions are set based on that. Let the admin set the tier threshold
-- and the commission rates."
--
-- Precedence: an explicit per-property override beats an explicit per-host
-- override beats the tier-based global default (by the host's trailing
-- 30-day revenue). Main-admin only (is_admin()) - not part of the
-- ops_admin bundle from 00000000000009.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP POLICY IF EXISTS before CREATE POLICY, ON CONFLICT DO NOTHING seed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.commission_tiers (
  tier_order INTEGER PRIMARY KEY,
  min_monthly_revenue NUMERIC NOT NULL CHECK (min_monthly_revenue >= 0),
  commission_rate NUMERIC NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

-- Seed 3 tiers. Tier 1's rate matches the previous hardcoded 18% so this
-- migration doesn't silently change anyone's fee the moment it's applied -
-- the admin can edit these from Admin Settings > Commission afterward.
INSERT INTO public.commission_tiers (tier_order, min_monthly_revenue, commission_rate) VALUES
  (1, 0, 18),
  (2, 100000, 15),
  (3, 500000, 12)
ON CONFLICT (tier_order) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.commission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('host', 'property')),
  scope_id UUID NOT NULL,
  commission_rate NUMERIC NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (scope_type, scope_id)
);

ALTER TABLE public.commission_overrides ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_commission_tiers_updated_at ON public.commission_tiers;
CREATE TRIGGER update_commission_tiers_updated_at
  BEFORE UPDATE ON public.commission_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_commission_overrides_updated_at ON public.commission_overrides;
CREATE TRIGGER update_commission_overrides_updated_at
  BEFORE UPDATE ON public.commission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- -----------------------------------------------------------------------------
-- resolve_commission_rate: property override > host override > tier-by-
-- trailing-30-day-revenue. Returns a percentage (0-100).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_commission_rate(p_host_id UUID, p_listing_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
  v_monthly_revenue NUMERIC;
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

  SELECT COALESCE(SUM(gross_amount), 0) INTO v_monthly_revenue
  FROM public.host_earnings
  WHERE host_id = p_host_id AND created_at >= NOW() - INTERVAL '30 days';

  SELECT commission_rate INTO v_rate
  FROM public.commission_tiers
  WHERE min_monthly_revenue <= v_monthly_revenue
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


-- -----------------------------------------------------------------------------
-- Wire the resolver into the one place commission is actually computed.
-- Full body reproduced from 00000000000001_consolidated_baseline.sql with
-- only the hardcoded 0.18 replaced.
-- -----------------------------------------------------------------------------
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
  v_commission_rate NUMERIC;
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    v_gross_amount := NEW.total_price;
    v_commission_rate := public.resolve_commission_rate(NEW.host_id, NEW.listing_id);
    v_platform_fee := ROUND(v_gross_amount * v_commission_rate / 100.0);
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

-- Trigger definition is unchanged (same name/timing/function), so no
-- DROP/CREATE TRIGGER needed - CREATE OR REPLACE FUNCTION above is enough.


-- -----------------------------------------------------------------------------
-- RLS — main-admin only. No client-facing RPC needed for tier/override CRUD;
-- direct table access is fine since these are simple config rows, not
-- cross-table mutations.
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_tiers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_overrides TO authenticated;

DROP POLICY IF EXISTS "Admins can manage commission tiers" ON public.commission_tiers;
CREATE POLICY "Admins can manage commission tiers" ON public.commission_tiers
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage commission overrides" ON public.commission_overrides;
CREATE POLICY "Admins can manage commission overrides" ON public.commission_overrides
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
