import { supabase } from '@/lib/supabase';

export type DiscountRuleType = 'first_time_user' | 'area' | 'combo';
export type DiscountValueType = 'percentage' | 'flat_amount';

export interface DiscountRule {
  id: string;
  name: string;
  rule_type: DiscountRuleType;
  conditions: Record<string, unknown>;
  discount_type: DiscountValueType;
  discount_value: number;
  active_from: string | null;
  active_until: string | null;
  is_active: boolean;
}

export interface AppliedDiscount {
  rule_id: string;
  name: string;
  amount: number;
}

export class DiscountService {
  async list(): Promise<DiscountRule[]> {
    const { data, error } = await supabase
      .from('discount_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async create(rule: Omit<DiscountRule, 'id'>): Promise<void> {
    const { error } = await supabase.from('discount_rules').insert(rule);
    if (error) throw error;
  }

  async update(id: string, rule: Partial<Omit<DiscountRule, 'id'>>): Promise<void> {
    const { error } = await supabase.from('discount_rules').update(rule).eq('id', id);
    if (error) throw error;
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase.from('discount_rules').update({ is_active: isActive }).eq('id', id);
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('discount_rules').delete().eq('id', id);
    if (error) throw error;
  }

  async findBest(userId: string, listingId: string, subtotal: number, nights: number): Promise<AppliedDiscount | null> {
    const { data, error } = await supabase.rpc('find_best_discount', {
      p_user_id: userId,
      p_listing_id: listingId,
      p_subtotal: subtotal,
      p_nights: nights,
    });

    if (error) throw error;
    return data?.[0] ?? null;
  }
}

export const discountService = new DiscountService();
