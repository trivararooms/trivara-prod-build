import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import { Listing } from '@/types';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSavedListingIds, useToggleSavedListing } from '@/hooks/useSavedListingIds';

interface ListingCardProps {
  listing: Listing;
  showSaveButton?: boolean;
}

export function ListingCard({ listing, showSaveButton = true }: ListingCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const savedIdsQuery = useSavedListingIds(user?.id);
  const toggleSaved = useToggleSavedListing(user?.id);
  const isSaved = savedIdsQuery.data?.has(listing.id) ?? false;

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast({
        title: 'Sign in to save listings',
        description: 'Create an account or log in to save your favorite stays.',
      });
      navigate('/login');
      return;
    }

    toggleSaved.mutate({ listingId: listing.id, isSaved });
  };

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
    <Link to={`/listing/${listing.id}`} className="group block">
      {/* Image Container */}
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-0 mb-3">
        <img
          src={listing.photos[currentImageIndex]}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 trivara-transition duration-500"
        />
        
        {/* Save Button */}
        {showSaveButton && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-surface-0/50 hover:bg-surface-0/80 backdrop-blur-sm"
            onClick={handleSave}
            disabled={toggleSaved.isPending}
          >
            <Heart
              className={`h-4 w-4 ${isSaved ? 'fill-foreground' : ''}`}
            />
          </Button>
        )}

        {/* Image Navigation */}
        {listing.photos.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-surface-0/80 hover:bg-surface-0 flex items-center justify-center opacity-0 group-hover:opacity-100 trivara-transition"
            >
              <span className="text-sm">‹</span>
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-surface-0/80 hover:bg-surface-0 flex items-center justify-center opacity-0 group-hover:opacity-100 trivara-transition"
            >
              <span className="text-sm">›</span>
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
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
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm line-clamp-1">{listing.location.city}, {listing.location.state}</h3>
          <div className="flex items-center gap-1 text-sm flex-shrink-0">
            <Star className="h-3.5 w-3.5 fill-accent text-accent" />
            <span>{listing.rating.toFixed(2)}</span>
          </div>
        </div>
        <p className="text-text-secondary text-sm line-clamp-1">{listing.title}</p>
        <p className="text-text-meta text-sm">
          {listing.bedrooms} {listing.bedrooms === 1 ? 'bedroom' : 'bedrooms'} · {listing.beds} {listing.beds === 1 ? 'bed' : 'beds'}
        </p>
        <p className="pt-1">
          <span className="font-semibold">{formatINR(listing.pricePerNight)}</span>
          <span className="text-text-secondary text-sm"> night</span>
        </p>
      </div>
    </Link>
  );
}
