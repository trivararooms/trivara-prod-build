import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FIXED_COUNTRY, FIXED_STATE, KARNATAKA_CITIES } from '@/data/karnatakaLocations';
import { ListingFormData, UpdateFormFn } from './types';

interface LocationStepProps {
  formData: ListingFormData;
  updateForm: UpdateFormFn;
}

export function LocationStep({ formData, updateForm }: LocationStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-medium mb-2">Where is your property?</h2>
        <p className="text-text-secondary">Your address is only shared with guests after they book</p>
      </div>
      <div className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm text-text-secondary mb-2">Street address</label>
          <Input
            value={formData.address}
            onChange={(e) => updateForm({ address: e.target.value })}
            placeholder="123 Main Street"
            className="trivara-input"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">City / town</label>
            <Select value={formData.city} onValueChange={(value) => updateForm({ city: value })}>
              <SelectTrigger className="trivara-input">
                <SelectValue placeholder="Select a city or town" />
              </SelectTrigger>
              <SelectContent>
                {KARNATAKA_CITIES.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">State</label>
            <Select value={FIXED_STATE} disabled>
              <SelectTrigger className="trivara-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FIXED_STATE}>{FIXED_STATE}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Country</label>
            <Select value={FIXED_COUNTRY} disabled>
              <SelectTrigger className="trivara-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FIXED_COUNTRY}>{FIXED_COUNTRY}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">Postal code</label>
            <Input
              value={formData.postalCode}
              onChange={(e) => updateForm({ postalCode: e.target.value })}
              placeholder="560001"
              className="trivara-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
