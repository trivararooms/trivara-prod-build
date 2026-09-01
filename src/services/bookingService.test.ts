import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock the shared Supabase client module - every service (bookingService and
// the services it calls internally: profileService, listingService,
// availabilityService) imports the same client instance from here, so one
// mock covers the whole call graph exercised by bookingService.create().
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from '@/lib/supabase';
import { bookingService } from './bookingService';
import type { BookingRow, ListingRow } from '@/lib/mappers';
import type { Profile } from './profileService';

const mockFrom = supabase.from as unknown as Mock;
const mockRpc = supabase.rpc as unknown as Mock;
const mockGetSession = supabase.auth.getSession as unknown as Mock;
const mockInvoke = supabase.functions.invoke as unknown as Mock;

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

function bookingRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'booking-1',
    listing_id: 'listing-1',
    guest_id: 'guest-1',
    host_id: 'host-1',
    start_date: '2026-03-10',
    end_date: '2026-03-15',
    guests: 2,
    total_price: 5000,
    status: 'confirmed',
    payment_status: 'paid',
    razorpay_payment_id: 'pay_123',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
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
    instant_book: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function profileRow(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'guest-1',
    email: 'guest@example.com',
    first_name: 'Guest',
    last_name: 'User',
    role: 'guest',
    is_host: false,
    is_verified: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bookingService.getById', () => {
  it('maps a bookings row into a Booking with camelCase fields and Date objects', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({ data: bookingRow(), error: null }));

    const booking = await bookingService.getById('booking-1');

    expect(mockFrom).toHaveBeenCalledWith('bookings');
    expect(booking?.guestId).toBe('guest-1');
    expect(booking?.hostId).toBe('host-1');
    expect(booking?.checkIn).toBeInstanceOf(Date);
    expect(booking?.checkIn.getDate()).toBe(10);
  });

  it('returns undefined instead of throwing when Supabase returns an error', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({ data: null, error: { message: 'not found' } }));

    const booking = await bookingService.getById('missing');

    expect(booking).toBeUndefined();
  });
});

describe('bookingService.hasBookingConflict', () => {
  it('returns true when an overlapping confirmed/completed booking exists', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({ data: [{ id: 'existing' }], error: null }));

    const conflict = await bookingService.hasBookingConflict(
      'listing-1', new Date('2026-03-12'), new Date('2026-03-14')
    );

    expect(conflict).toBe(true);
  });

  it('returns false when no bookings overlap the requested range', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({ data: [], error: null }));

    const conflict = await bookingService.hasBookingConflict(
      'listing-1', new Date('2026-03-12'), new Date('2026-03-14')
    );

    expect(conflict).toBe(false);
  });
});

