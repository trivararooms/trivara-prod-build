-- =============================================================================
-- 00000000000014_hero_background_image.sql
--
-- Seeds the app_settings row the homepage hero background image lives in.
-- update_app_setting() only UPDATEs an existing row (see
-- 00000000000001_consolidated_baseline.sql) - it never inserts one - so the
-- key has to be seeded here before an admin can set it from
-- src/pages/admin/AdminSettings.tsx. A NULL/empty value means the homepage
-- falls back to its plain CSS gradient background.
--
-- Safe to re-run: ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO public.app_settings (category, key, value, is_secret, description) VALUES
  ('homepage', 'hero_background_image_url', NULL, false, 'Homepage hero section background image URL')
ON CONFLICT (key) DO NOTHING;
