// Generates public/sitemap.xml (static pages + every published listing) and
// patches the __VITE_SITE_URL__ placeholder in public/robots.txt with the
// real domain - both run once at build time, before `vite build` copies
// public/ into dist/. Needs VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (same
// vars the app itself uses) and VITE_SITE_URL (see .env.example) present in
// the build environment.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const siteUrl = (process.env.VITE_SITE_URL || '').replace(/\/$/, '');
if (!siteUrl) {
  console.warn('[generate-sitemap] VITE_SITE_URL is not set - sitemap.xml URLs and robots.txt will be wrong until it is. Skipping.');
  process.exit(0);
}

const STATIC_PATHS = ['/', '/search', '/host', '/privacy', '/terms', '/help', '/cancellation-options'];

async function getPublishedListingIds() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[generate-sitemap] VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY not set - sitemap will only include static pages.');
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('listings')
    .select('id')
    .eq('published', true)
    .eq('status', 'published');

  if (error) {
    console.warn('[generate-sitemap] Could not fetch listings, sitemap will only include static pages:', error.message);
    return [];
  }
  return (data ?? []).map((row) => row.id);
}

function buildSitemapXml(urlPaths) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = urlPaths
    .map((p) => `  <url>\n    <loc>${siteUrl}${p}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

const listingIds = await getPublishedListingIds();
const allPaths = [...STATIC_PATHS, ...listingIds.map((id) => `/listing/${id}`)];

writeFileSync(path.join(publicDir, 'sitemap.xml'), buildSitemapXml(allPaths));
console.log(`[generate-sitemap] Wrote sitemap.xml with ${allPaths.length} URLs (${listingIds.length} listings).`);

const robotsPath = path.join(publicDir, 'robots.txt');
const robotsTxt = readFileSync(robotsPath, 'utf-8');
writeFileSync(robotsPath, robotsTxt.replaceAll('__VITE_SITE_URL__', siteUrl));
console.log('[generate-sitemap] Patched robots.txt Sitemap: URL.');
