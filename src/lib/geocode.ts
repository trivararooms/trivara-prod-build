// Every listing on this platform is restricted to Karnataka, India (see
// src/data/karnatakaLocations.ts) - geocoding just needs to turn a host's
// typed address into real coordinates instead of the SF placeholder
// CreateListing.tsx used to hardcode. Nominatim (OpenStreetMap's public
// geocoder) needs no API key and is what src/components/search/
// ListingsMap.tsx already uses for tiles, so this stays in the same
// ecosystem rather than adding a new provider/credential.
//
// Nominatim's usage policy caps this at ~1 request/second and asks for an
// identifying User-Agent - browsers won't let fetch() set a custom one, but
// they do send the page's own Referer automatically, which is the accepted
// alternative for low-volume client-side use like "a host publishes a
// listing," not a bulk/systematic job.
interface AddressParts {
  address?: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Bengaluru's center - used only if geocoding fails, so a listing is at least in the right region rather than in San Francisco. */
export const FALLBACK_COORDINATES: Coordinates = { lat: 12.9716, lng: 77.5946 };

export async function geocodeAddress(parts: AddressParts): Promise<Coordinates | null> {
  const query = [parts.address, parts.city, parts.state, parts.postalCode, parts.country].filter(Boolean).join(', ');
  if (!query) return null;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    );
    if (!response.ok) return null;

    const results = await response.json();
    const first = results?.[0];
    if (!first) return null;

    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return { lat, lng };
  } catch (err) {
    console.error('Geocoding failed:', err);
    return null;
  }
}
