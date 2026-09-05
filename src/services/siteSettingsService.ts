import { supabase } from '@/lib/supabase';

// One word/phrase run with its own optional font + color override. `font`
// must be one of CONTENT_FONT_OPTIONS (a fontFamily key from
// tailwind.config.ts); `color` is a CSS color string (from a native color
// input, so always a hex string in practice). Leaving either null means
// "inherit whatever the surrounding element already renders" - so a piece
// of content nobody has customized yet renders identically to a plain
// hardcoded string.
export interface ContentRun {
  text: string;
  font?: string | null;
  color?: string | null;
}

// Only the two fonts that still look visually distinct from each other
// post-redesign: "script"/"bastliga"/"morderline" all now point at the
// same Fraunces/Inter stacks as "display"/"sans" (see tailwind.config.ts),
// so offering them here would just be duplicate-looking picker entries.
export const CONTENT_FONT_OPTIONS = ['sans', 'display'] as const;

export function textToRuns(text: string): ContentRun[] {
  return text.split(/\s+/).filter(Boolean).map((word) => ({ text: word, font: null, color: null }));
}

// Thin wrapper around the app_settings-backed RPCs (see
// 00000000000001_consolidated_baseline.sql) - get_app_setting/
// update_app_setting already handle arbitrary TEXT values, so a JSON-
// encoded ContentRun[] rides on the exact same two RPCs as a plain string
// setting like the hero background image URL. No schema/RPC changes needed
// beyond seeding the new keys (00000000000016_theme_and_content_settings.sql).
export const siteSettingsService = {
  /** Public read - null means "not set", caller decides the fallback. */
  async getAppSetting(key: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_app_setting', { p_key: key });
    if (error) {
      console.error(`Error fetching app setting "${key}":`, error);
      return null;
    }
    return (data as string | null) || null;
  },

  /** Admin-only (enforced by update_app_setting itself via public.is_admin()). */
  async setAppSetting(key: string, value: string): Promise<void> {
    const { error } = await supabase.rpc('update_app_setting', { p_key: key, p_value: value });
    if (error) throw error;
  },

  async getHeroBackgroundImageUrl(): Promise<string | null> {
    return this.getAppSetting('hero_background_image_url');
  },

  async uploadHeroBackgroundImage(file: File): Promise<string> {
    const url = await uploadSiteAsset(file, 'hero');
    await this.setAppSetting('hero_background_image_url', url);
    return url;
  },

  async getHostCtaBackgroundImageUrl(): Promise<string | null> {
    return this.getAppSetting('host_cta_background_image_url');
  },

  async uploadHostCtaBackgroundImage(file: File): Promise<string> {
    const url = await uploadSiteAsset(file, 'host-cta');
    await this.setAppSetting('host_cta_background_image_url', url);
    return url;
  },

  async getHomepageCollectionImageUrl(slot: number): Promise<string | null> {
    return this.getAppSetting(`homepage_collection_${slot}_image_url`);
  },

  async uploadHomepageCollectionImage(slot: number, file: File): Promise<string> {
    const url = await uploadSiteAsset(file, `collection-${slot}`);
    await this.setAppSetting(`homepage_collection_${slot}_image_url`, url);
    return url;
  },

  async getHomepageCollectionLinkUrl(slot: number): Promise<string | null> {
    return this.getAppSetting(`homepage_collection_${slot}_link_url`);
  },

  async setHomepageCollectionLinkUrl(slot: number, url: string): Promise<void> {
    await this.setAppSetting(`homepage_collection_${slot}_link_url`, url);
  },

  /** Full-bleed banner between Popular Destinations and Featured Stays, 75% of Hero's height. */
  async getHomepage75BannerImageUrl(): Promise<string | null> {
    return this.getAppSetting('homepage_75_banner_image_url');
  },

  async uploadHomepage75BannerImage(file: File): Promise<string> {
    const url = await uploadSiteAsset(file, 'banner-75');
    await this.setAppSetting('homepage_75_banner_image_url', url);
    return url;
  },

  async getHomepage75BannerLinkUrl(): Promise<string | null> {
    return this.getAppSetting('homepage_75_banner_link_url');
  },

  async setHomepage75BannerLinkUrl(url: string): Promise<void> {
    await this.setAppSetting('homepage_75_banner_link_url', url);
  },

  /** Full-bleed banner after the Become-a-Host CTA, same height as Hero (100vh). */
  async getHomepageHeroBannerImageUrl(): Promise<string | null> {
    return this.getAppSetting('homepage_hero_banner_image_url');
  },

  async uploadHomepageHeroBannerImage(file: File): Promise<string> {
    const url = await uploadSiteAsset(file, 'banner-hero');
    await this.setAppSetting('homepage_hero_banner_image_url', url);
    return url;
  },

  async getHomepageHeroBannerLinkUrl(): Promise<string | null> {
    return this.getAppSetting('homepage_hero_banner_link_url');
  },

  async setHomepageHeroBannerLinkUrl(url: string): Promise<void> {
    await this.setAppSetting('homepage_hero_banner_link_url', url);
  },

  /** Raw CSS `background` value (solid color or gradient) applied to <body> sitewide. */
  async getSiteBackground(): Promise<string | null> {
    return this.getAppSetting('site_background_css');
  },

  async setSiteBackground(cssValue: string): Promise<void> {
    await this.setAppSetting('site_background_css', cssValue);
  },

  /** Falls back to `fallback` (split into un-styled runs) if nothing's been customized yet. */
  async getContentRuns(key: string, fallback: string): Promise<ContentRun[]> {
    const raw = await this.getAppSetting(key);
    if (!raw) return textToRuns(fallback);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as ContentRun[];
    } catch (err) {
      console.error(`Malformed content runs for "${key}":`, err);
    }
    return textToRuns(fallback);
  },

  async setContentRuns(key: string, runs: ContentRun[]): Promise<void> {
    await this.setAppSetting(key, JSON.stringify(runs));
  },
};

async function uploadSiteAsset(file: File, folder: string): Promise<string> {
  const path = `${folder}/${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('site-assets')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(data.path);
  return publicUrl;
}
