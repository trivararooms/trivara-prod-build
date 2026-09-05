-- =============================================================================
-- 00000000000018_homepage_collections.sql
--
-- Seeds the app_settings rows backing up to three admin-uploaded "collection"
-- photo tiles shown on the home page between Popular Destinations and
-- Featured Stays (Admin Settings > Branding). Each slot has an image (via the
-- site-assets bucket, same as hero_background_image_url) and an optional
-- destination link. A slot with no image set renders nothing - the section
-- itself is hidden entirely if all three are empty.
--
-- update_app_setting() only UPDATEs an existing row (see
-- 00000000000001_consolidated_baseline.sql) - it never inserts one - so
-- every key an admin might ever set has to be seeded here first.
--
-- Safe to re-run: ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO public.app_settings (category, key, value, is_secret, description) VALUES
  ('homepage', 'homepage_collection_1_image_url', NULL, false, 'Homepage collection tile 1 image URL'),
  ('homepage', 'homepage_collection_1_link_url', NULL, false, 'Homepage collection tile 1 destination link (optional)'),
  ('homepage', 'homepage_collection_2_image_url', NULL, false, 'Homepage collection tile 2 image URL'),
  ('homepage', 'homepage_collection_2_link_url', NULL, false, 'Homepage collection tile 2 destination link (optional)'),
  ('homepage', 'homepage_collection_3_image_url', NULL, false, 'Homepage collection tile 3 image URL'),
  ('homepage', 'homepage_collection_3_link_url', NULL, false, 'Homepage collection tile 3 destination link (optional)')
ON CONFLICT (key) DO NOTHING;
