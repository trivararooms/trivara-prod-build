// Text-contrast derivation for the EXISTING admin-configurable site
// background (Admin Settings > Branding > "Site-wide background", the
// `site_background_css` app_settings key - see
// src/services/siteSettingsService.ts and
// src/components/layout/SiteBackground.tsx). That setting already lets an
// admin pick any solid color or gradient and paints it over
// body/.bg-background - what it doesn't do is keep text readable once the
// admin picks something light. applyTextContrast() below reads that same
// CSS value, estimates whether it's overall light or dark, and flips the
// --foreground-ish CSS vars (which src/index.css hardcodes as a light,
// near-white text color) to near-black when needed.
//
// Deliberately does NOT touch --background/--card/--surface-0..4/--border -
// those stay whatever site_background_css + the hardcoded dark defaults
// produce. This only fixes text contrast, it doesn't re-theme every
// surface.

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.trim().replace(/^#/, '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** WCAG relative luminance (0-1) of a hex color. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Pulls every hex color literal out of a CSS value (solid color or gradient stops). */
export function extractHexColors(css: string): string[] {
  return css.match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g) ?? [];
}

const NEAR_BLACK = { primary: '0 0% 9%', secondary: '0 0% 32%', meta: '0 0% 42%' };
const NEAR_WHITE = { primary: '30 20% 95%', secondary: '20 10% 62%', meta: '20 8% 52%' };

/**
 * Applies readable text colors for the given site-background CSS value by
 * setting the --foreground-ish CSS custom properties on :root (inline
 * style wins over the stylesheet's :root rule). No-ops if the CSS value
 * has no hex colors to read (e.g. a named color or empty string) - the
 * hardcoded dark-theme default text color is already readable against the
 * hardcoded dark-theme default background, so doing nothing is safe.
 */
export function applyTextContrast(css: string): void {
  if (typeof document === 'undefined' || !css) return;

  const hexColors = extractHexColors(css);
  if (hexColors.length === 0) return;

  const avgLuminance = hexColors.reduce((sum, hex) => sum + relativeLuminance(hex), 0) / hexColors.length;
  const fg = avgLuminance > 0.5 ? NEAR_BLACK : NEAR_WHITE;

  const root = document.documentElement.style;
  root.setProperty('--foreground', fg.primary);
  root.setProperty('--card-foreground', fg.primary);
  root.setProperty('--popover-foreground', fg.primary);
  root.setProperty('--text-primary', fg.primary);
  root.setProperty('--text-secondary', fg.secondary);
  root.setProperty('--text-meta', fg.meta);
  root.setProperty('--sidebar-foreground', fg.primary);
}
