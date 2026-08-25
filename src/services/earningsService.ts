import { supabase } from '@/lib/supabase';

export type HostEarning = {
  booking_id: string;
  host_id: string;
  listing_id: string;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  status: 'pending' | 'paid';
  created_at: string;
  // Listing information
  listing_title: string;
  // Booking information (if we can get it through join)
  check_in?: string;
  check_out?: string;
};

interface HostEarningRow {
  booking_id: string;
  host_id: string;
  listing_id: string;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  status: 'pending' | 'paid';
  created_at: string;
  listings: { title: string } | null;
}

class EarningsService {
  async getHostEarnings(hostId: string): Promise<HostEarning[]> {
    // Actually join `listings(title)` - the old select list here only asked
    // for scalar columns, so `earning.listings?.title` below was always
    // undefined and every row showed "Unknown Property" regardless of the
    // real listing.
    const { data, error } = await supabase
      .from('host_earnings')
      .select(`
        booking_id,
        host_id,
        listing_id,
        gross_amount,
        platform_fee,
        net_amount,
        status,
        created_at,
        listings ( title )
      `)
      .eq('host_id', hostId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch earnings', error);
      return [];
    }

    return (data as unknown as HostEarningRow[]).map((earning) => ({
      ...earning,
      listing_title: earning.listings?.title || 'Unknown Property',
    }));
  }

  async getPayableEarningsAmount(hostId: string): Promise<number> {
    // Since available_on is not available, all pending earnings are considered payable
    const { data, error } = await supabase
      .from('host_earnings')
      .select('net_amount')
      .eq('host_id', hostId)
      .eq('status', 'pending');

    if (error || !data) return 0;

    return data.reduce((sum, e) => sum + Number(e.net_amount), 0);
  }

  async getHostEarningsStats(hostId: string): Promise<{totalEarnings: number, pendingEarnings: number}> {
    // Get paid earnings (already paid out)
    const { data: paidData, error: paidError } = await supabase
      .from('host_earnings')
      .select('net_amount')
      .eq('host_id', hostId)
      .eq('status', 'paid');

    const paidEarnings = paidData ? paidData.reduce((sum, e) => sum + Number(e.net_amount), 0) : 0;

    // Get all pending earnings (from completed bookings)
    const { data: pendingData, error: pendingError } = await supabase
      .from('host_earnings')
      .select('net_amount')
      .eq('host_id', hostId)
      .eq('status', 'pending');

    const pendingEarnings = pendingData ? pendingData.reduce((sum, e) => sum + Number(e.net_amount), 0) : 0;

    // Total earnings = paid + all pending earnings
    const totalEarnings = paidEarnings + pendingEarnings;

    return {
      totalEarnings,
      pendingEarnings
    };
  }
}

export const earningsService = new EarningsService();