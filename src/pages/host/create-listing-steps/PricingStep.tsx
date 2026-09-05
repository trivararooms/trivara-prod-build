import { Input } from '@/components/ui/input';
import { ListingFormData, UpdateFormFn } from './types';

interface PricingStepProps {
  formData: ListingFormData;
  updateForm: UpdateFormFn;
}

export function PricingStep({ formData, updateForm }: PricingStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-medium mb-2">Set your price</h2>
        <p className="text-text-secondary">You can adjust your pricing anytime</p>
      </div>
      <div className="space-y-6 max-w-md">
        <div>
          <label className="block text-sm text-text-secondary mb-2">Price per night</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">₹</span>
            <Input
              type="number"
              value={formData.pricePerNight}
              onChange={(e) => updateForm({ pricePerNight: parseInt(e.target.value) || 0 })}
              className="trivara-input pl-8 text-2xl font-semibold"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-2">Cleaning fee</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">₹</span>
            <Input
              type="number"
              value={formData.cleaningFee}
              onChange={(e) => updateForm({ cleaningFee: parseInt(e.target.value) || 0 })}
              className="trivara-input pl-8"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
