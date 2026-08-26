-- =============================================================================
-- 00000000000003_storage_bucket.sql
--
-- Creates the "listing-photos" storage bucket and its access policies via
-- SQL instead of a manual dashboard click. This bucket previously existed
-- only as a manually-created dashboard object in the (now-deleted) Supabase
-- project - it was never captured in any migration, .sql file, or doc
-- anywhere in this repo. That's exactly why standing the app back up after
-- the project was deleted required reverse-engineering its config from
-- src/pages/host/CreateListing.tsx instead of just re-running a script.
-- Doing it here means a brand-new project gets it automatically alongside
-- the rest of the schema, and it survives the next time this needs to
-- happen.
--
-- CreateListing.tsx uploads directly from the browser using the signed-in
-- host's own session (not an Edge Function with the service role key), and
-- reads photos back with getPublicUrl() rather than a signed URL - so the
-- bucket must be public for reads, and needs an INSERT policy so signed-in
-- users can upload. There's no per-user folder convention in the upload
-- path (`${Date.now()}-${file.name}`), so ownership for the DELETE policy
-- relies on the `owner` column storage.objects sets automatically from
-- auth.uid() at upload time, not a folder path.
--
-- Safe to re-run: ON CONFLICT DO NOTHING for the bucket, DROP POLICY IF
-- EXISTS before every CREATE POLICY.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-photos', 'listing-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access to listing photos" ON storage.objects;
CREATE POLICY "Public read access to listing photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'listing-photos');

DROP POLICY IF EXISTS "Authenticated users can upload listing photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload listing photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'listing-photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete their own listing photos" ON storage.objects;
CREATE POLICY "Users can delete their own listing photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'listing-photos' AND auth.uid() = owner);
