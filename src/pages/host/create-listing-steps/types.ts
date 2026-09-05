import { PropertyType, CancellationPolicy } from '@/types';

// Shared shape of the wizard's in-progress form state, used by CreateListing.tsx
// and by every per-step component in this folder.
export interface ListingFormData {
  propertyType: PropertyType | '';
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  photos: string[];
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  amenities: string[];
  pricePerNight: number;
  cleaningFee: number;
  serviceFee: number;
  houseRules: string[];
  cancellationPolicy: CancellationPolicy;
  instantBook: boolean;
}

export type UpdateFormFn = (updates: Partial<ListingFormData>) => void;

// Shared "selectable option card" look used across the type/amenities/rules
// steps - a bordered, tinted-accent selected state (not a solid accent fill)
// so a grid of many selections doesn't turn into a wall of solid gold.
export const optionCardClass = (selected: boolean) =>
  `rounded-lg trivara-transition border ${selected
    ? 'border-accent bg-accent/10'
    : 'border-border bg-card hover:bg-surface-3'
  }`;
