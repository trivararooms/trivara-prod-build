import { Home, Building, Warehouse, Hotel } from 'lucide-react';
import { PropertyType } from '@/types';
import { ListingFormData, UpdateFormFn, optionCardClass } from './types';

const propertyTypes: { value: PropertyType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'entire_place', label: 'Entire place', description: 'Guests have the whole place to themselves', icon: <Home className="h-6 w-6" /> },
  { value: 'private_room', label: 'Private room', description: 'Guests have their own room, shared spaces', icon: <Building className="h-6 w-6" /> },
  { value: 'shared_room', label: 'Shared room', description: 'Guests sleep in a shared space', icon: <Warehouse className="h-6 w-6" /> },
  { value: 'hotel_room', label: 'Hotel room', description: 'Professional hospitality business', icon: <Hotel className="h-6 w-6" /> },
];

interface PropertyTypeStepProps {
  formData: ListingFormData;
  updateForm: UpdateFormFn;
}

export function PropertyTypeStep({ formData, updateForm }: PropertyTypeStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-medium mb-2">What type of property?</h2>
        <p className="text-text-secondary">Choose the option that best describes your place</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {propertyTypes.map((type) => {
          const selected = formData.propertyType === type.value;
          return (
            <button
              key={type.value}
              onClick={() => updateForm({ propertyType: type.value })}
              className={`p-6 text-left ${optionCardClass(selected)}`}
            >
              <div className={`mb-4 ${selected ? 'text-accent' : 'text-text-secondary'}`}>{type.icon}</div>
              <h3 className="font-medium mb-1">{type.label}</h3>
              <p className="text-sm text-text-secondary">{type.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
