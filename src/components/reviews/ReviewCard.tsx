import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Star } from 'lucide-react';
import { Review } from '@/types';
import { supabase } from '@/lib/supabase';

interface ReviewCardProps {
  review: Review;
}

interface ReviewerProfile {
  first_name: string | null;
  avatar_url: string | null;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const [reviewer, setReviewer] = useState<ReviewerProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchReviewer = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, avatar_url')
        .eq('id', review.reviewerId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching reviewer:', error);
        return;
      }
      if (!cancelled) setReviewer(data);
    };

    if (review.reviewerId) {
      fetchReviewer();
    }

    return () => { cancelled = true; };
  }, [review.reviewerId]);

  return (
    <div className="py-6">
      <div className="flex items-start gap-4 mb-4">
        <div className="h-10 w-10 rounded-full bg-surface-2 overflow-hidden flex-shrink-0">
          {reviewer?.avatar_url ? (
            <img
              src={reviewer.avatar_url}
              alt={reviewer.first_name || 'Guest'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-medium">
              {reviewer?.first_name?.[0] || 'G'}
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium">{reviewer?.first_name || 'Guest'}</p>
          <p className="text-sm text-text-meta">
            {format(new Date(review.createdAt), 'MMMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-medium">{review.rating.toFixed(1)}</span>
        </div>
      </div>

      {review.comment && (
        <p className="text-text-secondary leading-relaxed">{review.comment}</p>
      )}
    </div>
  );
}
