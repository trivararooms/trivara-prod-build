-- =============================================================================
-- 00000000000016_theme_and_content_settings.sql
--
-- Seeds the app_settings rows backing:
--   1. A site-wide background (a raw CSS `background` value - solid color
--      or gradient - applied to <body>). Defaults to the same continuous
--      indigo-to-chestnut gradient the homepage hero already uses, so the
--      rest of the site picks up that look immediately, before any admin
--      touches Branding.
--   2. The "Become a Host" section's optional background image (mirrors
--      hero_background_image_url from 00000000000014, same site-assets
--      bucket, different key/folder).
--   3. Per-word-editable text for the homepage's hero, "Featured stays",
--      "Popular destinations", and "Become a Host" copy. Each value is a
--      JSON array of {text, font, color} - seeded NULL here (not
--      pre-populated JSON) so the page keeps rendering its current
--      hardcoded fallback text/styling until an admin actually edits it in
--      AdminSettings > Branding; see src/services/siteSettingsService.ts.
--
-- update_app_setting() only UPDATEs an existing row (see
-- 00000000000001_consolidated_baseline.sql) - it never inserts one - so
-- every key an admin might ever set has to be seeded here first.
--
-- Safe to re-run: ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO public.app_settings (category, key, value, is_secret, description) VALUES
  ('theme', 'site_background_css', 'linear-gradient(135deg, #5457c9 0%, #8a3d29 100%)', false, 'Site-wide background (CSS background value: solid color or gradient)'),
  ('homepage', 'host_cta_background_image_url', NULL, false, '"Become a Host" section background image URL'),
  ('content', 'content_hero_eyebrow', NULL, false, 'Homepage hero eyebrow text ("wander well")'),
  ('content', 'content_hero_heading', NULL, false, 'Homepage hero heading ("Find your place")'),
  ('content', 'content_hero_subtitle', NULL, false, 'Homepage hero subtitle'),
  ('content', 'content_featured_heading', NULL, false, '"Featured stays" section heading'),
  ('content', 'content_destinations_heading', NULL, false, '"Popular destinations" section heading'),
  ('content', 'content_host_ribbon', NULL, false, '"Become a Host" ribbon text ("share & earn")'),
  ('content', 'content_host_heading', NULL, false, '"Become a Host" heading ("Share your space")'),
  ('content', 'content_host_subtitle', NULL, false, '"Become a Host" subtitle'),
  ('content', 'content_host_aside', NULL, false, '"Become a Host" aside line ("your home, your rules")'),
  ('content', 'content_host_button', NULL, false, '"Become a Host" button label')
ON CONFLICT (key) DO NOTHING;
