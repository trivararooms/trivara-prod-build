import { Booking, BookingStatus } from '@/types';
import { availabilityService } from './availabilityService';
import { listingService } from './listingService';
import { profileService } from './profileService';
import { supabase } from '../lib/supabase';
import { toDateOnly } from '../lib/utils';
import { mapBooking, BookingRow } from '../lib/mappers';
import { getErrorMessage } from '../lib/errors';

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  key_id: string;
}

class BookingService {

  async getAll(): Promise<Booking[]> {
    const { data, error } = await supabase.from('bookings').select('*');

    if (error) {
      console.error('Error fetching bookings:', error);
      return [];
    }

    return (data as BookingRow[]).map(mapBooking);
  }

  async getById(id: string): Promise<Booking | undefined> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching booking:', error);
      return undefined;
    }

    return mapBooking(data as BookingRow);
  }

  async getByGuestId(guestId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('guest_id', guestId);

    if (error) {
      console.error('Error fetching bookings by guest:', error);
      return [];
    }

    return (data as BookingRow[]).map(mapBooking);
  }

  async getByHostId(hostId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('host_id', hostId);

    if (error) {
      console.error('Error fetching bookings by host:', error);
      return [];
    }

    return (data as BookingRow[]).map(mapBooking);
  }

  async getByListingId(listingId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('listing_id', listingId);

    if (error) {
      console.error('Error fetching bookings by listing:', error);
      return [];
    }

    return (data as BookingRow[]).map(mapBooking);
  }

  async create(
    listingId: string,
    guestId: string,
    checkIn: Date,
    checkOut: Date,
    guests: number
  ): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    try {
      // Guests get a `profiles` row from the handle_new_user trigger on
      // signup, but older accounts (or a trigger that failed once) can be
      // missing one; the FK on bookings.guest_id would otherwise reject the
      // insert with an opaque error. ensure_profile_exists is SECURITY
      // DEFINER so it can create the row even under RLS.
      let profile = await profileService.getByUserId(guestId);
      if (!profile) {
        const { error: ensureError } = await supabase.rpc('ensure_profile_exists', { user_id: guestId });
        if (ensureError) {
          console.debug('RPC ensure_profile_exists failed:', ensureError);
        }
        profile = await profileService.getByUserId(guestId);
      }

      const listing = await listingService.getById(listingId);
      if (!listing) {
        return { success: false, error: 'Listing not found.' };
      }

      if (guests > listing.maxGuests) {
        return { success: false, error: `Maximum ${listing.maxGuests} guests allowed.` };
      }

      const hasConflict = await this.hasBookingConflict(listingId, checkIn, checkOut);
      if (hasConflict) {
        return { success: false, error: 'Selected dates are no longer available.' };
      }

      const pricing = await availabilityService.calculateTotalPrice(
        listingId,
        checkIn,
        checkOut,
        listing.pricePerNight,
        listing.cleaningFee || 0,
        listing.serviceFee || 0
      );

      const { data: razorpayEnabled, error: rpcError } = await supabase.rpc('get_app_setting', { p_key: 'razorpay_enabled' });
      if (rpcError) console.error('get_app_setting RPC error:', rpcError);
      const isRazorpayEnabled = razorpayEnabled === 'true';

      // Booking used to confirm immediately (no payment step at all) when
      // Razorpay was disabled - but nothing downstream is built for that
      // path: no confirmation email ever sends for it (that only fires from
      // inside the Razorpay webhook), and a "confirmed" booking with no
      // payment behind it is a real gap, not a feature. Refusing to create
      // the booking at all until a payment provider is actually configured
      // closes that gap instead of papering over it.
      if (!isRazorpayEnabled) {
        return {
          success: false,
          error: 'Booking is not possible right now: the payment provider is not configured.',
        };
      }

      // end_date is exclusive (checkout date) - see availabilityService for
      // the overlap logic this depends on.
      const bookingPayload: Record<string, unknown> = {
        listing_id: listingId,
        guest_id: guestId,
        host_id: listing.hostId,
        start_date: toDateOnly(checkIn),
        end_date: toDateOnly(checkOut),
        guests,
        total_price: pricing.total,
        status: 'pending_payment',
        payment_status: 'pending',
      };

      const { data: b, error: insertError } = await supabase
        .from('bookings')
        .insert([bookingPayload])
        .select('*')
        .single();

      if (insertError) {
        return { success: false, error: `Booking failed: ${insertError.message}` };
      }

      return { success: true, booking: mapBooking(b as BookingRow) };
    } catch (error: unknown) {
      console.error('Booking failed:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async hasBookingConflict(
    listingId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<boolean> {
    // Two ranges overlap if: existing.start < new.end AND existing.end > new.start
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('listing_id', listingId)
      .in('status', ['confirmed', 'completed']) // Only confirmed/completed bookings actually hold a date
      .lt('start_date', toDateOnly(checkOut))
      .gt('end_date', toDateOnly(checkIn));

    if (error) {
      console.error('Error checking booking conflicts:', error);
      throw error;
    }

    return (data?.length ?? 0) > 0;
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking | undefined> {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to update booking status');
    }

    return mapBooking(data as BookingRow);
  }

  async complete(id: string): Promise<Booking | undefined> {
    // Host earnings for a completed booking are now created server-side by
    // the `create_host_earnings_on_completion` trigger (see
    // supabase/migrations), which has a unique constraint on booking_id -
    // this fixes the duplicate-payout bug that migrations/fix_duplicate_payouts.sql
    // had to patch after the fact. The client no longer inserts into
    // host_earnings directly.
    return this.updateStatus(id, 'completed');
  }

  async cancelBooking(bookingId: string): Promise<{ success: boolean; error?: string; unavailableDates?: Date[]; refunded?: boolean }> {
    try {
      const booking = await this.getById(bookingId);
      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }
      if (booking.status === 'cancelled') {
        return { success: false, error: 'Booking is already cancelled' };
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const checkInDate = new Date(booking.checkIn);
      checkInDate.setHours(0, 0, 0, 0);

      if (now >= checkInDate) {
        return { success: false, error: 'Cannot cancel booking after check-in date' };
      }

      // A booking that was actually paid via Razorpay needs a real refund,
      // not just a status flip - route those through the
      // refund-razorpay-payment Edge Function, which calls the Razorpay
      // Refunds API and then updates payment_status/status together.
      const paymentNeedsRefund = booking.paymentStatus === 'paid' && !!booking.razorpayPaymentId;
      let refunded = false;

      if (paymentNeedsRefund) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          return { success: false, error: 'You must be signed in to cancel this booking.' };
        }

        const { data, error } = await supabase.functions.invoke('refund-razorpay-payment', {
          body: { booking_id: bookingId },
          headers: { Authorization: `Bearer ${token}` },
        });

        if (error || !data?.success) {
          // This booking was actually charged - refusing to mark it cancelled
          // without a successful refund avoids stranding the guest's payment.
          console.error('Refund failed, booking left uncancelled:', error || data?.error);
          return {
            success: false,
            error: getErrorMessage(error, data?.error || 'We could not process your refund automatically. Please contact support to cancel this booking.'),
          };
        }

        refunded = !!data.refunded;
      } else {
        // Nothing was ever charged (Razorpay disabled, or payment never
        // completed) - a plain status update is safe here.
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', bookingId);

        if (updateError) {
          console.error('Supabase update error:', updateError);
          return { success: false, error: `Failed to cancel booking: ${updateError.message}` };
        }
      }

      const unavailableDates = await availabilityService.getUnavailableDates(booking.listingId);

      try {
        await this.sendCancellationEmails(bookingId);
      } catch (emailError) {
        console.warn('Failed to send cancellation emails:', emailError);
        // Don't fail the cancellation if emails fail
      }

      return { success: true, unavailableDates, refunded };
    } catch (error: unknown) {
      console.error('cancelBooking failed:', error);
      return { success: false, error: getErrorMessage(error, 'An unexpected error occurred while cancelling the booking') };
    }
  }

  private async sendCancellationEmails(bookingId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('sendBookingCancellationEmail', {
      body: { booking_id: bookingId }
    });
    if (error) {
      console.error('Error calling sendBookingCancellationEmail function:', error);
      throw error;
    }
  }

  async getUpcomingByGuestId(guestId: string): Promise<Booking[]> {
    const allBookings = await this.getByGuestId(guestId);
    const now = new Date();
    return allBookings
      .filter(b => b.status === 'confirmed' && new Date(b.checkIn) > now)
      .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());
  }

  async getPastByGuestId(guestId: string): Promise<Booking[]> {
    const allBookings = await this.getByGuestId(guestId);
    return allBookings
      .filter(b => b.status === 'completed')
      .sort((a, b) => new Date(b.checkOut).getTime() - new Date(a.checkOut).getTime());
  }

  async getStats(hostId: string) {
    const hostBookings = await this.getByHostId(hostId);
    const confirmed = hostBookings.filter(b => b.status === 'confirmed');
    const completed = hostBookings.filter(b => b.status === 'completed');
    const totalEarnings = completed.reduce((sum, b) => sum + b.totalPrice * 0.85, 0);
    const pendingEarnings = confirmed.reduce((sum, b) => sum + b.totalPrice * 0.85, 0);

    return {
      totalBookings: hostBookings.length,
      confirmedBookings: confirmed.length,
      completedBookings: completed.length,
      totalEarnings,
      pendingEarnings,
    };
  }

  async createRazorpayOrder(bookingId: string): Promise<{ success: boolean; order?: RazorpayOrder; error?: string }> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: { booking_id: bookingId },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) {
        console.error('Error calling create-razorpay-order:', error);
        return { success: false, error: error.message };
      }
      if (!data?.success) {
        return { success: false, error: data?.error || 'Failed to create Razorpay order' };
      }

      return { success: true, order: data.order };
    } catch (error: unknown) {
      console.error('Razorpay order creation failed:', error);
      return { success: false, error: getErrorMessage(error, 'Payment initiation failed') };
    }
  }
}

export const bookingService = new BookingService();
