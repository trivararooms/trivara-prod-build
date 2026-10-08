import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSavedListingIds, useToggleSavedListing } from '@/hooks/useSavedListingIds';

interface SaveButtonProps {
  listingId: string;
  className?: string;
}

/**
 * The round heart used on every listing card. Signed-out visitors are sent
 * to /login with a toast (same behaviour the cards had before); signed-in
 * visitors toggle the real saved_listings row via the shared react-query
 * hooks, so every heart on the page stays in sync.
 */
export function SaveButton({ listingId, className = '' }: SaveButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const savedIdsQuery = useSavedListingIds(user?.id);
  const toggleSaved = useToggleSavedListing(user?.id);
  const isSaved = savedIdsQuery.data?.has(listingId) ?? false;

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

    toggleSaved.mutate({ listingId, isSaved });
  };

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={toggleSaved.isPending}
      aria-label={isSaved ? 'Remove from saved' : 'Save listing'}
      aria-pressed={isSaved}
      className={`grid h-9 w-9 place-items-center rounded-full bg-background/75 backdrop-blur-md transition-transform duration-200 hover:scale-110 ${className}`}
    >
      <Heart className={`h-4 w-4 ${isSaved ? 'fill-accent stroke-accent' : 'stroke-foreground'}`} />
    </button>
  );
}
