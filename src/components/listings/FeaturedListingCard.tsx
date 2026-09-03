import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import { Listing } from '@/types';
import { formatINR } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSavedListingIds, useToggleSavedListing } from '@/hooks/useSavedListingIds';

interface FeaturedListingCardProps {
  listing: Listing;
}

export function FeaturedListingCard({ listing }: FeaturedListingCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const mediaRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  const savedIdsQuery = useSavedListingIds(user?.id);
  const toggleSaved = useToggleSavedListing(user?.id);
  const isSaved = savedIdsQuery.data?.has(listing.id) ?? false;

  // Subtle scroll-driven parallax on the image layer, matching the mock.
  useEffect(() => {
    const media = mediaRef.current;
    const layer = layerRef.current;
    if (!media || !layer) return;

    let raf = 0;
    const update = () => {
      const vh = window.innerHeight;
      const rect = media.getBoundingClientRect();
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
      const offset = Math.max(-1, Math.min(1, progress)) * 26;
      layer.style.transform = `translateY(${offset}px)`;
    };
    const onScroll = () => { raf = requestAnimationFrame(update); };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
    };
  }, []);

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

  return (
    <Link to={`/listing/${listing.id}`} className="group block">
      {/* "feat-media" is a plain measurement hook - Index.tsx reads its
          rendered width to size the destination marquee cards at exactly
          half, the same way the mock's own vanilla-JS syncDestCardSize()
          did. No rounded corners, per the redesign. */}
      <div ref={mediaRef} className="feat-media relative aspect-[4/5] overflow-hidden bg-surface-0 border border-border mb-4">
        <div ref={layerRef} className="absolute left-0 right-0 -top-[15%] h-[130%] will-change-transform">
          <img
            src={listing.photos[0]}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={toggleSaved.isPending}
          aria-label={isSaved ? 'Remove from saved' : 'Save listing'}
          className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/45 flex items-center justify-center trivara-transition"
        >
          <Heart className={`h-4 w-4 ${isSaved ? 'fill-foreground' : ''}`} />
        </button>
      </div>

      <div className="flex items-center justify-between text-base font-semibold">
        <span className="truncate">{listing.location.city}, {listing.location.state}</span>
        <span className="flex items-center gap-1 flex-shrink-0">
          <Star className="h-3.5 w-3.5 fill-foreground" /> {listing.rating.toFixed(2)}
        </span>
      </div>
      <p className="text-text-meta text-sm mt-1 mb-1 line-clamp-1">{listing.title}</p>
      <p className="text-text-meta text-sm mb-1.5">
        {listing.bedrooms} {listing.bedrooms === 1 ? 'bedroom' : 'bedrooms'} · {listing.beds} {listing.beds === 1 ? 'bed' : 'beds'}
      </p>
      <p className="text-base font-semibold">
        {formatINR(listing.pricePerNight)} <span className="text-text-secondary font-normal">night</span>
      </p>
    </Link>
  );
}
