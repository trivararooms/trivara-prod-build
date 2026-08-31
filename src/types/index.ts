// Core Domain Types for Trivara Platform

// Matches the `profiles.role` check constraint in
// supabase/migrations/00000000000001_consolidated_baseline.sql. This used to
// say 'traveller' here while every service/RPC actually used 'guest' - kept
// in sync now so the type isn't lying about what the database accepts.
export type UserRole = 'guest' | 'host' | 'admin';

export type BookingStatus = 'pending' | 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';

export type ListingStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: Date;
  isVerified: boolean;
}

export interface Host extends User {
  role: 'host';
  bio?: string;
  responseRate: number;
  responseTime: string;
  isSuperhost: boolean;
  totalListings: number;
  totalReviews: number;
  joinedDate: Date;
}

export interface Listing {
  id: string;
  hostId: string;
  title: string;
  description: string;
  propertyType: PropertyType;
  location: Location;
  photos: string[];
  amenities: string[];
  pricePerNight: number;
  cleaningFee: number;
  serviceFee: number;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  houseRules: string[];
  cancellationPolicy: CancellationPolicy;
  // true (the default, for every pre-existing listing) = pay immediately;
  // false = the host must approve before payment is collected.
  instantBook: boolean;
  status: ListingStatus;
  rating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  lat: number;
  lng: number;
}

export type PropertyType =
  | 'entire_place'
  | 'private_room'
  | 'shared_room'
  | 'hotel_room';

export type CancellationPolicy = 'flexible' | 'moderate' | 'strict';

export interface Availability {
  id: string;
  listingId: string;
  startDate: Date;
  endDate: Date;
  isBlocked: boolean;
  priceOverride?: number;
}

export interface DateLock {
  listingId: string;
  startDate: Date;
  endDate: Date;
  userId: string;
  expiresAt: Date;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Booking {
  id: string;
  listingId: string;
  guestId: string;
  hostId: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  totalPrice: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  razorpayPaymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewCategoryRatings {
  cleanliness?: number;
  accuracy?: number;
  communication?: number;
  value?: number;
  location?: number;
}

// Matches the `reviews` table: an overall 1-5 `rating` + comment (the single
// source of truth for listings.rating via refresh_listing_rating()), plus
// optional per-category 1-5 breakdowns that are display-only.
export interface Review {
  id: string;
  bookingId: string;
  listingId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string;
  categories: ReviewCategoryRatings;
  createdAt: Date;
}

export interface Payout {
  id: string;
  hostId: string;
  bookingId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledDate: Date;
  completedDate?: Date;
}

export type SearchSort = 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'newest';

export interface SearchFilters {
  location?: string;
  checkIn?: Date;
  checkOut?: Date;
  // How many days on either side of checkIn/checkOut to also consider when
  // looking for a free date range - "I'm flexible on dates" in the UI.
  // 0 (the default) means the exact range must be free.
  flexibleDays?: number;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  propertyTypes?: PropertyType[];
  amenities?: string[];
  minRating?: number;
  cancellationPolicy?: CancellationPolicy[];
  instantBook?: boolean;
  sort?: SearchSort;
}

export interface SearchResult {
  listings: Listing[];
  total: number;
  page: number;
  pageSize: number;
}
