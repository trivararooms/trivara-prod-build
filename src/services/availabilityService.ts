import { supabase } from '../lib/supabase';
import { toDateOnly } from '../lib/utils';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// There is no standalone `availability` table - a listing's booked dates are
// derived entirely from its confirmed/completed bookings. (An earlier
// version of this file had a `getByListingId()` that queried a table which
// was never actually created; it's been removed since nothing called it.)
class AvailabilityService {

  /**
   * Returns true if the given range is free.
   *
   * IMPORTANT: `end_date` on a booking is EXCLUSIVE (the checkout date):
   * a booking Jan 31 -> Feb 4 blocks Jan 31, Feb 1, Feb 2, Feb 3 (not Feb 4),
   * so a new booking Feb 4 -> Feb 5 does not overlap with it. Two ranges
   * overlap only if `existing.start_date < new.end_date AND existing.end_date > new.start_date`.
   */
  async isDateRangeAvailable(listingId: string, startDate: Date, endDate: Date): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id')
        .eq('listing_id', listingId)
        .in('status', ['confirmed', 'completed'])
        .lt('start_date', toDateOnly(endDate))
        .gt('end_date', toDateOnly(startDate));

      if (error) throw error;
      return (data?.length ?? 0) === 0;
    } catch (error: unknown) {
      console.error('Supabase range check failed:', error);
      // Fail open: if availability can't be checked, let the booking attempt
      // proceed and let the DB-level exclusion constraint / conflict check
      // in bookingService.hasBookingConflict be the real gate.
      return true;
    }
  }

  async getUnavailableDates(listingId: string): Promise<Date[]> {
    try {
      const [bookingsResult, blackoutResult] = await Promise.all([
        supabase
          .from('bookings')
          .select('start_date, end_date')
          .eq('listing_id', listingId)
          .in('status', ['confirmed', 'completed']),
        supabase
          .from('listing_blackout_dates')
          .select('start_date, end_date')
          .eq('listing_id', listingId),
      ]);

      if (bookingsResult.error) throw bookingsResult.error;
      if (blackoutResult.error) throw blackoutResult.error;

      const unavailableDates: Date[] = [];
      const ranges = [...(bookingsResult.data || []), ...(blackoutResult.data || [])];
      for (const range of ranges) {
        let currentDate = new Date(range.start_date + 'T00:00:00');
        const endDate = new Date(range.end_date + 'T00:00:00');

        while (currentDate < endDate) {
          unavailableDates.push(new Date(currentDate));
          currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
        }
      }

      return unavailableDates;
    } catch (error: unknown) {
      console.error('Supabase getUnavailableDates failed:', error);
      return [];
    }
  }

  /** Host-set per-date prices for a listing, keyed by 'YYYY-MM-DD'. */
  async getPriceOverrides(listingId: string, startDate: Date, endDate: Date): Promise<Map<string, number>> {
    const { data, error } = await supabase
      .from('listing_price_overrides')
      .select('date, price_per_night')
      .eq('listing_id', listingId)
      .gte('date', toDateOnly(startDate))
      .lt('date', toDateOnly(endDate));

    if (error) {
      console.error('Error fetching price overrides:', error);
      return new Map();
    }

    return new Map((data || []).map((row) => [row.date, row.price_per_night]));
  }

  async calculateTotalPrice(
    listingId: string,
    startDate: Date,
    endDate: Date,
    basePrice: number,
    cleaningFee: number,
    serviceFee: number
  ): Promise<{ nights: number; subtotal: number; cleaningFee: number; serviceFee: number; total: number }> {
    const nights = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));

    // Per-date host overrides (listing_price_overrides) take precedence over
    // the listing's flat basePrice for any date they cover - this is the
    // real backing for "calendar-based price view": a date range spanning a
    // holiday/weekend override actually charges that price, not just shows
    // it cosmetically.
    const overrides = nights > 0 ? await this.getPriceOverrides(listingId, startDate, endDate) : new Map<string, number>();

    let subtotal = 0;
    for (let i = 0; i < nights; i++) {
      const date = toDateOnly(new Date(startDate.getTime() + i * MS_PER_DAY));
      subtotal += overrides.get(date) ?? basePrice;
    }

    return {
      nights,
      subtotal,
      cleaningFee,
      serviceFee,
      total: subtotal + cleaningFee + serviceFee,
    };
  }
}

export const availabilityService = new AvailabilityService();
