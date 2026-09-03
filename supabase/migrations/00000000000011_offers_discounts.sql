-- =============================================================================
-- 00000000000011_offers_discounts.sql
--
-- Admin-defined promotional discounts, evaluated at checkout. Locked design:
--   - Parameter types: first-time user (no prior completed booking), area
--     (matches a listing's location), combo (a specific set of listings, or
--     a minimum-nights bundle) - kept to these three rather than a fully
--     generic rules engine.
--   - Non-stackable: when a booking qualifies for more than one active
--     rule, only the single largest resulting discount applies.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP POLICY IF EXISTS before CREATE POLICY, ADD COLUMN IF NOT EXISTS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.discount_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('first_time_user', 'area', 'combo')),
  -- area: {"location_contains": "Goa"}
  -- combo: {"listing_ids": ["<uuid>", ...]} and/or {"min_nights": 3}
  -- first_time_user: {} (no conditions needed)
  conditions JSONB NOT NULL DEFAULT '{}',
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'flat_amount')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  active_from TIMESTAMP WITH TIME ZONE,
  active_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.discount_rules ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_discount_rules_updated_at ON public.discount_rules;
CREATE TRIGGER update_discount_rules_updated_at
  BEFORE UPDATE ON public.discount_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Record of what was actually applied to a booking, for guest-facing display
-- and so a rule edited/deactivated later doesn't retroactively change past
-- bookings' totals.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS discount_rule_id UUID REFERENCES public.discount_rules(id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS discount_name TEXT;


-- -----------------------------------------------------------------------------
-- find_best_discount: evaluates every active, in-window rule against the
-- given user/listing/nights, returns the single largest-discount match (or
-- no rows). Callable by any authenticated guest at checkout - read-only,
-- no side effects, so this one (unlike the admin tables below) is granted
-- broadly rather than gated to is_admin().
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_best_discount(
  p_user_id UUID,
  p_listing_id UUID,
  p_subtotal NUMERIC,
  p_nights INTEGER
)
RETURNS TABLE (rule_id UUID, name TEXT, amount NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_listing_location TEXT;
  v_matches BOOLEAN;
  v_amount NUMERIC;
  v_best_rule_id UUID;
  v_best_name TEXT;
  v_best_amount NUMERIC := 0;
BEGIN
  IF p_subtotal IS NULL OR p_subtotal <= 0 THEN
    RETURN;
  END IF;

  SELECT location INTO v_listing_location FROM public.listings WHERE id = p_listing_id;

  FOR v_rule IN
    SELECT * FROM public.discount_rules
    WHERE is_active = TRUE
      AND (active_from IS NULL OR active_from <= NOW())
      AND (active_until IS NULL OR active_until >= NOW())
  LOOP
    v_matches := FALSE;

    IF v_rule.rule_type = 'first_time_user' THEN
      v_matches := NOT EXISTS (
        SELECT 1 FROM public.bookings
        WHERE guest_id = p_user_id AND status = 'completed'
      );

    ELSIF v_rule.rule_type = 'area' THEN
      v_matches := v_listing_location IS NOT NULL
        AND v_rule.conditions ? 'location_contains'
        AND v_listing_location ILIKE '%' || (v_rule.conditions->>'location_contains') || '%';

    ELSIF v_rule.rule_type = 'combo' THEN
      v_matches := (
        v_rule.conditions ? 'listing_ids'
        AND p_listing_id::text IN (SELECT jsonb_array_elements_text(v_rule.conditions->'listing_ids'))
      ) OR (
        v_rule.conditions ? 'min_nights'
        AND p_nights >= (v_rule.conditions->>'min_nights')::int
      );
    END IF;

    IF v_matches THEN
      IF v_rule.discount_type = 'percentage' THEN
        v_amount := p_subtotal * v_rule.discount_value / 100.0;
      ELSE
        v_amount := v_rule.discount_value;
      END IF;
      v_amount := LEAST(v_amount, p_subtotal - 1);

      IF v_amount > v_best_amount THEN
        v_best_amount := v_amount;
        v_best_rule_id := v_rule.id;
        v_best_name := v_rule.name;
      END IF;
    END IF;
  END LOOP;

  IF v_best_rule_id IS NOT NULL THEN
    RETURN QUERY SELECT v_best_rule_id, v_best_name, ROUND(v_best_amount);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.find_best_discount(UUID, UUID, NUMERIC, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_best_discount(UUID, UUID, NUMERIC, INTEGER) TO authenticated;


-- -----------------------------------------------------------------------------
-- RLS — discount_rules is main-admin managed. find_best_discount() above is
-- SECURITY DEFINER so it can read discount_rules regardless of this policy.
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_rules TO authenticated;

DROP POLICY IF EXISTS "Admins can manage discount rules" ON public.discount_rules;
CREATE POLICY "Admins can manage discount rules" ON public.discount_rules
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
