import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Listing } from '@/types';
import { formatINR } from '@/lib/utils';

// Vite bundles leaflet's marker images as regular imports rather than the
// default relative-URL lookup leaflet.js does internally (which breaks under
// a bundler) - without this, markers render as broken image icons.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const defaultIcon = new L.Icon.Default();

// A visually distinct, larger pin swapped in for whichever marker
// corresponds to the currently hovered/clicked listing. Built as an inline
// SVG divIcon rather than a second image asset so there's nothing extra to
// bundle or fetch.
const highlightedIcon = L.divIcon({
  className: '',
  html: `<svg width="34" height="34" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4))">
    <path d="M12 0C7.6 0 4 3.6 4 8c0 6 8 16 8 16s8-10 8-16c0-4.4-3.6-8-8-8z" fill="#e11d48" stroke="#ffffff" stroke-width="1"/>
    <circle cx="12" cy="8" r="3" fill="#ffffff"/>
  </svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

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
      const marker = L.marker([listing.location.lat, listing.location.lng]);
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
    // Re-apply whichever marker is currently highlighted, since the markers
    // above were all just rebuilt with the default icon.
    Object.entries(markersByIdRef.current).forEach(([id, marker]) => {
      marker.setIcon(id === highlightedListingId ? highlightedIcon : defaultIcon);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, navigate]);

  useEffect(() => {
    Object.entries(markersByIdRef.current).forEach(([id, marker]) => {
      marker.setIcon(id === highlightedListingId ? highlightedIcon : defaultIcon);
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
