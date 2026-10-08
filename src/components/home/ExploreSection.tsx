import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ListingsMap } from '@/components/search/ListingsMap';
import { SaveButton } from '@/components/listings/SaveButton';
import { SeeAllResultsLink } from '@/components/home/HeroPlanner';
import { CHIPS, HomeSearchState, PRICE_CEILING, PRICE_STEP, toggleChip } from '@/lib/homeSearch';
import { formatINR } from '@/lib/utils';
import type { Listing, SearchSort } from '@/types';

interface ExploreSectionProps {
  state: HomeSearchState;
  onChange: (patch: Partial<HomeSearchState>) => void;
  listings: Listing[];
  total: number;
  loading: boolean;
  searchQuery: string;
}

const SORTS: { value: SearchSort; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: low → high' },
  { value: 'price_desc', label: 'Price: high → low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
];

/**
 * "Every stay, on the map": live results for whatever the hero planner and
 * the controls below are set to - list on the left, Leaflet map on the
 * right, hover/click on either highlights the other.
 */
export function ExploreSection({ state, onChange, listings, total, loading, searchQuery }: ExploreSectionProps) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  return (
    <div className="grid items-start gap-[22px] lg:grid-cols-[1.1fr_.9fr]">
      <div>
        <div className="nu sticky top-24 z-[5] mb-[18px] grid gap-3 p-[18px]">
          <div className="flex flex-wrap items-center gap-2">
            {CHIPS.map((chip) => {
              const on = state.chips.includes(chip.key);
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={on}
                  data-active={on}
                  onClick={() => onChange({ chips: toggleChip(state.chips, chip.key) })}
                  className="nu-chip rounded-full px-4 py-2.5 font-ui text-[13px] font-semibold transition-transform active:scale-95"
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-ui text-[13px] font-bold">Up to</span>
            <input
              type="range"
              min={2000}
              max={PRICE_CEILING}
              step={PRICE_STEP}
              value={state.maxPrice}
              onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
              aria-label="Maximum price per night"
              className="w-36 accent-[hsl(var(--accent))]"
            />
            <b className="font-ui text-sm">{state.maxPrice >= PRICE_CEILING ? `${formatINR(PRICE_CEILING)}+` : formatINR(state.maxPrice)}</b>
            <span className="flex-1" />
            <select
              value={state.sort}
              onChange={(e) => onChange({ sort: e.target.value as SearchSort })}
              aria-label="Sort"
              className="nu-chip rounded-full px-3.5 py-2.5 font-ui text-[13px] font-semibold text-foreground outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4">
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className="nu h-40 animate-pulse" />)
          ) : listings.length === 0 ? (
            <div className="nu p-12 text-center text-text-secondary">Nothing here yet. Try fewer filters or other dates.</div>
          ) : (
            listings.map((listing) => (
              <div
                key={listing.id}
                ref={(el) => { rowRefs.current[listing.id] = el; }}
                onMouseEnter={() => setHighlightedId(listing.id)}
                onMouseLeave={() => setHighlightedId(null)}
                className={`nu grid cursor-pointer grid-cols-[120px_1fr] gap-4 border-2 p-3 transition-all duration-300 sm:grid-cols-[200px_1fr] sm:gap-[18px] ${
                  highlightedId === listing.id ? 'translate-x-1.5 border-accent' : 'border-transparent'
                }`}
              >
                <Link to={`/listing/${listing.id}`} className="contents">
                  <div className="relative min-h-[150px] overflow-hidden rounded-[18px] bg-surface-2">
                    <img src={listing.photos[0]} alt={listing.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    <SaveButton listingId={listing.id} className="absolute left-2 top-2" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="line-clamp-1 font-display text-[30px] leading-none">{listing.title}</h4>
                    <p className="mb-2.5 mt-1.5 text-[13px] text-text-secondary">
                      {listing.location.city}, {listing.location.state} · {listing.propertyType.replace('_', ' ')} · {listing.maxGuests} guests · ★ {listing.rating.toFixed(2)} ({listing.reviewCount})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2.5 py-1 font-ui text-[11px] font-bold ${listing.instantBook ? 'bg-accent text-accent-foreground' : 'bg-background shadow-[inset_2px_2px_5px_var(--nu-lo),inset_-1px_-1px_4px_var(--nu-hi)]'}`}>
                        {listing.instantBook ? '⚡ Instant Book' : 'Request to Book'}
                      </span>
                      {listing.amenities.includes('pets_allowed') && (
                        <span className="rounded-full bg-background px-2.5 py-1 font-ui text-[11px] font-bold shadow-[inset_2px_2px_5px_var(--nu-lo),inset_-1px_-1px_4px_var(--nu-hi)]">🐾 Pets</span>
                      )}
                      <span className="rounded-full bg-background px-2.5 py-1 font-ui text-[11px] font-bold capitalize shadow-[inset_2px_2px_5px_var(--nu-lo),inset_-1px_-1px_4px_var(--nu-hi)]">
                        {listing.cancellationPolicy} cancel
                      </span>
                    </div>
                    <p className="mt-2.5 font-ui text-[21px] font-extrabold tracking-tight">
                      {formatINR(listing.pricePerNight)} <small className="font-sans text-xs font-normal text-text-secondary">/ night</small>
                    </p>
                  </div>
                </Link>
              </div>
            ))
          )}
        </div>

        {!loading && total > listings.length && (
          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="text-sm text-text-secondary">Showing {listings.length} of {total}</p>
            <SeeAllResultsLink query={searchQuery} />
          </div>
        )}
      </div>

      <div className="nu sticky top-24 hidden h-[calc(100vh-8rem)] p-2 lg:block">
        <div className="h-full overflow-hidden rounded-[20px]">
          {loading ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
            </div>
          ) : (
            <ListingsMap
              listings={listings}
              highlightedListingId={highlightedId}
              onMarkerHover={setHighlightedId}
              onMarkerClick={(id) => {
                setHighlightedId(id);
                rowRefs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
