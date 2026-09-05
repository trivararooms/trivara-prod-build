import { formatINR } from '@/lib/utils';
import { ListingFormData } from './types';

interface ReviewStepProps {
  formData: ListingFormData;
}

export function ReviewStep({ formData }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-medium mb-2">Review your listing draft</h2>
        <p className="text-text-secondary">Make sure everything looks good before saving as draft</p>
      </div>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {formData.photos[0] && (
          <div className="aspect-video">
            <img src={formData.photos[0]} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6 space-y-4">
          <h3 className="text-xl font-medium">{formData.title || 'Untitled listing'}</h3>
          <p className="text-text-secondary">
            {formData.city}, {formData.state}, {formData.country}
          </p>
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            <span>{formData.propertyType?.replace('_', ' ')}</span>
            <span>{formData.maxGuests} guests</span>
            <span>{formData.bedrooms} bedrooms</span>
            <span>{formData.beds} beds</span>
            <span>{formData.bathrooms} baths</span>
          </div>
          <p className="text-lg font-pillar font-bold text-accent">{formatINR(formData.pricePerNight)}/night</p>
        </div>
      </div>
    </div>
  );
}
