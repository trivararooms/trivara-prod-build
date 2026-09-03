import { supabase } from '@/lib/supabase';

export interface CommissionTier {
  tier_order: number;
  min_monthly_revenue: number;
  commission_rate: number;
}

export type OverrideScope = 'host' | 'property';

export interface CommissionOverride {
  id: string;
  scope_type: OverrideScope;
  scope_id: string;
  commission_rate: number;
}

export class CommissionService {
  async getTiers(): Promise<CommissionTier[]> {
    const { data, error } = await supabase
      .from('commission_tiers')
      .select('tier_order, min_monthly_revenue, commission_rate')
      .order('tier_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async saveTiers(tiers: CommissionTier[]): Promise<void> {
    const { error } = await supabase.from('commission_tiers').upsert(tiers, { onConflict: 'tier_order' });
    if (error) throw error;
  }

  async getOverrides(): Promise<CommissionOverride[]> {
    const { data, error } = await supabase
      .from('commission_overrides')
      .select('id, scope_type, scope_id, commission_rate')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async setOverride(scopeType: OverrideScope, scopeId: string, rate: number): Promise<void> {
    const { error } = await supabase
      .from('commission_overrides')
      .upsert({ scope_type: scopeType, scope_id: scopeId, commission_rate: rate }, { onConflict: 'scope_type,scope_id' });
    if (error) throw error;
  }

  async removeOverride(id: string): Promise<void> {
    const { error } = await supabase.from('commission_overrides').delete().eq('id', id);
    if (error) throw error;
  }

  /** Resolves a host's email to their user id, for the "by host email" override form. */
  async findHostIdByEmail(email: string): Promise<string | null> {
    const { data, error } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }

  /** Resolves a listing title to its id, for the "by property" override form. */
  async findListingIdByTitle(title: string): Promise<string | null> {
    const { data, error } = await supabase.from('listings').select('id').ilike('title', title).maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }
}

export const commissionService = new CommissionService();
