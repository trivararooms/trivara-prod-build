-- =============================================================================
-- 00000000000008_host_applications.sql
--
-- Replaces the old "publish a listing and you're a host" flow with an
-- explicit application: a user submits required verification documents,
-- an admin reviews and approves/rejects, and only then is `profiles.is_host`
-- (and `is_verified`) set to true. Publishing a listing now REQUIRES an
-- already-approved host rather than granting host status as a side effect.
--
-- Document set (kept intentionally minimal — see PR description for sourcing):
--   - Identity: PAN (mandatory) + one of aadhaar/passport/voter_id/driving_license
--   - Ownership/authorization: property tax receipt or sale deed (owned), OR
--     lease/rent agreement + owner NOC (rented)
--   - Bank details for payout: cancelled cheque or bank statement
--   - GST certificate: optional, only if the host is GST-registered
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
-- before CREATE, CREATE OR REPLACE FUNCTION.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.host_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

  legal_name TEXT NOT NULL,

  pan_path TEXT NOT NULL,
  id_proof_type TEXT NOT NULL CHECK (id_proof_type IN ('aadhaar', 'passport', 'voter_id', 'driving_license')),
  id_proof_path TEXT NOT NULL,

  ownership_proof_type TEXT NOT NULL CHECK (ownership_proof_type IN ('property_tax_receipt', 'sale_deed', 'lease_agreement')),
  ownership_proof_path TEXT NOT NULL,
  noc_path TEXT,

  bank_proof_type TEXT NOT NULL CHECK (bank_proof_type IN ('cancelled_cheque', 'bank_statement')),
  bank_proof_path TEXT NOT NULL,

  gst_number TEXT,
  gst_certificate_path TEXT,

  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- A lease requires proof the owner actually authorized the sublet/listing.
  CONSTRAINT host_applications_lease_requires_noc
    CHECK (ownership_proof_type <> 'lease_agreement' OR noc_path IS NOT NULL)
);

-- One pending application per user at a time — resubmitting after a rejection
-- is fine (old row stays as history), but you can't queue up duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_host_applications_one_pending_per_user
  ON public.host_applications(user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_host_applications_status ON public.host_applications(status);
CREATE INDEX IF NOT EXISTS idx_host_applications_user ON public.host_applications(user_id);

ALTER TABLE public.host_applications ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_host_applications_updated_at ON public.host_applications;
CREATE TRIGGER update_host_applications_updated_at
  BEFORE UPDATE ON public.host_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================================
-- APPROVE / REJECT (admin-only, SECURITY DEFINER so they can also flip
-- profiles.is_host/is_verified — mirrors approve_payout_request()'s shape)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.approve_host_application(p_application_id UUID)
RETURNS public.host_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.host_applications;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can approve host applications';
  END IF;

  SELECT * INTO v_application FROM public.host_applications WHERE id = p_application_id FOR UPDATE;
  IF v_application IS NULL THEN
    RAISE EXCEPTION 'Host application not found';
  END IF;
  IF v_application.status <> 'pending' THEN
    RAISE EXCEPTION 'Host application has already been %', v_application.status;
  END IF;

  UPDATE public.host_applications
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW(), rejection_reason = NULL
  WHERE id = p_application_id
  RETURNING * INTO v_application;

  UPDATE public.profiles
  SET is_host = TRUE,
      is_verified = TRUE,
      role = CASE WHEN role = 'guest' THEN 'host' ELSE role END,
      updated_at = NOW()
  WHERE id = v_application.user_id;

  INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
  VALUES ('host_applications', v_application.id, 'APPROVE', NULL, row_to_json(v_application), auth.uid());

  RETURN v_application;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_host_application(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_host_application(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_host_application(p_application_id UUID, p_reason TEXT)
RETURNS public.host_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.host_applications;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can reject host applications';
  END IF;
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  SELECT * INTO v_application FROM public.host_applications WHERE id = p_application_id FOR UPDATE;
  IF v_application IS NULL THEN
    RAISE EXCEPTION 'Host application not found';
  END IF;
  IF v_application.status <> 'pending' THEN
    RAISE EXCEPTION 'Host application has already been %', v_application.status;
  END IF;

  UPDATE public.host_applications
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = NOW(), rejection_reason = p_reason
  WHERE id = p_application_id
  RETURNING * INTO v_application;

  INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
  VALUES ('host_applications', v_application.id, 'REJECT', NULL, row_to_json(v_application), auth.uid());

  RETURN v_application;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_host_application(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_host_application(UUID, TEXT) TO authenticated;


-- =============================================================================
-- PUBLISH GATE — supersedes promote_host_on_publish(). Publishing no longer
-- grants host status; it now requires host status to already be approved.
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_promote_host_on_publish ON public.listings;
DROP FUNCTION IF EXISTS public.promote_host_on_publish() CASCADE;

CREATE OR REPLACE FUNCTION public.require_approved_host_to_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.published = TRUE AND (TG_OP = 'INSERT' OR OLD.published IS DISTINCT FROM TRUE) THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.host_id AND is_host = TRUE) THEN
      RAISE EXCEPTION 'You must be an approved host to publish a listing. Submit a host application first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_require_approved_host ON public.listings;
CREATE TRIGGER trigger_require_approved_host
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.require_approved_host_to_publish();


-- =============================================================================
-- STORAGE — private bucket for verification documents. Owner can upload/read
-- their own files (path convention: "{user_id}/{doc}-{timestamp}-{filename}");
-- admins can read any file to review an application. No public access.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('host-verification-docs', 'host-verification-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own verification docs" ON storage.objects;
CREATE POLICY "Users can upload own verification docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'host-verification-docs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read own verification docs, admins read any" ON storage.objects;
CREATE POLICY "Users can read own verification docs, admins read any" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'host-verification-docs'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "Users can delete own verification docs" ON storage.objects;
CREATE POLICY "Users can delete own verification docs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'host-verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- =============================================================================
-- RLS — host_applications. No UPDATE grant to `authenticated` at all: status
-- transitions only ever happen through the SECURITY DEFINER RPCs above.
-- =============================================================================

GRANT SELECT, INSERT ON public.host_applications TO authenticated;

DROP POLICY IF EXISTS "Users can view own application, admins view all" ON public.host_applications;
CREATE POLICY "Users can view own application, admins view all" ON public.host_applications
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can submit own application" ON public.host_applications;
CREATE POLICY "Users can submit own application" ON public.host_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
