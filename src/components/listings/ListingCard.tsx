import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Listing } from '@/types';
import { formatINR } from '@/lib/utils';
import { SaveButton } from '@/components/listings/SaveButton';

interface ListingCardProps {
  listing: Listing;
  showSaveButton?: boolean;
}

export function ListingCard({ listing, showSaveButton = true }: ListingCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % listing.photos.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + listing.photos.length) % listing.photos.length);
  };

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="nu group block overflow-hidden rounded-[26px] p-2 transition-transform duration-300 ease-out hover:-translate-y-1.5"
    >
      {/* Image Container */}
      <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-[20px] bg-surface-2">
        <img
          src={listing.photos[currentImageIndex]}
          alt={listing.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {showSaveButton && <SaveButton listingId={listing.id} className="absolute right-3 top-3" />}

        {listing.instantBook && (
          <span className="absolute bottom-3 left-3 rounded-full bg-background/80 px-3 py-1 font-ui text-[11px] font-bold backdrop-blur-md">
            ⚡ Instant
          </span>
        )}

        {/* Image Navigation */}
        {listing.photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={prevImage}
              className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 opacity-0 trivara-transition hover:bg-background group-hover:opacity-100"
            >
              <span className="text-sm">‹</span>
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={nextImage}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 opacity-0 trivara-transition hover:bg-background group-hover:opacity-100"
            >
              <span className="text-sm">›</span>
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 right-3 flex gap-1">
              {listing.photos.slice(0, 5).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 w-1.5 rounded-full trivara-transition ${
                    idx === currentImageIndex ? 'bg-foreground' : 'bg-foreground/40'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="space-y-1 px-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-display text-2xl leading-none">{listing.title}</h3>
          <div className="flex flex-shrink-0 items-center gap-1 text-sm">
            <Star className="h-3.5 w-3.5 fill-accent text-accent" />
            <span>{listing.rating.toFixed(2)}</span>
          </div>
        </div>
        <p className="line-clamp-1 text-sm text-text-secondary">{listing.location.city}, {listing.location.state}</p>
        <p className="text-sm text-text-meta">
          {listing.bedrooms} {listing.bedrooms === 1 ? 'bedroom' : 'bedrooms'} · {listing.beds} {listing.beds === 1 ? 'bed' : 'beds'}
        </p>
        <p className="pt-1">
          <span className="font-ui font-extrabold">{formatINR(listing.pricePerNight)}</span>
          <span className="text-sm text-text-secondary"> night</span>
        </p>
      </div>
    </Link>
  );
}
