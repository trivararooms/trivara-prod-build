import { Listing } from '@/types';
import { supabase } from '../lib/supabase';
import { mapListing, ListingRow } from '../lib/mappers';

class SavedListingsService {
  /** All listing ids a user has saved, as a Set for O(1) membership checks. */
  async getSavedListingIds(userId: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('saved_listings')
      .select('listing_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching saved listing ids:', error);
      return new Set();
    }

    return new Set((data || []).map(row => row.listing_id as string));
  }

  /** Full listing objects for everything a user has saved (for the /saved page). */
  async getSavedListings(userId: string): Promise<Listing[]> {
    const { data, error } = await supabase
      .from('saved_listings')
      .select('created_at, listings (*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved listings:', error);
      return [];
    }

    return (data || [])
      .map(row => row.listings as unknown as ListingRow)
      .filter(Boolean)
      .map(mapListing);
  }

  async save(userId: string, listingId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_listings')
      .insert({ user_id: userId, listing_id: listingId });

    // A duplicate save (already-saved listing, e.g. a second tab) is a no-op,
    // not an error - the (user_id, listing_id) unique constraint is what
    // raises this, so swallow only that specific case.
    if (error && error.code !== '23505') {
      throw error;
    }
  }

  async unsave(userId: string, listingId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_listings')
      .delete()
      .eq('user_id', userId)
      .eq('listing_id', listingId);

    if (error) throw error;
  }
}

export const savedListingsService = new SavedListingsService();
