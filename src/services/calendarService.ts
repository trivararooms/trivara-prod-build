import { supabase } from '@/lib/supabase';
import { toDateOnly } from '@/lib/utils';

export interface BlackoutDate {
  id: string;
  listingId: string;
  startDate: Date;
  endDate: Date;
  reason: string | null;
}

export interface PriceOverride {
  id: string;
  listingId: string;
  date: Date;
  pricePerNight: number;
}

/**
 * Host-side calendar management: blocking off dates for personal use, and
 * setting custom per-date pricing. Both were previously not possible at all
 * - a listing's unavailable dates came only from actual bookings, and price
 * was a single flat number with no way to vary it (see
 * 00000000000005_...migration for the tables this reads/writes).
 */
class CalendarService {
  async getBlackoutDates(listingId: string): Promise<BlackoutDate[]> {
    const { data, error } = await supabase
      .from('listing_blackout_dates')
      .select('*')
      .eq('listing_id', listingId)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching blackout dates:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      startDate: new Date(row.start_date + 'T00:00:00'),
      endDate: new Date(row.end_date + 'T00:00:00'),
      reason: row.reason,
    }));
  }

  async addBlackoutDate(
    listingId: string,
    hostId: string,
    startDate: Date,
    endDate: Date,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from('listing_blackout_dates').insert([{
      listing_id: listingId,
      host_id: hostId,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      reason: reason || null,
    }]);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  async removeBlackoutDate(id: string): Promise<boolean> {
    const { error } = await supabase.from('listing_blackout_dates').delete().eq('id', id);
    if (error) {
      console.error('Error removing blackout date:', error);
      return false;
    }
    return true;
  }

  async getPriceOverrides(listingId: string): Promise<PriceOverride[]> {
    const { data, error } = await supabase
      .from('listing_price_overrides')
      .select('*')
      .eq('listing_id', listingId)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching price overrides:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      date: new Date(row.date + 'T00:00:00'),
      pricePerNight: row.price_per_night,
    }));
  }

  /** Upserts one price override per date in [startDate, endDate). */
  async setPriceOverrideRange(
    listingId: string,
    hostId: string,
    startDate: Date,
    endDate: Date,
    pricePerNight: number
  ): Promise<{ success: boolean; error?: string }> {
    const nights = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    if (nights <= 0) return { success: false, error: 'End date must be after start date' };

    const rows = Array.from({ length: nights }, (_, i) => ({
      listing_id: listingId,
      host_id: hostId,
      date: toDateOnly(new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)),
      price_per_night: pricePerNight,
    }));

    const { error } = await supabase
      .from('listing_price_overrides')
      .upsert(rows, { onConflict: 'listing_id,date' });

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  async removePriceOverride(id: string): Promise<boolean> {
    const { error } = await supabase.from('listing_price_overrides').delete().eq('id', id);
    if (error) {
      console.error('Error removing price override:', error);
      return false;
    }
    return true;
  }
}

export const calendarService = new CalendarService();
