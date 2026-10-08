// Deterministic generated "landscape" used as the cinematic fallback behind
// the home hero / host section when an admin hasn't uploaded a photo (the
// admin photo, when set, always wins - see Index.tsx). Ported from the
// approved Voyage mock so the first paint matches it exactly.

export interface ArtOptions {
  /** 0-360 base hue */
  hue?: number;
  /** variant index - shifts hue, sun position and brightness */
  variant?: number;
  width?: number;
  height?: number;
  /** draw a water band instead of foreground hill (coastal / river feel) */
  water?: boolean;
  /** draw the little house silhouette */
  house?: boolean;
}

export function generatedArtSvg({ hue = 150, variant = 0, width = 1600, height = 900, water = false, house = true }: ArtOptions = {}): string {
  const w = width;
  const h = height;
  const hh = (hue + variant * 24) % 360;
  const id = `ga${Math.round(hue)}${variant}`;
  const sunX = 120 + ((variant * 211 + hue * 3) % Math.max(w - 200, 300));
  const sunY = 120 + ((variant * 37) % 100);
  const odd = variant % 2 === 1;

  const foreground = water
    ? `<rect y="${h * 0.78}" width="${w}" height="${h * 0.22}" fill="hsl(${hh},45%,60%)" opacity=".85"/><path d="M0 ${h * 0.84}H${w}M0 ${h * 0.9}H${w}" stroke="#fff" stroke-opacity=".35" stroke-dasharray="40 30"/>`
    : `<path d="M0 ${h * 0.82} Q ${w * 0.4} ${h * 0.66} ${w} ${h * 0.8} V${h} H0Z" fill="hsl(${hh},36%,22%)"/>`;

  const houseSvg = house
    ? `<g fill="hsl(${hh},30%,12%)"><rect x="${w * 0.56}" y="${h * 0.6}" width="${w * 0.14}" height="${h * 0.12}"/><path d="M${w * 0.54} ${h * 0.6} L${w * 0.63} ${h * 0.5} L${w * 0.72} ${h * 0.6}Z"/><rect x="${w * 0.6}" y="${h * 0.64}" width="14" height="22" fill="hsl(${(hh + 40) % 360},90%,75%)"/></g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hh},55%,${odd ? 62 : 76}%)"/><stop offset="1" stop-color="hsl(${(hh + 28) % 360},70%,${odd ? 78 : 90}%)"/></linearGradient>
    <radialGradient id="${id}g"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#${id}s)"/>
    <circle cx="${sunX}" cy="${sunY}" r="120" fill="url(#${id}g)"/><circle cx="${sunX}" cy="${sunY}" r="34" fill="hsl(${(hh + 40) % 360},90%,92%)"/>
    <path d="M0 ${h * 0.62} Q ${w * 0.2} ${h * 0.42} ${w * 0.42} ${h * 0.58} T ${w} ${h * 0.5} V${h} H0Z" fill="hsl(${hh},28%,48%)" opacity=".8"/>
    <path d="M0 ${h * 0.7} Q ${w * 0.3} ${h * 0.5} ${w * 0.6} ${h * 0.68} T ${w} ${h * 0.6} V${h} H0Z" fill="hsl(${hh},32%,34%)"/>
    ${foreground}${houseSvg}</svg>`;
}

/** CSS `url(...)` value ready for `backgroundImage`. */
export function generatedArtUrl(options: ArtOptions = {}): string {
  return `url("data:image/svg+xml,${encodeURIComponent(generatedArtSvg(options))}")`;
}
