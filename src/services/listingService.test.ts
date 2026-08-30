import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

import { supabase } from '@/lib/supabase';
import { listingService } from './listingService';
import type { ListingRow } from '@/lib/mappers';

const mockFrom = supabase.from as unknown as Mock;
const mockGetUser = supabase.auth.getUser as unknown as Mock;

interface BuilderResult<T> {
  data: T;
  error: unknown;
  count?: number | null;
}

/**
 * A minimal stand-in for the Supabase JS query builder: every filter/mutation
 * method (`.select()`, `.eq()`, `.insert()`, ...) returns the same object so
 * calls keep chaining, and the object itself is thenable so `await` resolves
 * to the canned result - matching how the real PostgrestFilterBuilder works.
 */
function createBuilder<T>(result: BuilderResult<T>) {
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'like', 'ilike',
    'order', 'limit', 'range', 'maybeSingle', 'single',
  ] as const;

  const builder: Record<string, unknown> = {};
  for (const method of methods) {
    builder[method] = vi.fn(() => builder);
  }
  (builder as unknown as PromiseLike<BuilderResult<T>>).then = (onFulfilled, onRejected) =>
    Promise.resolve(result).then(onFulfilled, onRejected);

  return builder as typeof builder & Record<(typeof methods)[number], Mock>;
}

function listingRow(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    id: 'listing-1',
    host_id: 'host-1',
    title: 'Cozy cabin',
    description: 'A nice place',
    details: { address: '1 Main St', city: 'Goa', state: 'GA', country: 'India', postalCode: '403001', lat: 1, lng: 2 },
    price_per_night: 2000,
    amenities: ['wifi'],
    max_guests: 4,
    property_type: 'entire_place',
    status: 'published',
    rating: 4.5,
    review_count: 10,
    photos: ['a.jpg'],
    bedrooms: 2,
    bathrooms: 1,
    beds: 2,
    cancellation_policy: 'moderate',
    cleaning_fee: 100,
    service_fee: 50,
    house_rules: ['No smoking'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listingService.getById / getByHostId', () => {
  it('maps a listings row into camelCase fields', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({ data: listingRow({ id: 'l1' }), error: null }));

    const listing = await listingService.getById('l1');

    expect(mockFrom).toHaveBeenCalledWith('listings');
    expect(listing?.pricePerNight).toBe(2000);
    expect(listing?.hostId).toBe('host-1');
    expect(listing?.propertyType).toBe('entire_place');
  });

  it('returns an empty array instead of throwing when Supabase errors', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({ data: null, error: { message: 'denied' } }));

    const listings = await listingService.getByHostId('host-1');

    expect(listings).toEqual([]);
  });
});

describe('listingService.searchListings', () => {
  it('applies simple filters at the database level and paginates via range()', async () => {
    const rows = [listingRow({ id: 'l1' }), listingRow({ id: 'l2' })];
    const builder = createBuilder({ data: rows, error: null, count: 42 });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listingService.searchListings(
      { guests: 3, minPrice: 1000, maxPrice: 5000, minRating: 4 },
      2,
      10
    );

    expect(mockFrom).toHaveBeenCalledWith('listings');
    expect(builder.gte).toHaveBeenCalledWith('max_guests', 3);
    expect(builder.gte).toHaveBeenCalledWith('price_per_night', 1000);
    expect(builder.lte).toHaveBeenCalledWith('price_per_night', 5000);
    expect(builder.gte).toHaveBeenCalledWith('rating', 4);
    expect(builder.range).toHaveBeenCalledWith(10, 19); // page 2, pageSize 10 -> startIndex 10
    expect(result.total).toBe(42);
    expect(result.listings).toHaveLength(2);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  it('filters location text in JS and recalculates total when complex filters are active', async () => {
    const rows = [
      listingRow({
        id: 'l1', title: 'Cozy Goa Villa',
        details: { address: '', city: 'Goa', state: 'GA', country: 'India', postalCode: '', lat: 0, lng: 0 },
      }),
      listingRow({
        id: 'l2', title: 'Downtown Loft',
        details: { address: '', city: 'Mumbai', state: 'MH', country: 'India', postalCode: '', lat: 0, lng: 0 },
      }),
    ];
    const builder = createBuilder({ data: rows, error: null, count: 2 });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listingService.searchListings({ location: 'goa' }, 1, 20);

    expect(builder.limit).toHaveBeenCalledWith(200);
    expect(builder.range).not.toHaveBeenCalled();
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].id).toBe('l1');
    expect(result.total).toBe(1);
  });

  it('returns an empty result instead of throwing when the query errors', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({ data: null, error: { message: 'boom' } }));

    const result = await listingService.searchListings({}, 1, 20);

    expect(result).toEqual({ listings: [], total: 0, page: 1, pageSize: 20 });
  });
});

