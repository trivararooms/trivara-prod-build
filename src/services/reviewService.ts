import { Review, ReviewCategoryRatings } from '@/types';
import { supabase } from '../lib/supabase';
import { mapReview, ReviewRow } from '../lib/mappers';
import { bookingService } from './bookingService';

class ReviewService {

  async getAll(): Promise<Review[]> {
    const { data, error } = await supabase.from('reviews').select('*');

    if (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }

    return (data as ReviewRow[]).map(mapReview);
  }

  async getById(id: string): Promise<Review | undefined> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching review:', error);
      return undefined;
    }

    return mapReview(data as ReviewRow);
  }

  async getByListingId(listingId: string): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }

    return (data as ReviewRow[]).map(mapReview);
  }

  // Kept for backwards compatibility with any callers still using the old name.
  async getReviewsByListing(listingId: string): Promise<Review[]> {
    return this.getByListingId(listingId);
  }

  async getByReviewerId(reviewerId: string): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('reviewer_id', reviewerId);

    if (error) {
      console.error('Error fetching reviews by reviewer:', error);
      return [];
    }

    return (data as ReviewRow[]).map(mapReview);
  }

  async getByBookingId(bookingId: string): Promise<Review | undefined> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching review by booking:', error);
      return undefined;
    }

    return data ? mapReview(data as ReviewRow) : undefined;
  }

  async hasReviewedBooking(bookingId: string): Promise<boolean> {
    const review = await this.getByBookingId(bookingId);
    return !!review;
  }

  async getAverageRatings(listingId: string): Promise<{ overall: number; count: number } | null> {
    const listingReviews = await this.getByListingId(listingId);
    if (listingReviews.length === 0) return null;

    const overall = listingReviews.reduce((sum, r) => sum + r.rating, 0) / listingReviews.length;
    return { overall, count: listingReviews.length };
  }

  /**
   * Creates a review for a completed booking. `reviewer_id` is always the
   * guest, `reviewee_id` the host. `categories` are optional per-category
   * 1-5 scores (cleanliness/accuracy/communication/value/location) - purely
   * a display breakdown alongside `rating`, which stays the single overall
   * score everything else (refresh_listing_rating(), ListingCard) reads.
   */
  async createReview(
    bookingId: string,
    rating: number,
    comment?: string,
    categories?: ReviewCategoryRatings
  ): Promise<Review> {
    const booking = await bookingService.getById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }
    if (booking.status !== 'completed') {
      throw new Error('Can only review completed bookings');
    }

    const existingReview = await this.getByBookingId(bookingId);
    if (existingReview) {
      throw new Error('Booking has already been reviewed');
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert([{
        booking_id: bookingId,
        listing_id: booking.listingId,
        reviewer_id: booking.guestId,
        reviewee_id: booking.hostId,
        rating,
        comment: comment || null,
        cleanliness_rating: categories?.cleanliness ?? null,
        accuracy_rating: categories?.accuracy ?? null,
        communication_rating: categories?.communication ?? null,
        value_rating: categories?.value ?? null,
        location_rating: categories?.location ?? null,
      }])
      .select('*')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to create review');
    }

    return mapReview(data as ReviewRow);
  }

  async update(id: string, updates: { rating?: number; comment?: string }): Promise<Review | undefined> {
    const { data, error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to update review');
    }

    return mapReview(data as ReviewRow);
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}

export const reviewService = new ReviewService();
