import { supabase } from '@/lib/supabase';

export interface OpsAdminProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export class AdminAccessService {
  async listOpsAdmins(): Promise<OpsAdminProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('role', 'ops_admin')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async grant(email: string): Promise<void> {
    const { error } = await supabase.rpc('grant_ops_admin', { p_email: email });
    if (error) throw error;
  }

  async revoke(email: string): Promise<void> {
    const { error } = await supabase.rpc('revoke_ops_admin', { p_email: email });
    if (error) throw error;
  }

  async processRefund(bookingId: string, refundId: string, refundAmount: number): Promise<{ success: boolean; error?: string; message?: string }> {
    const { data, error } = await supabase.rpc('process_booking_refund', {
      p_booking_id: bookingId,
      p_refund_id: refundId,
      p_refund_amount: refundAmount,
    });
    if (error) throw error;
    return data;
  }
}

export const adminAccessService = new AdminAccessService();
