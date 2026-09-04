-- =============================================================================
-- 00000000000018_homepage_spacer_image.sql
--
-- Seeds the app_settings row for the full-bleed image spacer section between
-- "Popular destinations" and "Featured stays" on the homepage (see
-- src/pages/Index.tsx). update_app_setting() only UPDATEs an existing row
-- (see 00000000000001_consolidated_baseline.sql) - it never inserts one - so
-- the key has to be seeded here before an admin can set it from
-- src/pages/admin/AdminSettings.tsx. An empty value means the section
-- doesn't render anything.
--
-- Safe to re-run: ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO public.app_settings (category, key, value, is_secret, description) VALUES
  ('homepage', 'homepage_spacer_image_url', '', false, 'Image URL shown in the full-bleed spacer section between Popular Destinations and Featured Stays on the homepage.')
ON CONFLICT (key) DO NOTHING;
