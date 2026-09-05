import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CounterInput } from '@/components/ui/CounterInput';
import { ListingFormData, UpdateFormFn } from './types';

const COUNTER_FIELDS: { key: 'maxGuests' | 'bedrooms' | 'beds' | 'bathrooms'; label: string; min: number; max: number }[] = [
  { key: 'maxGuests', label: 'Max guests', min: 1, max: 16 },
  { key: 'bedrooms', label: 'Bedrooms', min: 0, max: 10 },
  { key: 'beds', label: 'Beds', min: 1, max: 20 },
  { key: 'bathrooms', label: 'Bathrooms', min: 1, max: 10 },
];

interface DetailsStepProps {
  formData: ListingFormData;
  updateForm: UpdateFormFn;
}

export function DetailsStep({ formData, updateForm }: DetailsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-medium mb-2">Tell guests about your place</h2>
        <p className="text-text-secondary">Share what makes your place special</p>
      </div>
      <div className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm text-text-secondary mb-2">Title</label>
          <Input
            value={formData.title}
            onChange={(e) => updateForm({ title: e.target.value })}
            placeholder="Cozy mountain retreat with stunning views"
            className="trivara-input"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-2">Description</label>
          <Textarea
            value={formData.description}
            onChange={(e) => updateForm({ description: e.target.value })}
            placeholder="Describe the unique features and atmosphere of your place..."
            rows={6}
            className="trivara-input resize-none"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {COUNTER_FIELDS.map(({ key, label, min, max }) => (
            <CounterInput
              key={key}
              label={label}
              value={formData[key]}
              onChange={(val) => updateForm({ [key]: val })}
              min={min}
              max={max}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
