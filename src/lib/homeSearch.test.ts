import { describe, it, expect } from 'vitest';
import {
  INITIAL_HOME_SEARCH,
  PRICE_CEILING,
  buildSearchFilters,
  buildSearchParams,
  quickRanges,
  toggleChip,
} from './homeSearch';

describe('homeSearch', () => {
  it('maps an untouched planner to no filters at all', () => {
    const f = buildSearchFilters(INITIAL_HOME_SEARCH);
    expect(f.location).toBeUndefined();
    expect(f.guests).toBeUndefined();
    expect(f.maxPrice).toBeUndefined();
    expect(f.amenities).toBeUndefined();
    expect(f.instantBook).toBeUndefined();
    expect(f.sort).toBeUndefined();
  });

  it('counts adults + children as guests, never infants', () => {
    const f = buildSearchFilters({ ...INITIAL_HOME_SEARCH, guests: { adults: 2, children: 1, infants: 3, pets: 0 } });
    expect(f.guests).toBe(3);
  });

  it('bringing a pet forces the pet-friendly amenity (once)', () => {
    const withPet = buildSearchFilters({ ...INITIAL_HOME_SEARCH, guests: { adults: 1, children: 0, infants: 0, pets: 1 } });
    expect(withPet.amenities).toEqual(['pets_allowed']);
    const both = buildSearchFilters({ ...INITIAL_HOME_SEARCH, chips: ['pets'], guests: { adults: 1, children: 0, infants: 0, pets: 2 } });
    expect(both.amenities).toEqual(['pets_allowed']);
  });

  it('maps chips to amenity ids and the instant-book flag', () => {
    const f = buildSearchFilters({ ...INITIAL_HOME_SEARCH, chips: ['instant', 'pool', 'stepfree'] });
    expect(f.instantBook).toBe(true);
    expect(f.amenities).toEqual(['pool', 'step_free_access']);
  });

  it('only sets maxPrice below the ceiling', () => {
    expect(buildSearchFilters({ ...INITIAL_HOME_SEARCH, maxPrice: PRICE_CEILING }).maxPrice).toBeUndefined();
    expect(buildSearchFilters({ ...INITIAL_HOME_SEARCH, maxPrice: 8000 }).maxPrice).toBe(8000);
  });

  it('toggles chips', () => {
    expect(toggleChip([], 'wifi')).toEqual(['wifi']);
    expect(toggleChip(['wifi', 'pool'], 'wifi')).toEqual(['pool']);
  });

  it('builds the /search query string with the same keys the search page reads', () => {
    const qs = buildSearchParams({
      ...INITIAL_HOME_SEARCH,
      location: ' Coorg ',
      guests: { adults: 2, children: 0, infants: 1, pets: 1 },
      chips: ['pool'],
      maxPrice: 9000,
      sort: 'price_asc',
    });
    const p = new URLSearchParams(qs);
    expect(p.get('location')).toBe('Coorg');
    expect(p.get('guests')).toBe('2');
    expect(p.get('infants')).toBe('1');
    expect(p.get('pets')).toBe('1');
    expect(p.get('amenities')).toBe('pool,pets_allowed');
    expect(p.get('maxPrice')).toBe('9000');
    expect(p.get('sort')).toBe('price_asc');
  });

  it('quick ranges are Friday-Sunday weekends and a 3-night midweek', () => {
    const [thisWk, nextWk, mid] = quickRanges(new Date(2026, 9, 7)); // Wed 7 Oct 2026
    expect(thisWk.from.getDay()).toBe(5);
    expect(thisWk.from.getDate()).toBe(9);
    expect(thisWk.to.getDate()).toBe(11);
    expect(nextWk.from.getDate()).toBe(16);
    expect(mid.from.getDay()).toBe(1);
    expect(mid.to.getTime() - mid.from.getTime()).toBe(3 * 24 * 3600 * 1000);
  });
});