describe('listingService.create', () => {
  it('throws when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await expect(listingService.create({
      hostId: 'host-1',
      title: 'x',
      description: 'y',
      location: { address: '', city: '', state: '', country: '', postalCode: '', lat: 0, lng: 0 },
      propertyType: 'entire_place',
      photos: [],
      amenities: [],
      pricePerNight: 100,
      cleaningFee: 0,
      serviceFee: 0,
      maxGuests: 2,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      houseRules: [],
      cancellationPolicy: 'flexible',
    })).rejects.toThrow('User not authenticated');
  });

  it('inserts a listing scoped to the authenticated user and returns the mapped result', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'host-1' } }, error: null });
    const builder = createBuilder({ data: listingRow({ id: 'new-listing', host_id: 'host-1', price_per_night: 2500 }), error: null });
    mockFrom.mockReturnValueOnce(builder);

    const listing = await listingService.create({
      hostId: 'host-1',
      title: 'Cozy cabin',
      description: 'desc',
      location: { address: '1 Main St', city: 'Goa', state: 'GA', country: 'India', postalCode: '403001', lat: 1, lng: 2 },
      propertyType: 'entire_place',
      photos: ['a.jpg'],
      amenities: ['wifi'],
      pricePerNight: 2500,
      cleaningFee: 100,
      serviceFee: 50,
      maxGuests: 4,
      bedrooms: 2,
      beds: 2,
      bathrooms: 1,
      houseRules: ['No smoking'],
      cancellationPolicy: 'moderate',
    });

    expect(builder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ host_id: 'host-1', price_per_night: 2500, status: 'draft' }),
    ]);
    expect(listing?.id).toBe('new-listing');
  });
});

describe('listingService.publishListing', () => {
  it('refuses to publish a listing with no title', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'host-1' } }, error: null });
    mockFrom.mockReturnValueOnce(createBuilder({ data: listingRow({ title: '' }), error: null }));

    await expect(listingService.publishListing('l1')).rejects.toThrow('Title is required to publish listing');
  });

  it('refuses to publish a listing with an invalid price', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'host-1' } }, error: null });
    mockFrom.mockReturnValueOnce(createBuilder({ data: listingRow({ price_per_night: 0 }), error: null }));

    await expect(listingService.publishListing('l1')).rejects.toThrow('Valid price per night is required to publish listing');
  });

  it('publishes a valid draft listing, flipping status and published', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'host-1' } }, error: null });
    mockFrom
      .mockReturnValueOnce(createBuilder({ data: listingRow({ title: 'Valid', price_per_night: 1000 }), error: null })) // fetch
      .mockReturnValueOnce(createBuilder({ data: listingRow({ status: 'published' }), error: null })); // update

    const listing = await listingService.publishListing('l1');

    expect(listing?.status).toBe('published');
  });
});

describe('listingService.delete', () => {
  it('resolves true when the delete succeeds', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({ data: null, error: null }));

    await expect(listingService.delete('l1')).resolves.toBe(true);
  });

  it('throws when the delete errors', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({ data: null, error: { message: 'denied' } }));

    await expect(listingService.delete('l1')).rejects.toBeTruthy();
  });
});
