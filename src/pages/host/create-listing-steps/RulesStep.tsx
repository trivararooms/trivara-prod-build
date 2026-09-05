import { CancellationPolicy } from '@/types';
import { ListingFormData, UpdateFormFn, optionCardClass } from './types';

const cancellationPolicies: { value: CancellationPolicy; label: string; description: string }[] = [
  { value: 'flexible', label: 'Flexible', description: 'Full refund up to 24 hours before check-in' },
  { value: 'moderate', label: 'Moderate', description: 'Full refund up to 5 days before check-in' },
  { value: 'strict', label: 'Strict', description: 'Full refund up to 14 days before check-in' },
];

interface RulesStepProps {
  formData: ListingFormData;
  updateForm: UpdateFormFn;
}

export function RulesStep({ formData, updateForm }: RulesStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-medium mb-2">Set house rules</h2>
        <p className="text-text-secondary">Let guests know what to expect</p>
      </div>
      <div className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm text-text-secondary mb-2">Cancellation policy</label>
          <div className="space-y-3">
            {cancellationPolicies.map((policy) => {
              const selected = formData.cancellationPolicy === policy.value;
              return (
                <label
                  key={policy.value}
                  className={`flex items-start gap-3 p-4 cursor-pointer ${optionCardClass(selected)}`}
                >
                  <input
                    type="radio"
                    name="cancellationPolicy"
                    checked={selected}
                    onChange={() => updateForm({ cancellationPolicy: policy.value })}
                    className="mt-1 accent-accent"
                  />
                  <div>
                    <p className="font-medium">{policy.label}</p>
                    <p className="text-sm text-text-secondary">{policy.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-2">Booking type</label>
          <div className="space-y-3">
            <label className={`flex items-start gap-3 p-4 cursor-pointer ${optionCardClass(formData.instantBook)}`}>
              <input
                type="radio"
                name="instantBook"
                checked={formData.instantBook}
                onChange={() => updateForm({ instantBook: true })}
                className="mt-1 accent-accent"
              />
              <div>
                <p className="font-medium">Instant Book</p>
                <p className="text-sm text-text-secondary">Guests can book and pay immediately, no approval needed.</p>
              </div>
            </label>
            <label className={`flex items-start gap-3 p-4 cursor-pointer ${optionCardClass(!formData.instantBook)}`}>
              <input
                type="radio"
                name="instantBook"
                checked={!formData.instantBook}
                onChange={() => updateForm({ instantBook: false })}
                className="mt-1 accent-accent"
              />
              <div>
                <p className="font-medium">Request to Book</p>
                <p className="text-sm text-text-secondary">You review and approve each request before the guest pays.</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