describe('bookingService.create', () => {
  it('refuses to create a booking when the requested dates conflict with an existing booking', async () => {
    mockFrom
      .mockReturnValueOnce(createBuilder({ data: profileRow(), error: null })) // profileService.getByUserId
      .mockReturnValueOnce(createBuilder({ data: listingRow({ max_guests: 4 }), error: null })) // listingService.getById
      .mockReturnValueOnce(createBuilder({ data: [{ id: 'existing-booking' }], error: null })); // hasBookingConflict

    const result = await bookingService.create(
      'listing-1', 'guest-1', new Date('2026-03-12'), new Date('2026-03-14'), 2
    );

    expect(result).toEqual({ success: false, error: 'Selected dates are no longer available.' });
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockFrom).toHaveBeenCalledWith('listings');
    expect(mockFrom).toHaveBeenCalledWith('bookings');
    // Booking creation should short-circuit on the conflict - never reaching
    // the Razorpay-configured check or an insert attempt.
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('refuses to create a booking when Razorpay is not configured, without inserting anything', async () => {
    mockFrom
      .mockReturnValueOnce(createBuilder({ data: profileRow(), error: null }))
      .mockReturnValueOnce(createBuilder({ data: listingRow({ max_guests: 4 }), error: null }))
      .mockReturnValueOnce(createBuilder({ data: [], error: null })) // no conflict
      .mockReturnValueOnce(createBuilder({ data: [], error: null })); // no price overrides
    mockRpc.mockResolvedValueOnce({ data: 'false', error: null });

    const result = await bookingService.create(
      'listing-1', 'guest-1', new Date('2026-03-12'), new Date('2026-03-14'), 2
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('payment provider is not configured');
    expect(mockRpc).toHaveBeenCalledWith('get_app_setting', { p_key: 'razorpay_enabled' });
    // Exactly 4 `.from()` calls (profiles, listings, bookings-conflict-check,
    // listing_price_overrides for pricing) - no fifth call for an insert.
    expect(mockFrom).toHaveBeenCalledTimes(4);
  });

  it("rejects a booking that exceeds the listing's max guest count before checking availability", async () => {
    mockFrom
      .mockReturnValueOnce(createBuilder({ data: profileRow(), error: null }))
      .mockReturnValueOnce(createBuilder({ data: listingRow({ max_guests: 2 }), error: null }));

    const result = await bookingService.create(
      'listing-1', 'guest-1', new Date('2026-03-12'), new Date('2026-03-14'), 5
    );

    expect(result).toEqual({ success: false, error: 'Maximum 2 guests allowed.' });
  });

  it('creates a confirmed-pending booking end-to-end once Razorpay is enabled and dates are free', async () => {
    mockFrom
      .mockReturnValueOnce(createBuilder({ data: profileRow(), error: null }))
      .mockReturnValueOnce(createBuilder({ data: listingRow({ max_guests: 4, price_per_night: 1000, cleaning_fee: 100, service_fee: 50 }), error: null }))
      .mockReturnValueOnce(createBuilder({ data: [], error: null })) // no conflict
      .mockReturnValueOnce(createBuilder({ data: [], error: null })); // no price overrides
    mockRpc.mockResolvedValueOnce({ data: 'true', error: null });
    const insertBuilder = createBuilder({
      data: bookingRow({ id: 'new-booking', status: 'pending_payment', payment_status: 'pending' }),
      error: null,
    });
    mockFrom.mockReturnValueOnce(insertBuilder);

    const result = await bookingService.create(
      'listing-1', 'guest-1', new Date('2026-03-10'), new Date('2026-03-15'), 2
    );

    expect(result.success).toBe(true);
    expect(result.booking?.id).toBe('new-booking');
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        listing_id: 'listing-1',
        guest_id: 'guest-1',
        host_id: 'host-1',
        status: 'pending_payment',
        payment_status: 'pending',
      }),
    ]);
  });
});

