import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  /** Absolute or root-relative image URL for Open Graph/Twitter cards. */
  image?: string;
  /** Root-relative path (e.g. "/listing/abc123") used to build the canonical URL. Defaults to the current path. */
  path?: string;
  /** Pages that are private/authenticated or otherwise not meant to be indexed (dashboards, account pages, booking receipts, etc). */
  noIndex?: boolean;
  /** Arbitrary JSON-LD structured data object(s) - rendered as one or more <script type="application/ld+json"> tags. */
  jsonLd?: object | object[];
}

const SITE_NAME = 'Trivara';
const DEFAULT_IMAGE = '/trivara-favicon.png';

/** Falls back to window.location.origin (client-only) since the real
    production domain isn't hardcoded anywhere in this repo - see
    VITE_SITE_URL in .env.example. */
function siteUrl(): string {
  if (import.meta.env.VITE_SITE_URL) return import.meta.env.VITE_SITE_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

/**
 * Per-page meta tags (title, description, canonical, Open Graph, Twitter
 * card, robots, optional JSON-LD). Every route should render exactly one of
 * these - either with real content for public/indexable pages, or
 * `noIndex` for authenticated/private ones (dashboards, account settings,
 * booking receipts) that provide no SEO value and shouldn't show up in
 * search results.
 */
export function SEO({ title, description, image, path, noIndex, jsonLd }: SEOProps) {
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const url = `${siteUrl()}${path ?? (typeof window !== 'undefined' ? window.location.pathname : '')}`;
  const absoluteImage = image
    ? (image.startsWith('http') ? image : `${siteUrl()}${image}`)
    : `${siteUrl()}${DEFAULT_IMAGE}`;
  const jsonLdList = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:site_name" content={SITE_NAME} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />

      {jsonLdList.map((data, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(data)}</script>
      ))}
    </Helmet>
  );
}
