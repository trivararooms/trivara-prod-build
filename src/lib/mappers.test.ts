import { describe, it, expect } from 'vitest';
import { mapListing, mapBooking, mapReview, ListingRow, BookingRow, ReviewRow } from './mappers';

describe('mapListing', () => {
  it('maps every snake_case DB column to its camelCase field', () => {
    const row: ListingRow = {
      id: 'l1',
      host_id: 'h1',
      title: 'Cozy cabin',
      description: 'A nice place',
      details: { address: '1 Main St', city: 'Goa', state: 'GA', country: 'India', postalCode: '403001', lat: 1, lng: 2 },
      price_per_night: 2000,
      amenities: ['wifi'],
      max_guests: 4,
      property_type: 'entire_place',
      status: 'published',
      rating: 4.5,
      review_count: 10,
      photos: ['a.jpg'],
      bedrooms: 2,
      bathrooms: 1,
      beds: 2,
      cancellation_policy: 'moderate',
      cleaning_fee: 100,
      service_fee: 50,
      house_rules: ['No smoking'],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };

    const listing = mapListing(row);

    expect(listing.hostId).toBe('h1');
    expect(listing.propertyType).toBe('entire_place');
    expect(listing.pricePerNight).toBe(2000);
    expect(listing.maxGuests).toBe(4);
    expect(listing.cancellationPolicy).toBe('moderate');
    expect(listing.reviewCount).toBe(10);
    expect(listing.createdAt).toBeInstanceOf(Date);
  });

  it('falls back sensibly when optional columns are null', () => {
    const row: Partial<ListingRow> = {
      id: 'l2',
      host_id: 'h1',
      title: 'Bare listing',
      description: '',
      details: null,
      price_per_night: 1000,
      amenities: null,
      max_guests: 2,
      property_type: 'private_room',
      status: 'draft',
      rating: null,
      review_count: null,
      photos: null,
      bedrooms: null,
      bathrooms: null,
      beds: null,
      cancellation_policy: null,
      cleaning_fee: null,
      service_fee: null,
      house_rules: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: null,
    };

    const listing = mapListing(row as ListingRow);

    expect(listing.rating).toBe(0);
    expect(listing.reviewCount).toBe(0);
    expect(listing.photos).toEqual([]);
    expect(listing.bedrooms).toBe(1);
    expect(listing.cancellationPolicy).toBe('flexible');
    // No updated_at -> falls back to created_at rather than "now" or null.
    expect(listing.updatedAt).toEqual(listing.createdAt);
  });
});

describe('mapBooking', () => {
  it('parses DATE-only start/end as local midnight, not UTC', () => {
    const row: BookingRow = {
      id: 'b1',
      listing_id: 'l1',
      guest_id: 'g1',
      host_id: 'h1',
      start_date: '2026-01-31',
      end_date: '2026-02-04',
      guests: 2,
      total_price: 5000,
      status: 'confirmed',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const booking = mapBooking(row);

    expect(booking.checkIn.getDate()).toBe(31);
    expect(booking.checkIn.getMonth()).toBe(0); // January
    expect(booking.checkOut.getDate()).toBe(4);
    expect(booking.checkOut.getMonth()).toBe(1); // February
    expect(booking.guestId).toBe('g1');
    expect(booking.hostId).toBe('h1');
  });
});

describe('mapReview', () => {
  it('maps reviewer_id/reviewee_id and defaults a null comment to an empty string', () => {
    const row: ReviewRow = {
      id: 'r1',
      booking_id: 'b1',
      listing_id: 'l1',
      reviewer_id: 'guest1',
      reviewee_id: 'host1',
      rating: 5,
      comment: null,
      created_at: '2026-01-05T00:00:00Z',
    };

    const review = mapReview(row);

    expect(review.reviewerId).toBe('guest1');
    expect(review.revieweeId).toBe('host1');
    expect(review.rating).toBe(5);
    expect(review.comment).toBe('');
  });
});