describe('bookingService.cancelBooking', () => {
  it('refuses to cancel a booking that is already cancelled', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({ data: bookingRow({ status: 'cancelled' }), error: null }));

    const result = await bookingService.cancelBooking('booking-1');

    expect(result).toEqual({ success: false, error: 'Booking is already cancelled' });
  });

  it('refuses to cancel a booking on or after its check-in date', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({ data: bookingRow({ status: 'confirmed', start_date: '2000-01-01' }), error: null }));

    const result = await bookingService.cancelBooking('booking-1');

    expect(result).toEqual({ success: false, error: 'Cannot cancel booking after check-in date' });
  });

  it('cancels an unpaid booking with a plain status update and reports refunded:false', async () => {
    mockFrom
      .mockReturnValueOnce(createBuilder({
        data: bookingRow({ status: 'confirmed', payment_status: 'pending', razorpay_payment_id: null, start_date: '2099-01-10' }),
        error: null,
      })) // getById
      .mockReturnValueOnce(createBuilder({ data: null, error: null })) // status update
      .mockReturnValueOnce(createBuilder({ data: [], error: null })); // getUnavailableDates
    mockInvoke.mockResolvedValueOnce({ data: null, error: null }); // sendCancellationEmail

    const result = await bookingService.cancelBooking('booking-1');

    expect(result.success).toBe(true);
    expect(result.refunded).toBe(false);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith('sendBookingCancellationEmail', { body: { booking_id: 'booking-1' } });
  });

  it('routes a paid booking through the refund edge function and reports refunded:true', async () => {
    mockFrom
      .mockReturnValueOnce(createBuilder({
        data: bookingRow({ status: 'confirmed', payment_status: 'paid', razorpay_payment_id: 'pay_1', start_date: '2099-01-10' }),
        error: null,
      })) // getById
      .mockReturnValueOnce(createBuilder({ data: [], error: null })); // getUnavailableDates
    mockGetSession.mockResolvedValueOnce({ data: { session: { access_token: 'token-123' } } });
    mockInvoke
      .mockResolvedValueOnce({ data: { success: true, refunded: true }, error: null }) // refund-razorpay-payment
      .mockResolvedValueOnce({ data: null, error: null }); // sendCancellationEmail

    const result = await bookingService.cancelBooking('booking-1');

    expect(result.success).toBe(true);
    expect(result.refunded).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('refund-razorpay-payment', {
      body: { booking_id: 'booking-1' },
      headers: { Authorization: 'Bearer token-123' },
    });
  });

  it('does not touch the booking again when the refund edge function itself fails', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({
      data: bookingRow({ status: 'confirmed', payment_status: 'paid', razorpay_payment_id: 'pay_1', start_date: '2099-01-10' }),
      error: null,
    })); // getById only
    mockGetSession.mockResolvedValueOnce({ data: { session: { access_token: 'token-123' } } });
    mockInvoke.mockResolvedValueOnce({ data: { success: false, error: 'Refund declined by gateway' }, error: null });

    const result = await bookingService.cancelBooking('booking-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Refund declined by gateway');
    // Only the initial getById lookup touched `bookings` - no status update
    // was attempted once the refund itself failed.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe('bookingService.getStats', () => {
  // Earnings are deliberately NOT part of this method's return value - it
  // used to compute totalEarnings/pendingEarnings itself assuming a 15%
  // platform fee, which disagreed with the actual 18% fee applied by the
  // create_host_earnings_on_completion() DB trigger (see host_earnings /
  // earningsService.getHostEarningsStats(), the real source of truth both
  // HostDashboard and Account now read earnings from). getStats() is counts
  // only now, so there's no longer a second, incorrect number to derive.
  it('aggregates confirmed/completed/total booking counts only', async () => {
    mockFrom.mockReturnValueOnce(createBuilder({
      data: [
        bookingRow({ id: 'b1', status: 'confirmed', total_price: 1000 }),
        bookingRow({ id: 'b2', status: 'completed', total_price: 2000 }),
        bookingRow({ id: 'b3', status: 'cancelled', total_price: 500 }),
      ],
      error: null,
    }));

    const stats = await bookingService.getStats('host-1');

    expect(stats).toEqual({
      totalBookings: 3,
      confirmedBookings: 1,
      completedBookings: 1,
    });
  });
});

describe('bookingService.getUpcomingByGuestId', () => {
  it('keeps only confirmed, future-dated bookings', async () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    mockFrom.mockReturnValueOnce(createBuilder({
      data: [
        bookingRow({ id: 'future-confirmed', status: 'confirmed', start_date: toISODate(future), end_date: toISODate(future) }),
        bookingRow({ id: 'past-completed', status: 'completed', start_date: toISODate(past), end_date: toISODate(past) }),
        bookingRow({ id: 'future-cancelled', status: 'cancelled', start_date: toISODate(future), end_date: toISODate(future) }),
      ],
      error: null,
    }));

    const upcoming = await bookingService.getUpcomingByGuestId('guest-1');

    expect(upcoming.map(b => b.id)).toEqual(['future-confirmed']);
  });
});

describe('bookingService.createRazorpayOrder', () => {
  it('returns the created order on success', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { access_token: 'token-abc' } } });
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, order: { id: 'order_1', amount: 500000, currency: 'INR', key_id: 'rzp_test' } },
      error: null,
    });

    const result = await bookingService.createRazorpayOrder('booking-1');

    expect(result.success).toBe(true);
    expect(result.order?.id).toBe('order_1');
    expect(mockInvoke).toHaveBeenCalledWith('create-razorpay-order', {
      body: { booking_id: 'booking-1' },
      headers: { Authorization: 'Bearer token-abc' },
    });
  });

  it('fails fast when there is no authenticated session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const result = await bookingService.createRazorpayOrder('booking-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('User not authenticated');
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
