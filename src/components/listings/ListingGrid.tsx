import { Listing } from '@/types';
import { ListingCard } from './ListingCard';

interface ListingGridProps {
  listings: Listing[];
  emptyMessage?: string;
  isLoading?: boolean;
}

export function ListingGrid({ listings, emptyMessage = 'No listings available.', isLoading = false }: ListingGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-3">
            <div className="aspect-[4/3] bg-surface-2 rounded-xl"></div>
            <div className="h-4 bg-surface-2 rounded w-3/4"></div>
            <div className="h-4 bg-surface-2 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-secondary">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
