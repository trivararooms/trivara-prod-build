// Shared snake_case (DB) <-> camelCase (frontend) mappers.
//
// Every service used to re-implement these field-by-field conversions inline,
// which meant a schema/column rename had to be hunted down and fixed in five
// or six places at once (this is exactly how the `details` vs `location`,
// `guest_id` vs `reviewer_id`, and `users` vs `profiles` bugs happened).
// Centralizing them here means there is exactly one place to update when a
// column changes, and the shape is enforced by the return type instead of by
// convention.

import { Listing, Booking, Review } from '@/types';

/** Raw shape of a `listings` row as returned by Supabase (snake_case). */
export interface ListingRow {
  id: string;
  host_id: string;
  title: string;
  description: string;
  details: Listing['location'] | null;
  price_per_night: number;
  amenities: string[] | null;
  max_guests: number;
  property_type: Listing['propertyType'];
  status: Listing['status'];
  rating: number | null;
  review_count: number | null;
  photos: string[] | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds: number | null;
  cancellation_policy: Listing['cancellationPolicy'] | null;
  cleaning_fee: number | null;
  service_fee: number | null;
  house_rules: string[] | null;
  instant_book: boolean | null;
  is_featured: boolean | null;
  created_at: string;
  updated_at: string | null;
}

export function mapListing(row: ListingRow): Listing {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    description: row.description,
    location: row.details as Listing['location'],
    propertyType: row.property_type,
    photos: row.photos || [],
    amenities: row.amenities || [],
    pricePerNight: row.price_per_night,
    cleaningFee: row.cleaning_fee || 0,
    serviceFee: row.service_fee || 0,
    maxGuests: row.max_guests,
    bedrooms: row.bedrooms || 1,
    beds: row.beds || 1,
    bathrooms: row.bathrooms || 1,
    houseRules: row.house_rules || [],
    cancellationPolicy: row.cancellation_policy || 'flexible',
    instantBook: row.instant_book ?? true,
    isFeatured: row.is_featured ?? false,
    status: row.status,
    rating: row.rating || 0,
    reviewCount: row.review_count || 0,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(row.created_at),
  };
}

/** Raw shape of a `bookings` row as returned by Supabase (snake_case). */
export interface BookingRow {
  id: string;
  listing_id: string;
  guest_id: string;
  host_id: string;
  start_date: string;
  end_date: string;
  guests: number;
  total_price: number;
  status: Booking['status'];
  payment_status: Booking['paymentStatus'];
  razorpay_payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    listingId: row.listing_id,
    guestId: row.guest_id,
    hostId: row.host_id,
    // Dates are stored as DATE-only strings; append a local midnight time so
    // `new Date(...)` doesn't get reinterpreted as UTC and shift a day.
    checkIn: new Date(row.start_date + 'T00:00:00'),
    checkOut: new Date(row.end_date + 'T00:00:00'),
    guests: row.guests,
    totalPrice: row.total_price,
    status: row.status,
    paymentStatus: row.payment_status || 'pending',
    razorpayPaymentId: row.razorpay_payment_id ?? null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Raw shape of a `reviews` row. `reviewer_id` is the guest who wrote it,
 * `reviewee_id` is the host it's about. `rating` is the single overall score
 * (the source of truth for refresh_listing_rating() / listings.rating);
 * the `*_rating` columns are optional 1-5 per-category breakdowns added in
 * 00000000000004_messaging_and_review_categories.sql - display-only, never
 * averaged back into `rating`.
 */
export interface ReviewRow {
  id: string;
  booking_id: string;
  listing_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  cleanliness_rating: number | null;
  accuracy_rating: number | null;
  communication_rating: number | null;
  value_rating: number | null;
  location_rating: number | null;
  created_at: string;
}

export function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    bookingId: row.booking_id,
    listingId: row.listing_id,
    reviewerId: row.reviewer_id,
    revieweeId: row.reviewee_id,
    rating: row.rating,
    comment: row.comment || '',
    categories: {
      cleanliness: row.cleanliness_rating ?? undefined,
      accuracy: row.accuracy_rating ?? undefined,
      communication: row.communication_rating ?? undefined,
      value: row.value_rating ?? undefined,
      location: row.location_rating ?? undefined,
    },
    createdAt: new Date(row.created_at),
  };
}
