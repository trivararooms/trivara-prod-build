import { Listing, SearchFilters, SearchResult, ListingStatus } from '@/types';
import { supabase } from '../lib/supabase';
import { mapListing, ListingRow } from '../lib/mappers';
import { toDateOnly } from '../lib/utils';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

class ListingService {

  async getAll(): Promise<Listing[]> {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('published', true);

    if (error) {
      console.error('Error fetching listings:', error);
      return [];
    }

    return (data as ListingRow[]).map(mapListing);
  }

  async getById(id: string): Promise<Listing | undefined> {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching listing:', error);
        return undefined;
      }
      if (!data) return undefined;

      return mapListing(data as ListingRow);
    } catch (error) {
      console.error('Unexpected error in getById:', error);
      return undefined;
    }
  }

  async getByHostId(hostId: string): Promise<Listing[]> {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('host_id', hostId);

      if (error) {
        console.error('Error fetching host listings:', error);
        return [];
      }
      if (!data) return [];

      return (data as ListingRow[]).map(mapListing);
    } catch (error) {
      console.error('Unexpected error in getByHostId:', error);
      return [];
    }
  }

  /** Host's public profile info (name/avatar), for display on a listing page. */
  async getHost(hostId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, is_host, bio, created_at')
      .eq('id', hostId)
      .single();

    if (error) {
      console.error('Error fetching host:', error);
      return null;
    }

    return data;
  }

  async searchListings(filters: SearchFilters, page = 1, pageSize = 20): Promise<SearchResult> {
    try {
      let query = supabase
        .from('listings')
        .select('*', { count: 'exact' })
        .eq('published', true)
        .eq('status', 'published');

      // Database-level filtering for basic fields
      if (filters.guests) {
        query = query.gte('max_guests', filters.guests);
      }
      if (filters.minPrice !== undefined) {
        query = query.gte('price_per_night', filters.minPrice);
      }
      if (filters.maxPrice !== undefined) {
        query = query.lte('price_per_night', filters.maxPrice);
      }
      if (filters.minRating !== undefined && filters.minRating > 0) {
        query = query.gte('rating', filters.minRating);
      }

      switch (filters.sort) {
        case 'price_asc':
          query = query.order('price_per_night', { ascending: true });
          break;
        case 'price_desc':
          query = query.order('price_per_night', { ascending: false });
          break;
        case 'rating':
          query = query.order('rating', { ascending: false, nullsFirst: false });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        default:
          break;
      }

      // Text search on location/title and JSON-array filters (amenities,
      // property types, cancellation policy) can't be expressed as simple
      // PostgREST filters against JSONB/array columns, so they're applied in
      // JS below. Date-availability (checking each candidate listing against
      // its bookings) is the same story. To avoid pulling the whole table
      // when that's needed, the DB query is capped at 200 rows instead of
      // paginated in that case.
      const hasDateFilter = !!filters.checkIn && !!filters.checkOut;
      const hasComplexFilters = !!filters.location
        || (filters.amenities && filters.amenities.length > 0)
        || (filters.propertyTypes && filters.propertyTypes.length > 0)
        || (filters.cancellationPolicy && filters.cancellationPolicy.length > 0)
        || hasDateFilter;

      if (!hasComplexFilters) {
        const startIndex = (page - 1) * pageSize;
        query = query.range(startIndex, startIndex + pageSize - 1);
      } else {
        query = query.limit(200);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      if (!data) return { listings: [], total: 0, page, pageSize };

      let results = data as ListingRow[];

      if (filters.location) {
        const locationLower = filters.location.toLowerCase();
        results = results.filter((l) =>
          l.title?.toLowerCase().includes(locationLower) ||
          l.details?.city?.toLowerCase().includes(locationLower) ||
          l.details?.state?.toLowerCase().includes(locationLower) ||
          l.details?.country?.toLowerCase().includes(locationLower)
        );
      }

      if (filters.propertyTypes && filters.propertyTypes.length > 0) {
        results = results.filter((l) => filters.propertyTypes!.includes(l.property_type));
      }

      if (filters.amenities && filters.amenities.length > 0) {
        results = results.filter((l) =>
          filters.amenities!.every(a => l.amenities?.includes(a))
        );
      }

      if (filters.cancellationPolicy && filters.cancellationPolicy.length > 0) {
        results = results.filter((l) =>
          filters.cancellationPolicy!.includes(l.cancellation_policy as Listing['cancellationPolicy'])
        );
      }

      if (hasDateFilter) {
        results = await this.filterByAvailability(
          results,
          filters.checkIn!,
          filters.checkOut!,
          filters.flexibleDays || 0
        );
      }

      let total = count || results.length;
      let finalResults = results;

      if (hasComplexFilters) {
        total = finalResults.length;
        const startIndex = (page - 1) * pageSize;
        finalResults = finalResults.slice(startIndex, startIndex + pageSize);
      }

      return {
        listings: finalResults.map(mapListing),
        total,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('Supabase search failed:', error);
      // Return empty instead of throwing to prevent page crashes
      return { listings: [], total: 0, page, pageSize };
    }
  }

  // Kept for backwards compatibility with any callers still using the old name.
  async search(filters: SearchFilters, page = 1, pageSize = 20): Promise<SearchResult> {
    return this.searchListings(filters, page, pageSize);
  }

  /**
   * Excludes listings with no free stretch of `nights` (checkOut - checkIn)
   * somewhere in [checkIn - flexibleDays, checkOut + flexibleDays]. With
   * flexibleDays=0 this is exact-date filtering: a listing is excluded only
   * if it has a confirmed/completed booking overlapping the exact requested
   * range. Search previously ignored checkIn/checkOut entirely - a "search"
   * that can return a listing which is actually booked solid for the dates
   * you asked for isn't real date search, so this closes that gap rather
   * than just adding a flexible-dates toggle on top of nothing.
   */
  private async filterByAvailability(
    rows: ListingRow[],
    checkIn: Date,
    checkOut: Date,
    flexibleDays: number
  ): Promise<ListingRow[]> {
    if (rows.length === 0) return rows;

    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
    if (nights <= 0) return rows;

    const windowStart = new Date(checkIn.getTime() - flexibleDays * MS_PER_DAY);
    const windowEnd = new Date(checkOut.getTime() + flexibleDays * MS_PER_DAY);

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('listing_id, start_date, end_date')
      .in('listing_id', rows.map(r => r.id))
      .in('status', ['confirmed', 'completed'])
      .lt('start_date', toDateOnly(windowEnd))
      .gt('end_date', toDateOnly(windowStart));

    if (error) {
      console.error('Error checking availability during search:', error);
      return rows; // Fail open rather than hiding every result
    }

    const bookedRangesByListing = new Map<string, { start: number; end: number }[]>();
    for (const b of bookings || []) {
      const list = bookedRangesByListing.get(b.listing_id) || [];
      list.push({
        start: new Date(b.start_date + 'T00:00:00').getTime(),
        end: new Date(b.end_date + 'T00:00:00').getTime(),
      });
      bookedRangesByListing.set(b.listing_id, list);
    }

    const hasFreeSlot = (listingId: string): boolean => {
      const booked = bookedRangesByListing.get(listingId);
      if (!booked || booked.length === 0) return true;

      // Try every candidate start date within the flexible window and see if
      // any of them gives `nights` consecutive free nights.
      for (let offset = -flexibleDays; offset <= flexibleDays; offset++) {
        const candidateStart = checkIn.getTime() + offset * MS_PER_DAY;
        const candidateEnd = candidateStart + nights * MS_PER_DAY;
        const conflicts = booked.some(r => r.start < candidateEnd && r.end > candidateStart);
        if (!conflicts) return true;
      }
      return false;
    };

    return rows.filter(r => hasFreeSlot(r.id));
  }

  async getPopularListings(limit = 8): Promise<Listing[]> {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('published', true)
        .eq('status', 'published')
        .order('review_count', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching popular listings:', error);
        return [];
      }
      if (!data) return [];

      return (data as ListingRow[]).map(mapListing);
    } catch (error) {
      console.error('Unexpected error in getPopularListings:', error);
      return [];
    }
  }

  async getFeatured(limit = 6): Promise<Listing[]> {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('published', true)
        .order('rating', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching featured listings:', error);
        return [];
      }

      return (data as ListingRow[] | null)?.map(mapListing) || [];
    } catch (err) {
      console.error('Unexpected error in getFeatured:', err);
      return [];
    }
  }

  /** Other published listings in the same city, for a listing page's "Similar stays" section. */
  async getSimilar(listing: Listing, limit = 4): Promise<Listing[]> {
    try {
      let query = supabase
        .from('listings')
        .select('*')
        .eq('published', true)
        .eq('status', 'published')
        .neq('id', listing.id)
        .limit(limit);

      // details->>city is stored inside the `details` JSONB column (see
      // ListingRow) - filtering on a JSON field needs the ->> text operator
      // rather than a plain column filter.
      if (listing.location?.city) {
        query = query.eq('details->>city', listing.location.city);
      } else {
        query = query.eq('property_type', listing.propertyType);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching similar listings:', error);
        return [];
      }

      let results = (data as ListingRow[] | null) || [];

      // Same-city search can come back empty for a city with only one
      // listing - fall back to same property type so the section isn't just
      // silently missing.
      if (results.length === 0 && listing.location?.city) {
        const fallback = await supabase
          .from('listings')
          .select('*')
          .eq('published', true)
          .eq('status', 'published')
          .neq('id', listing.id)
          .eq('property_type', listing.propertyType)
          .limit(limit);
        results = (fallback.data as ListingRow[] | null) || [];
      }

      return results.map(mapListing);
    } catch (error) {
      console.error('Unexpected error in getSimilar:', error);
      return [];
    }
  }

  async getPopularDestinations() {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('details, photos, location')
        .eq('published', true);

      if (error) {
        console.error('Error fetching popular destinations:', error);
        return [];
      }

      const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80';
      const destinationMap = new Map<string, { city: string; state: string; listings: number; image: string }>();

      type DestinationRow = { details: Listing['location'] | null; photos: string[] | null; location: string | null };
      (data as DestinationRow[] | null)?.forEach((listing) => {
        let city = '';
        let state = '';
        const photo = listing.photos?.[0] || null;

        if (listing.details && typeof listing.details === 'object') {
          city = listing.details.city || '';
          state = listing.details.state || '';
        } else if (listing.location && typeof listing.location === 'string') {
          const parts = listing.location.split(',');
          city = parts[0]?.trim() || '';
          state = parts[1]?.trim() || '';
        }

        if (city || state) {
          const key = `${city},${state}`;
          const current = destinationMap.get(key) || { city, state, listings: 0, image: photo || FALLBACK_IMAGE };
          current.listings++;
          if (photo && current.image === FALLBACK_IMAGE) {
            current.image = photo;
          }
          destinationMap.set(key, current);
        }
      });

      return Array.from(destinationMap.values())
        .sort((a, b) => b.listings - a.listings)
        .slice(0, 6);
    } catch (err) {
      console.error('Unexpected error in getPopularDestinations:', err);
      return [];
    }
  }

  async create(listing: Omit<Listing, 'id' | 'createdAt' | 'updatedAt' | 'rating' | 'reviewCount' | 'status'>): Promise<Listing | undefined> {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const currentUser = userData.user;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const locationString = listing.location
      ? `${listing.location.city}, ${listing.location.state}, ${listing.location.country}`
      : '';

    const payload = {
      host_id: currentUser.id,
      title: listing.title,
      description: listing.description,
      location: locationString,
      details: listing.location,
      price_per_night: listing.pricePerNight,
      amenities: listing.amenities || [],
      max_guests: listing.maxGuests,
      property_type: listing.propertyType,
      status: 'draft',
      rating: 0,
      review_count: 0,
      published: false,
      photos: listing.photos || [],
      bedrooms: listing.bedrooms || 1,
      bathrooms: listing.bathrooms || 1,
      beds: listing.beds || 1,
      house_rules: listing.houseRules || [],
      cancellation_policy: listing.cancellationPolicy || 'flexible',
      cleaning_fee: listing.cleaningFee || 0,
      service_fee: listing.serviceFee || 0,
      instant_book: listing.instantBook ?? true,
    };

    const { data, error } = await supabase
      .from('listings')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
    if (!data) {
      throw new Error('Failed to create listing: No data returned');
    }

    return mapListing(data as ListingRow);
  }

  async update(id: string, updates: Partial<Listing>): Promise<Listing | undefined> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const payload: Record<string, unknown> = {};

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.propertyType !== undefined) payload.property_type = updates.propertyType;
    if (updates.pricePerNight !== undefined) payload.price_per_night = updates.pricePerNight;
    if (updates.amenities !== undefined) payload.amenities = updates.amenities;
    if (updates.maxGuests !== undefined) payload.max_guests = updates.maxGuests;
    if (updates.bedrooms !== undefined) payload.bedrooms = updates.bedrooms;
    if (updates.beds !== undefined) payload.beds = updates.beds;
    if (updates.bathrooms !== undefined) payload.bathrooms = updates.bathrooms;
    if (updates.photos !== undefined) payload.photos = updates.photos;
    if (updates.cancellationPolicy !== undefined) payload.cancellation_policy = updates.cancellationPolicy;
    if (updates.cleaningFee !== undefined) payload.cleaning_fee = updates.cleaningFee;
    if (updates.serviceFee !== undefined) payload.service_fee = updates.serviceFee;
    if (updates.houseRules !== undefined) payload.house_rules = updates.houseRules;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.instantBook !== undefined) payload.instant_book = updates.instantBook;

    if (updates.location) {
      payload.details = updates.location;
      payload.location = `${updates.location.city}, ${updates.location.state}, ${updates.location.country}`;
    }

    const { data, error } = await supabase
      .from('listings')
      .update(payload)
      .eq('id', id)
      .eq('host_id', user.id) // Enforce ownership - only the listing owner can edit
      .select('*')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to update listing');
    }

    return mapListing(data as ListingRow);
  }

  async updateStatus(id: string, status: ListingStatus): Promise<Listing | undefined> {
    return this.update(id, { status });
  }

  async publishListing(id: string): Promise<Listing | undefined> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .eq('host_id', user.id)
      .single();

    if (fetchError) throw fetchError;
    if (!listing) throw new Error('Listing not found');

    if (!listing.title || listing.title.trim() === '') {
      throw new Error('Title is required to publish listing');
    }
    if (listing.price_per_night === null || listing.price_per_night <= 0) {
      throw new Error('Valid price per night is required to publish listing');
    }

    // Publishing no longer grants host status as a side effect - the
    // `trigger_require_approved_host` trigger (see supabase/migrations)
    // blocks this update unless profiles.is_host is already true, which only
    // happens once an admin approves a host_applications row.
    const { data, error } = await supabase
      .from('listings')
      .update({ status: 'published', published: true })
      .eq('id', id)
      .eq('host_id', user.id)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Publish error details:', error);
      if (error?.message?.includes('approved host')) {
        throw new Error('You must be an approved host to publish a listing. Apply to become a host first.');
      }
      throw error || new Error('Failed to publish listing');
    }

    return mapListing(data as ListingRow);
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase.from('listings').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}

export const listingService = new ListingService();
