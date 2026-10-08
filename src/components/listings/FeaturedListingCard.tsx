import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Listing } from '@/types';
import { formatINR } from '@/lib/utils';
import { SaveButton } from '@/components/listings/SaveButton';

interface FeaturedListingCardProps {
  listing: Listing;
}

/** Tall raised card with the price stamped on the photo - the Featured stays row. */
export function FeaturedListingCard({ listing }: FeaturedListingCardProps) {
  return (
    <Link
      to={`/listing/${listing.id}`}
      className="nu group block overflow-hidden rounded-[30px] transition-transform duration-300 ease-out hover:-translate-y-2 hover:-rotate-[0.6deg]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
        <img
          src={listing.photos[0]}
          alt={listing.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <SaveButton listingId={listing.id} className="absolute right-3 top-3" />
        <span className="absolute bottom-3 left-3 -rotate-3 rounded-full bg-accent px-3.5 py-1.5 font-ui text-sm font-extrabold text-accent-foreground">
          {formatINR(listing.pricePerNight)}
        </span>
      </div>
      <div className="px-[18px] pb-5 pt-3.5">
        <h4 className="line-clamp-1 font-display text-[26px] leading-none">{listing.title}</h4>
        <p className="mt-1.5 flex items-center justify-between gap-2 text-[13px] text-text-secondary">
          <span className="truncate">{listing.location.city}</span>
          <span className="flex flex-shrink-0 items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-accent text-accent" /> {listing.rating.toFixed(2)}
          </span>
        </p>
      </div>
    </Link>
  );
}
