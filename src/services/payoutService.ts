import { supabase } from '@/lib/supabase';

export interface PayoutRequest {
  id: string;
  host_id: string;
  booking_id: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'paid' | 'rejected';
  requested_at: string;
  paid_at: string | null;
  notes: string | null;
  bookings: {
    id: string;
    listing_id: string;
    start_date: string;
    end_date: string;
    listings: { title: string } | null;
  } | null;
}

class PayoutService {
  /**
   * Requests a payout for a completed, unpaid booking. All of the actual
   * validation (host owns the booking, amount matches host_earnings,
   * booking isn't already requested) happens server-side in the
   * `request_payout_by_booking` RPC - the client can't set an arbitrary
   * amount here even if it wanted to.
   */
  async requestPayout(bookingId: string) {
    const { data, error } = await supabase.rpc('request_payout_by_booking', {
      p_booking_id: bookingId
    });

    if (error) {
      console.error('Payout request error:', error);
      throw error;
    }

    if (data && data.success === false) {
      throw new Error(data.error || 'Failed to request payout');
    }

    return data;
  }

  async getHostPayoutRequests(hostId: string): Promise<PayoutRequest[]> {
    const { data, error } = await supabase
      .from('payout_requests')
      .select(`
        *,
        bookings (
          id,
          listing_id,
          start_date,
          end_date,
          listings ( title )
        )
      `)
      .eq('host_id', hostId)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Error fetching payout requests:', error);
      return [];
    }
    return (data as unknown as PayoutRequest[]) || [];
  }
}

export const payoutService = new PayoutService();
