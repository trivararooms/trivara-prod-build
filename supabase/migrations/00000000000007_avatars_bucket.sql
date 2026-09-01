-- =============================================================================
-- 00000000000007_avatars_bucket.sql
--
-- Creates an "avatars" storage bucket for the new Account Settings page
-- (src/pages/AccountSettings.tsx), mirroring 00000000000003_storage_bucket.sql's
-- "listing-photos" bucket exactly: public read (avatars are shown on listing
-- pages/reviews to other users), authenticated insert, owner-only delete.
--
-- Safe to re-run: ON CONFLICT DO NOTHING for the bucket, DROP POLICY IF
-- EXISTS before every CREATE POLICY.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access to avatars" ON storage.objects;
CREATE POLICY "Public read access to avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated users can upload their avatar" ON storage.objects;
CREATE POLICY "Authenticated users can upload their avatar" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() = owner);
