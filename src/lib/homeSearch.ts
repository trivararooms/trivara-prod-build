import { addDays } from 'date-fns';
import type { GuestCounts } from '@/components/search/DateGuestsFields';
import type { SearchFilters, SearchSort } from '@/types';

// Everything the home page's live planner + "Every stay, on the map"
// section share. Kept as plain data + pure functions so the filter mapping
// (the part that has to stay in lockstep with listingService.searchListings
// and the /search page's URL params) is unit-tested.

export type ChipKey = 'instant' | 'pets' | 'pool' | 'wifi' | 'workspace' | 'stepfree' | 'beach';

export const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'instant', label: '⚡ Instant Book' },
  { key: 'pets', label: '🐾 Pets ok' },
  { key: 'pool', label: 'Pool' },
  { key: 'wifi', label: 'Wifi' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'stepfree', label: '♿ Step-free' },
  { key: 'beach', label: 'Beach' },
];

// Chip -> amenity id (ids from src/data/amenities.ts). 'instant' is a
// listing flag, not an amenity, so it has no entry.
const CHIP_AMENITY: Partial<Record<ChipKey, string>> = {
  pets: 'pets_allowed',
  pool: 'pool',
  wifi: 'wifi',
  workspace: 'workspace',
  stepfree: 'step_free_access',
  beach: 'beach_access',
};

export const PRICE_CEILING = 30000;
export const PRICE_STEP = 500;
export const EMPTY_GUESTS: GuestCounts = { adults: 1, children: 0, infants: 0, pets: 0 };

export interface HomeSearchState {
  location: string;
  checkIn?: Date;
  checkOut?: Date;
  guests: GuestCounts;
  chips: ChipKey[];
  maxPrice: number;
  sort: SearchSort;
}

export const INITIAL_HOME_SEARCH: HomeSearchState = {
  location: '',
  guests: EMPTY_GUESTS,
  chips: [],
  maxPrice: PRICE_CEILING,
  sort: 'recommended',
};

export function toggleChip(chips: ChipKey[], key: ChipKey): ChipKey[] {
  return chips.includes(key) ? chips.filter((c) => c !== key) : [...chips, key];
}

export function totalGuests(g: GuestCounts): number {
  return g.adults + g.children;
}

/** State -> the filters listingService.searchListings understands. */
export function buildSearchFilters(state: HomeSearchState): SearchFilters {
  const amenities = state.chips.map((c) => CHIP_AMENITY[c]).filter((a): a is string => !!a);
  // Bringing a pet only shows pet-friendly stays (infants never count toward capacity).
  if (state.guests.pets > 0 && !amenities.includes('pets_allowed')) amenities.push('pets_allowed');
  const guests = totalGuests(state.guests);

  return {
    location: state.location.trim() || undefined,
    checkIn: state.checkIn,
    checkOut: state.checkOut,
    guests: guests > 1 ? guests : undefined,
    maxPrice: state.maxPrice < PRICE_CEILING ? state.maxPrice : undefined,
    amenities: amenities.length > 0 ? amenities : undefined,
    instantBook: state.chips.includes('instant') ? true : undefined,
    sort: state.sort !== 'recommended' ? state.sort : undefined,
  };
}

/** State -> the query string the full /search page reads (same keys as SearchBar's submit). */
export function buildSearchParams(state: HomeSearchState): string {
  const params = new URLSearchParams();
  const filters = buildSearchFilters(state);
  if (filters.location) params.set('location', filters.location);
  if (state.checkIn) params.set('checkIn', state.checkIn.toISOString());
  if (state.checkOut) params.set('checkOut', state.checkOut.toISOString());
  if (filters.guests) params.set('guests', String(filters.guests));
  if (state.guests.infants > 0) params.set('infants', String(state.guests.infants));
  if (state.guests.pets > 0) params.set('pets', String(state.guests.pets));
  if (filters.amenities) params.set('amenities', filters.amenities.join(','));
  if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
  if (filters.sort) params.set('sort', filters.sort);
  return params.toString();
}

export interface DateRangeQuick {
  label: string;
  from: Date;
  to: Date;
}

/** Quick-pick ranges relative to `today` (Friday-Sunday weekends, Monday-Thursday midweek). */
export function quickRanges(today: Date = new Date()): DateRangeQuick[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = start.getDay(); // 0 Sun .. 6 Sat
  const friday = addDays(start, (5 - day + 7) % 7); // today if it is already Friday
  const toMonday = ((1 - day + 7) % 7) || 7;
  const monday = addDays(start, toMonday);

  return [
    { label: 'This weekend', from: friday, to: addDays(friday, 2) },
    { label: 'Next weekend', from: addDays(friday, 7), to: addDays(friday, 9) },
    { label: '+3 nights', from: monday, to: addDays(monday, 3) },
  ];
}
