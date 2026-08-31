import { useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { ReviewCard } from './ReviewCard';
import { reviewService } from '@/services/reviewService';
import { Review, ReviewCategoryRatings } from '@/types';

const CATEGORY_LABELS: Record<keyof ReviewCategoryRatings, string> = {
  cleanliness: 'Cleanliness',
  accuracy: 'Accuracy',
  communication: 'Communication',
  value: 'Value',
  location: 'Location',
};

function categoryAverages(reviews: Review[]): { label: string; average: number }[] {
  const keys = Object.keys(CATEGORY_LABELS) as (keyof ReviewCategoryRatings)[];
  return keys
    .map((key) => {
      const values = reviews.map((r) => r.categories[key]).filter((v): v is number => v !== undefined);
      if (values.length === 0) return null;
      return { label: CATEGORY_LABELS[key], average: values.reduce((a, b) => a + b, 0) / values.length };
    })
    .filter((v): v is { label: string; average: number } => v !== null);
}

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
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-lg font-medium">Reviews</h2>
        <span className="text-text-secondary">
          {averages ? `${averages.overall.toFixed(2)} · ${averages.count} reviews` : ''}
        </span>
      </div>

      {categoryAverages(reviews).length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary mb-6">
          {categoryAverages(reviews).map(({ label, average }) => (
            <span key={label}>{label}: {average.toFixed(1)}</span>
          ))}
        </div>
      )}

      <Separator className="bg-border mb-0" />

      <div className="divide-y divide-border">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}
