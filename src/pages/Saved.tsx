import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { useAuth } from '@/hooks/useAuth';
import { savedListingsService } from '@/services/savedListingsService';
import { Loader2 } from 'lucide-react';

export default function Saved() {
  const { user, loading: authLoading } = useAuth();

  const savedListingsQuery = useQuery({
    queryKey: ['saved-listings', user?.id],
    queryFn: () => savedListingsService.getSavedListings(user!.id),
    enabled: !!user?.id,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="sticky top-20 z-10 bg-background pb-4 mb-4 border-b border-border">
          <div className="mb-2 pt-2">
            <h1 className="text-3xl font-display font-medium text-foreground mb-2">
              Saved
            </h1>
            <p className="text-text-secondary">
              Listings you've saved for later
            </p>
          </div>
        </div>

        <ListingGrid
          listings={savedListingsQuery.data ?? []}
          isLoading={savedListingsQuery.isPending}
          emptyMessage="You haven't saved any listings yet. Tap the heart on a listing to save it here."
        />
      </div>
    </div>
  );
}
