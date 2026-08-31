export const amenitiesList = [
  { id: 'wifi', label: 'Wifi', icon: 'Wifi' },
  { id: 'kitchen', label: 'Kitchen', icon: 'UtensilsCrossed' },
  { id: 'parking', label: 'Free parking', icon: 'Car' },
  { id: 'pool', label: 'Pool', icon: 'Waves' },
  { id: 'hot_tub', label: 'Hot tub', icon: 'Bath' },
  { id: 'air_conditioning', label: 'Air conditioning', icon: 'Wind' },
  { id: 'heating', label: 'Heating', icon: 'Flame' },
  { id: 'washer', label: 'Washer', icon: 'WashingMachine' },
  { id: 'dryer', label: 'Dryer', icon: 'Wind' },
  { id: 'workspace', label: 'Dedicated workspace', icon: 'Monitor' },
  { id: 'fireplace', label: 'Fireplace', icon: 'Flame' },
  { id: 'beach_access', label: 'Beach access', icon: 'Umbrella' },
  { id: 'gym_access', label: 'Gym', icon: 'Dumbbell' },
  { id: 'outdoor_shower', label: 'Outdoor shower', icon: 'Droplets' },
  { id: 'patio', label: 'Patio', icon: 'Trees' },
  { id: 'bbq', label: 'BBQ grill', icon: 'Flame' },
  { id: 'outdoor_dining', label: 'Outdoor dining', icon: 'TreePalm' },
  { id: 'pets_allowed', label: 'Pets allowed', icon: 'PawPrint' },
];

// Step-free access, wide doorways, etc - kept separate from `amenitiesList`
// so the Search filters sheet can show them under their own "Accessibility"
// heading instead of buried in a generic amenities grid, matching how other
// OTAs surface accessibility as its own filter category.
export const accessibilityList = [
  { id: 'step_free_access', label: 'Step-free access', icon: 'Accessibility' },
  { id: 'wide_doorways', label: 'Wide doorways', icon: 'DoorOpen' },
  { id: 'accessible_bathroom', label: 'Accessible bathroom', icon: 'Bath' },
];