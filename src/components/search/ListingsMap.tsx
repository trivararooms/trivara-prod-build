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

interface ListingsMapProps {
  listings: Listing[];
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
export function ListingsMap({ listings }: ListingsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const navigate = useNavigate();

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
      marker.bindPopup(`
        <div style="min-width:160px">
          <strong>${escapeHtml(listing.title)}</strong><br/>
          ${escapeHtml(listing.location.city)}, ${escapeHtml(listing.location.state)}<br/>
          ${formatINR(listing.pricePerNight)} / night<br/>
          <a href="#" data-view-listing style="text-decoration:underline">View listing</a>
        </div>
      `);
      markerGroup.addLayer(marker);
    });

    if (withCoords.length > 0) {
      const bounds = L.latLngBounds(withCoords.map((l) => [l.location.lat, l.location.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [listings, navigate]);

  return <div ref={containerRef} className="w-full h-full" />;
}

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
