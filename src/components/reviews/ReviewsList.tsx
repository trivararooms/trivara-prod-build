import { useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { ReviewCard } from './ReviewCard';
import { reviewService } from '@/services/reviewService';
import { Review } from '@/types';

interface ReviewsListProps {
  listingId: string;
}

export function ReviewsList({ listingId }: ReviewsListProps) {
  // `reviewService.getByListingId` / `getAverageRatings` are both async - this
  // component previously called them without `await` and rendered the
  // resulting Promise directly, which crashes as soon as `.map`/`.length` is
  // accessed on it. Every listing detail page with a reviews section was
  // broken by this. Fixed by actually loading the data into state.
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [averages, setAverages] = useState<{ overall: number; count: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      reviewService.getByListingId(listingId),
      reviewService.getAverageRatings(listingId),
    ]).then(([reviewsData, averagesData]) => {
      if (cancelled) return;
      setReviews(reviewsData);
      setAverages(averagesData);
    });

    return () => { cancelled = true; };
  }, [listingId]);

  if (reviews === null) {
    return (
      <div>
        <h2 className="text-lg font-medium mb-4">Reviews</h2>
        <p className="text-text-secondary">Loading reviews…</p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-medium mb-4">Reviews</h2>
        <p className="text-text-secondary">No reviews yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-6">
        <h2 className="text-lg font-medium">Reviews</h2>
        <span className="text-text-secondary">
          {averages ? `${averages.overall.toFixed(2)} · ${averages.count} reviews` : ''}
        </span>
      </div>

      <Separator className="bg-border" />

      <div className="divide-y divide-border">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}
