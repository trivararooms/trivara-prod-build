// Runtime theming for the admin-configurable site background (Admin Settings
// > Appearance, backed by the `theme_background_color` app_settings key -
// see supabase/migrations/00000000000018_admin_theme_color.sql).
//
// src/index.css's `:root` block hardcodes a dark chestnut-brown neutral
// scale (--background, --card, --popover, --surface-0..4, --border,
// --text-primary/-secondary/-meta, --sidebar-background/-foreground) as
// `H S% L%` triples, and tailwind.config.ts wraps every one of them as
// `hsl(var(--xxx))`. applyThemeColor() below overwrites those same
// properties on `document.documentElement` (inline style wins over the
// `:root` rule in the stylesheet), deriving the whole neutral scale from a
// single admin-picked hex color, and picks a near-black or near-white text
// color for whichever of them holds text so it stays readable.
//
// Deliberately does NOT touch --primary/--accent (the indigo/chestnut brand
// colors) or --secondary/--muted/--destructive - only the neutral
// background/surface/foreground scale the admin picker controls.

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.trim().replace(/^#/, '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rN:
        h = 60 * (((gN - bN) / d) % 6);
        break;
      case gN:
        h = 60 * ((bN - rN) / d + 2);
        break;
      default:
        h = 60 * ((rN - gN) / d + 4);
        break;
    }
  }
  if (h < 0) h += 360;

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Converts a hex color (e.g. "#EDE4D3") to the "H S% L%" string every CSS custom property in src/index.css's `:root` expects. */
export function hexToHslString(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  return `${h} ${s}% ${l}%`;
}

/**
 * WCAG relative luminance (0-1) of a hex color. A pragmatic threshold, not
 * full WCAG contrast-ratio math (which also factors in the text color) -
 * good enough to decide "is this background light or dark overall".
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

const NEAR_BLACK = { primary: '0 0% 9%', secondary: '0 0% 32%', meta: '0 0% 42%' };
const NEAR_WHITE = { primary: '30 20% 95%', secondary: '20 10% 62%', meta: '20 8% 52%' };

/**
 * Picks the foreground (text) HSL triple to use against `hex`: near-black
 * text above the 0.5 luminance threshold, near-white below it. Also used
 * for --text-secondary/--text-meta (softened toward mid-gray) and every
 * other foreground-ish var that needs to sit on top of the derived
 * background scale.
 */
export function deriveForegroundHsl(hex: string): string {
  return relativeLuminance(hex) > 0.5 ? NEAR_BLACK.primary : NEAR_WHITE.primary;
}

function clampL(l: number): number {
  return Math.max(2, Math.min(98, l));
}

/**
 * Applies the admin-chosen background color to every neutral CSS variable
 * in src/index.css's `:root` block, deriving surfaces as lighter/darker
 * lightness steps of the same hue/saturation and picking a readable
 * foreground color throughout. Simple fixed-step HSL math - not a full
 * design-token system, but matches the offsets the hardcoded dark theme
 * already uses between --background/--card/--surface-0..4/--border (e.g.
 * --surface-4 sits 18 lightness points off --background there).
 */
export function applyThemeColor(hex: string): void {
  if (typeof document === 'undefined') return;

  const { h, s, l } = hexToHsl(hex);
  const isLight = relativeLuminance(hex) > 0.5;
  // On a light base, "deeper"/more elevated surfaces read better stepping
  // darker (toward shadow); on a dark base (the original design) they step
  // lighter. Same fixed offsets either way, just flipped in sign.
  const dir = isLight ? -1 : 1;
  const shade = (offset: number) => `${h} ${s}% ${clampL(l + dir * offset)}%`;
  const fg = isLight ? NEAR_BLACK : NEAR_WHITE;

  const root = document.documentElement.style;

  root.setProperty('--background', `${h} ${s}% ${l}%`);
  root.setProperty('--foreground', fg.primary);

  root.setProperty('--card', shade(5));
  root.setProperty('--card-foreground', fg.primary);

  root.setProperty('--popover', shade(5));
  root.setProperty('--popover-foreground', fg.primary);

  root.setProperty('--surface-0', shade(-2));
  root.setProperty('--surface-1', shade(2));
  root.setProperty('--surface-2', shade(6));
  root.setProperty('--surface-3', shade(12));
  root.setProperty('--surface-4', shade(18));

  root.setProperty('--border', shade(14));

  root.setProperty('--text-primary', fg.primary);
  root.setProperty('--text-secondary', fg.secondary);
  root.setProperty('--text-meta', fg.meta);

  root.setProperty('--sidebar-background', shade(-2));
  root.setProperty('--sidebar-foreground', fg.primary);
}
