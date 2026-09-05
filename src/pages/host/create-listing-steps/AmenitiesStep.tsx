import { Checkbox } from '@/components/ui/checkbox';
import { amenitiesList, accessibilityList } from '@/data/amenities';
import { ListingFormData, UpdateFormFn, optionCardClass } from './types';

interface AmenitiesStepProps {
  formData: ListingFormData;
  updateForm: UpdateFormFn;
}

export function AmenitiesStep({ formData, updateForm }: AmenitiesStepProps) {
  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      updateForm({ amenities: [...formData.amenities, id] });
    } else {
      updateForm({ amenities: formData.amenities.filter((a) => a !== id) });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-medium mb-2">What amenities do you offer?</h2>
        <p className="text-text-secondary">Select all that apply</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {amenitiesList.map((amenity) => {
          const selected = formData.amenities.includes(amenity.id);
          return (
            <label key={amenity.id} className={`flex items-center gap-3 p-4 cursor-pointer ${optionCardClass(selected)}`}>
              <Checkbox checked={selected} onCheckedChange={(checked) => toggle(amenity.id, checked === true)} />
              <span>{amenity.label}</span>
            </label>
          );
        })}
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2 mt-4">Accessibility</h3>
        <p className="text-text-secondary mb-4">Select any that apply - these show up as filters for guests who need them</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {accessibilityList.map((feature) => {
            const selected = formData.amenities.includes(feature.id);
            return (
              <label key={feature.id} className={`flex items-center gap-3 p-4 cursor-pointer ${optionCardClass(selected)}`}>
                <Checkbox checked={selected} onCheckedChange={(checked) => toggle(feature.id, checked === true)} />
                <span>{feature.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
