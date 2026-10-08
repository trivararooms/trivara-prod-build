import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Listing } from '@/types';
import { formatINR } from '@/lib/utils';

// Price-pill pins (the mock's map pins) instead of Leaflet's default
// image markers: nothing to bundle, and the highlighted state is just a CSS
// class (see .tv-pin in index.css) so it follows the active colour scheme.
function pinIcon(listing: Listing, hot: boolean) {
  return L.divIcon({
    className: `tv-pin${hot ? ' hot' : ''}`,
    html: `<span>${escapeHtml(formatINR(listing.pricePerNight))}</span>`,
    iconSize: [0, 0],
  });
}

interface ListingsMapProps {
  listings: Listing[];
  highlightedListingId?: string | null;
  onMarkerHover?: (id: string | null) => void;
  onMarkerClick?: (id: string) => void;
}

/**
 * Real Leaflet + OpenStreetMap map (no API key required) plotting each
 * listing at listing.location.lat/lng. This replaces the "Interactive map
 * plotting is currently disabled" placeholder that used to render here
 * regardless of what the Map toggle implied.
 *
 * Note: listing coordinates are only as good as what CreateListing.tsx
 * captures, which today hardcodes a placeholder lat/lng until real
 * geocoding is wired up (see CreateListing.tsx) - that's a data-quality gap
 * upstream of this component, not something a map widget can fix on its own.
 */
export function ListingsMap({ listings, highlightedListingId, onMarkerHover, onMarkerClick }: ListingsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Record<string, L.Marker>>({});
  const navigate = useNavigate();

  // Kept in refs (rather than the marker-rebuild effect's dependency array)
  // so a new inline callback from the parent on every render doesn't tear
  // down and rebuild every marker - only `listings` changing should do that.
  const listingsRef = useRef(listings);
  listingsRef.current = listings;
  const onMarkerHoverRef = useRef(onMarkerHover);
  onMarkerHoverRef.current = onMarkerHover;
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
    }).setView([20.5937, 78.9629], 5); // India-wide default view

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerGroup = markersRef.current;
    if (!map || !markerGroup) return;

    markerGroup.clearLayers();
    markersByIdRef.current = {};

    const withCoords = listings.filter(
      (l) => typeof l.location?.lat === 'number' && typeof l.location?.lng === 'number'
    );

    withCoords.forEach((listing) => {
      const marker = L.marker([listing.location.lat, listing.location.lng], { icon: pinIcon(listing, listing.id === highlightedListingId) });
      // Navigation happens from a dedicated link inside the popup rather
      // than the marker click itself, so opening the popup to read details
      // doesn't also immediately navigate away from the map.
      marker.on('popupopen', (e) => {
        const el = e.popup.getElement()?.querySelector('[data-view-listing]');
        el?.addEventListener('click', () => navigate(`/listing/${listing.id}`));
      });
      marker.on('mouseover', () => onMarkerHoverRef.current?.(listing.id));
      marker.on('mouseout', () => onMarkerHoverRef.current?.(null));
      marker.on('click', () => onMarkerClickRef.current?.(listing.id));
      marker.bindPopup(`
        <div style="min-width:160px">
          <strong>${escapeHtml(listing.title)}</strong><br/>
          ${escapeHtml(listing.location.city)}, ${escapeHtml(listing.location.state)}<br/>
          ${formatINR(listing.pricePerNight)} / night<br/>
          <a href="#" data-view-listing style="text-decoration:underline">View listing</a>
        </div>
      `);
      markerGroup.addLayer(marker);
      markersByIdRef.current[listing.id] = marker;
    });

    if (withCoords.length > 0) {
      const bounds = L.latLngBounds(withCoords.map((l) => [l.location.lat, l.location.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, navigate]);

  useEffect(() => {
    Object.entries(markersByIdRef.current).forEach(([id, marker]) => {
      const listing = listingsRef.current.find((l) => l.id === id);
      if (listing) marker.setIcon(pinIcon(listing, id === highlightedListingId));
    });
    if (highlightedListingId) {
      markersByIdRef.current[highlightedListingId]?.setZIndexOffset(1000);
    }
  }, [highlightedListingId]);

  return <div ref={containerRef} className="w-full h-full" />;
}

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
