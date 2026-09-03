-- =============================================================================
-- 00000000000015_site_assets_bucket.sql
--
-- Creates the "site-assets" storage bucket for admin-uploaded branding
-- images (currently just the homepage hero background). Kept separate from
-- "listing-photos" (00000000000003_storage_bucket.sql) since these are
-- uploaded by admins from src/pages/admin/AdminSettings.tsx, not hosts, and
-- aren't tied to a listing row - so the access policy is "admin only" via
-- public.is_admin() rather than "any authenticated user".
--
-- Reads back with getPublicUrl() the same way listing-photos does, so the
-- bucket must be public for SELECT.
--
-- Safe to re-run: ON CONFLICT DO NOTHING for the bucket, DROP POLICY IF
-- EXISTS before every CREATE POLICY.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access to site assets" ON storage.objects;
CREATE POLICY "Public read access to site assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-assets');

DROP POLICY IF EXISTS "Admins can upload site assets" ON storage.objects;
CREATE POLICY "Admins can upload site assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'site-assets' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update site assets" ON storage.objects;
CREATE POLICY "Admins can update site assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'site-assets' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete site assets" ON storage.objects;
CREATE POLICY "Admins can delete site assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'site-assets' AND public.is_admin());
