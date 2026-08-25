import { supabase } from '../lib/supabase';
import { toDateOnly } from '../lib/utils';

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
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('start_date, end_date')
        .eq('listing_id', listingId)
        .in('status', ['confirmed', 'completed']);

      if (error) throw error;

      const unavailableDates: Date[] = [];
      for (const booking of bookings || []) {
        let currentDate = new Date(booking.start_date + 'T00:00:00');
        const endDate = new Date(booking.end_date + 'T00:00:00');

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

  async calculateTotalPrice(
    listingId: string,
    startDate: Date,
    endDate: Date,
    basePrice: number,
    cleaningFee: number,
    serviceFee: number
  ): Promise<{ nights: number; subtotal: number; cleaningFee: number; serviceFee: number; total: number }> {
    const nights = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
    const subtotal = nights * basePrice;

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
