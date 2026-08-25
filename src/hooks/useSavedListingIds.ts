import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { savedListingsService } from '@/services/savedListingsService';

// Shared across every ListingCard on a page: react-query dedupes identical
// query keys, so N cards on a Search results page cause exactly one fetch of
// "all of this user's saved listing ids", not N.
export function useSavedListingIds(userId?: string) {
  return useQuery({
    queryKey: ['saved-listing-ids', userId],
    queryFn: () => savedListingsService.getSavedListingIds(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useToggleSavedListing(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listingId, isSaved }: { listingId: string; isSaved: boolean }) => {
      if (!userId) throw new Error('Must be signed in to save a listing');
      if (isSaved) {
        await savedListingsService.unsave(userId, listingId);
      } else {
        await savedListingsService.save(userId, listingId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-listing-ids', userId] });
      queryClient.invalidateQueries({ queryKey: ['saved-listings', userId] });
    },
  });
}
