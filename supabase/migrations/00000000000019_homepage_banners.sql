-- =============================================================================
-- 00000000000019_homepage_banners.sql
--
-- Seeds the app_settings rows for two full-bleed image+link banners on the
-- home page (Admin Settings > Branding):
--   - homepage_75_banner_*: between Popular Destinations and Featured Stays,
--     75% of Hero's height, same width as Hero.
--   - homepage_hero_banner_*: after the Become-a-Host CTA (last section
--     before the footer), same height as Hero (100vh).
-- Both render nothing if unset, same as the collection tiles in
-- 00000000000018_homepage_collections.sql.
--
-- update_app_setting() only UPDATEs an existing row - it never inserts one -
-- so every key an admin might ever set has to be seeded here first.
--
-- Safe to re-run: ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO public.app_settings (category, key, value, is_secret, description) VALUES
  ('homepage', 'homepage_75_banner_image_url', NULL, false, '75%-height banner image, shown between Popular Destinations and Featured Stays'),
  ('homepage', 'homepage_75_banner_link_url', NULL, false, '75%-height banner destination link (optional)'),
  ('homepage', 'homepage_hero_banner_image_url', NULL, false, 'Hero-size banner image, shown after the Become a Host CTA'),
  ('homepage', 'homepage_hero_banner_link_url', NULL, false, 'Hero-size banner destination link (optional)')
ON CONFLICT (key) DO NOTHING;
