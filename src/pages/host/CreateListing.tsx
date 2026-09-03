import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Home, MapPin, Image, Sparkles, DollarSign,
  CalendarDays, ClipboardList, FileCheck, ChevronRight, ChevronLeft,
  Building, Warehouse, TreePine, Hotel, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { listingService } from '@/services/listingService';
import { amenitiesList, accessibilityList } from '@/data/amenities';
import { PropertyType, CancellationPolicy } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/utils';
import { CounterInput } from '@/components/ui/CounterInput';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/lib/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FIXED_COUNTRY, FIXED_STATE, KARNATAKA_CITIES } from '@/data/karnatakaLocations';

const STEPS = [
  { id: 'type', label: 'Property type', icon: Home },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'photos', label: 'Photos', icon: Image },
  { id: 'details', label: 'Details', icon: Sparkles },
  { id: 'amenities', label: 'Amenities', icon: ClipboardList },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'availability', label: 'Availability', icon: CalendarDays },
  { id: 'rules', label: 'House rules', icon: ClipboardList },
  { id: 'review', label: 'Review', icon: FileCheck },
];

const propertyTypes: { value: PropertyType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'entire_place', label: 'Entire place', description: 'Guests have the whole place to themselves', icon: <Home className="h-6 w-6" /> },
  { value: 'private_room', label: 'Private room', description: 'Guests have their own room, shared spaces', icon: <Building className="h-6 w-6" /> },
  { value: 'shared_room', label: 'Shared room', description: 'Guests sleep in a shared space', icon: <Warehouse className="h-6 w-6" /> },
  { value: 'hotel_room', label: 'Hotel room', description: 'Professional hospitality business', icon: <Hotel className="h-6 w-6" /> },
];

const cancellationPolicies: { value: CancellationPolicy; label: string; description: string }[] = [
  { value: 'flexible', label: 'Flexible', description: 'Full refund up to 24 hours before check-in' },
  { value: 'moderate', label: 'Moderate', description: 'Full refund up to 5 days before check-in' },
  { value: 'strict', label: 'Strict', description: 'Full refund up to 14 days before check-in' },
];

const COUNTER_FIELDS: { key: 'maxGuests' | 'bedrooms' | 'beds' | 'bathrooms'; label: string; min: number; max: number }[] = [
  { key: 'maxGuests', label: 'Max guests', min: 1, max: 16 },
  { key: 'bedrooms', label: 'Bedrooms', min: 0, max: 10 },
  { key: 'beds', label: 'Beds', min: 1, max: 20 },
  { key: 'bathrooms', label: 'Bathrooms', min: 1, max: 10 },
];

interface ListingFormData {
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

// Result of loading either an existing listing (edit mode) or an in-progress
// draft (create mode, if one exists) - see fetchListingEditData below.
type ListingEditQueryResult =
  | { kind: 'edit'; formData: ListingFormData }
  | { kind: 'draft'; draftId: string; formData: ListingFormData }
  | { kind: 'none' };

// Load existing listing data in edit mode, or find an existing draft in
// create mode. Pure data loading only - the autosave logic further down is
// intentionally left as hand-rolled useState/useEffect (see NEXT_STEPS.md).
async function fetchListingEditData(
  urlId: string | undefined,
  user: { id: string } | null
): Promise<ListingEditQueryResult> {
  if (!user) {
    throw new Error('User not authenticated');
  }

  if (urlId) {
    // Edit mode: Fetch specific listing
    const listing = await listingService.getById(urlId);
    if (!listing) throw new Error('Listing not found');
    if (listing.hostId !== user.id) throw new Error('Unauthorized: You can only edit your own listings');

    return {
      kind: 'edit',
      formData: {
        propertyType: listing.propertyType as PropertyType,
        title: listing.title,
        description: listing.description,
        address: listing.location?.address || '',
        city: listing.location?.city || '',
        state: FIXED_STATE,
        country: FIXED_COUNTRY,
        postalCode: listing.location?.postalCode || '',
        photos: listing.photos || [],
        maxGuests: listing.maxGuests,
        bedrooms: listing.bedrooms,
        beds: listing.beds,
        bathrooms: listing.bathrooms,
        amenities: listing.amenities || [],
        pricePerNight: listing.pricePerNight,
        cleaningFee: listing.cleaningFee,
        serviceFee: listing.serviceFee,
        houseRules: listing.houseRules || ['No smoking', 'No parties'],
        cancellationPolicy: listing.cancellationPolicy as CancellationPolicy,
        instantBook: listing.instantBook ?? true,
      },
    };
  }

  // Create mode: Check for existing draft
  const userListings = await listingService.getByHostId(user.id);
  const existingDraft = userListings.find(l => l.status === 'draft');

  if (!existingDraft) {
    return { kind: 'none' };
  }

  return {
    kind: 'draft',
    draftId: existingDraft.id,
    formData: {
      propertyType: (existingDraft.propertyType as PropertyType) || '',
      title: existingDraft.title || '',
      description: existingDraft.description || '',
      address: existingDraft.location?.address || '',
      city: existingDraft.location?.city || '',
      state: FIXED_STATE,
      country: FIXED_COUNTRY,
      postalCode: existingDraft.location?.postalCode || '',
      photos: existingDraft.photos || [],
      maxGuests: existingDraft.maxGuests || 2,
      bedrooms: existingDraft.bedrooms || 1,
      beds: existingDraft.beds || 1,
      bathrooms: existingDraft.bathrooms || 1,
      amenities: existingDraft.amenities || [],
      pricePerNight: existingDraft.pricePerNight || 100,
      cleaningFee: existingDraft.cleaningFee || 50,
      serviceFee: existingDraft.serviceFee || 20,
      houseRules: existingDraft.houseRules || ['No smoking', 'No parties'],
      cancellationPolicy: (existingDraft.cancellationPolicy as CancellationPolicy) || 'moderate',
      instantBook: existingDraft.instantBook ?? true,
    },
  };
}

export default function CreateListing() {
  const { id: urlId } = useParams<{ id?: string }>();
  const isEditMode = Boolean(urlId);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(urlId || null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Form state
  const [formData, setFormData] = useState<ListingFormData>({
    propertyType: '',
    title: '',
    description: '',
    address: '',
    city: '',
    state: FIXED_STATE,
    country: FIXED_COUNTRY,
    postalCode: '',
    photos: [] as string[], // Empty by default for edit mode
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: [] as string[],
    pricePerNight: 100,
    cleaningFee: 50,
    serviceFee: 20,
    houseRules: ['No smoking', 'No parties'] as string[],
    cancellationPolicy: 'moderate' as CancellationPolicy,
    instantBook: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateForm = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleAddPhotos = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        // Upload files to Supabase Storage
        const uploadedPhotoUrls = [];

        for (const file of Array.from(files)) {
          // Upload to Supabase Storage
          const { data, error } = await supabase.storage
            .from('listing-photos')
            .upload(`${Date.now()}-${file.name}`, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (error) {
            throw new Error(`Failed to upload photo: ${error.message}`);
          }

          // Get public URL for the uploaded file
          const { data: { publicUrl } } = supabase.storage
            .from('listing-photos')
            .getPublicUrl(data.path);

          uploadedPhotoUrls.push(publicUrl);
        }

        // Update form data with uploaded photo URLs
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos, ...uploadedPhotoUrls]
        }));
      } catch (error: unknown) {
        console.error('Error uploading photos:', error);
        toast({
          title: 'Upload failed',
          description: getErrorMessage(error, 'Failed to upload photos. Please try again.'),
          variant: 'destructive',
        });
      }
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => {
      const newPhotos = [...prev.photos];
      // Only revoke object URLs, not uploaded photo URLs
      if (newPhotos[index].startsWith('blob:')) {
        URL.revokeObjectURL(newPhotos[index]);
      }
      newPhotos.splice(index, 1);
      return { ...prev, photos: newPhotos };
    });
  };

  // Clean up object URLs when component unmounts. This intentionally only
  // runs once (on mount/unmount) - we don't want to revoke URLs every time
  // formData.photos changes mid-editing, only when the user actually leaves
  // the page. A ref keeps the cleanup closure looking at the latest photos
  // array without needing formData.photos in the dependency array.
  const latestPhotosRef = useRef(formData.photos);
  useEffect(() => {
    latestPhotosRef.current = formData.photos;
  }, [formData.photos]);

  useEffect(() => {
    return () => {
      // Only revoke blob URLs, not actual uploaded photo URLs
      latestPhotosRef.current.forEach(photo => {
        if (photo.startsWith('blob:')) {
          URL.revokeObjectURL(photo);
        }
      });
    };
  }, []);

  const debouncedFormData = useDebounce(formData, 1500);

  // Load existing listing data in edit mode or find existing draft
  const listingDataQuery = useQuery({
    queryKey: ['listing-edit-data', urlId, user?.id],
    queryFn: () => fetchListingEditData(urlId, user),
  });

  // Always start true so we can check for an existing draft/listing first -
  // react-query's `isPending` mirrors that (true until this query's first
  // fetch settles, success or error).
  const isLoading = listingDataQuery.isPending;

  // Apply whatever fetchListingEditData resolved with into the editable form
  // state - mirrors the side effects the old effect used to perform inline
  // after a successful load.
  useEffect(() => {
    const data = listingDataQuery.data;
    if (!data) return;

    if (data.kind === 'edit') {
      setFormData(data.formData);
    } else if (data.kind === 'draft') {
      setDraftId(data.draftId);
      setFormData(data.formData);
      toast({
        title: 'Draft loaded',
        description: 'We found your previous unsaved listing and loaded it for you.',
      });
    }
    setInitialLoadComplete(true);
  }, [listingDataQuery.data, toast]);

  useEffect(() => {
    if (listingDataQuery.error) {
      console.error('Error loading listing:', listingDataQuery.error);
      toast({
        title: 'Error',
        description: getErrorMessage(listingDataQuery.error, 'Failed to load listing data'),
        variant: 'destructive',
      });
      if (urlId) navigate('/host/dashboard'); // Only redirect if specifically looking for an ID
    }
  }, [listingDataQuery.error, toast, urlId, navigate]);

  // State to prevent race conditions during initial draft creation
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);

  // Autosave logic
  useEffect(() => {
    const autoSaveDraft = async () => {
      // Prevent saving if we are currently mid-creation of the initial draft to avoid duplicates
      if (!initialLoadComplete || isSubmitting || isCreatingDraft || (currentStep === 0 && !formData.propertyType)) {
        return;
      }

      try {
        setIsSavingDraft(true);
        if (!user) return;

        const validPhotos = debouncedFormData.photos.filter(photo => !photo.startsWith('blob:'));

        const payload = {
          title: debouncedFormData.title.trim() || 'Untitled Draft',
          description: debouncedFormData.description.trim(),
          propertyType: debouncedFormData.propertyType as PropertyType,
          location: {
            address: debouncedFormData.address,
            city: debouncedFormData.city,
            state: debouncedFormData.state,
            country: debouncedFormData.country,
            postalCode: debouncedFormData.postalCode,
            lat: 37.7749, // Needs real geocoding eventually
            lng: -122.4194,
          },
          photos: validPhotos,
          amenities: debouncedFormData.amenities,
          pricePerNight: debouncedFormData.pricePerNight,
          cleaningFee: debouncedFormData.cleaningFee,
          serviceFee: debouncedFormData.serviceFee,
          maxGuests: debouncedFormData.maxGuests,
          bedrooms: debouncedFormData.bedrooms,
          beds: debouncedFormData.beds,
          bathrooms: debouncedFormData.bathrooms,
          houseRules: debouncedFormData.houseRules,
          cancellationPolicy: debouncedFormData.cancellationPolicy,
          instantBook: debouncedFormData.instantBook,
          status: 'draft' as const,
        };

        if (draftId || isEditMode) {
          // Update existing draft
          await listingService.update(draftId!, payload);
          setLastSaved(new Date());
        } else {
          // Atomic Create new draft limit block
          setIsCreatingDraft(true);
          const newDraft = await listingService.create({
            ...payload,
            hostId: user.id,
          });
          if (newDraft) {
            setDraftId(newDraft.id);
            setLastSaved(new Date());
          }
          setIsCreatingDraft(false); // Unlock after draftId is populated
        }
      } catch (error) {
        console.error('Autosave failed:', error);
        setIsCreatingDraft(false); // Ensure we unlock if creation fails so user isn't permanently locked out
      } finally {
        setIsSavingDraft(false);
      }
    };

    // Only fire autosave if we actually have data that isn't the blank default, and we aren't creating the first draft
    if (!isCreatingDraft) {
      autoSaveDraft();
    }
  }, [debouncedFormData, currentStep, initialLoadComplete, isSubmitting, draftId, isEditMode, formData.propertyType, isCreatingDraft, user]);

  // Hook to warn users of unsaved changes before they close the tab
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // If we have unsaved changes that haven't passed the debounce timeout yet
      // This is a simple heuristic assuming if they are typing, changing pages, there could be data
      if (initialLoadComplete && !isSubmitting && JSON.stringify(formData) !== JSON.stringify(debouncedFormData)) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome to show the prompt
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formData, debouncedFormData, initialLoadComplete, isSubmitting]);

  const canProceed = () => {
    switch (STEPS[currentStep].id) {
      case 'type':
        return !!formData.propertyType;
      case 'location':
        return formData.city && formData.state && formData.country && formData.address;
      case 'photos':
        return formData.photos.length > 0;
      case 'details':
        return formData.title.trim() !== '' && formData.description.trim() !== '' && formData.maxGuests > 0 && formData.bedrooms >= 0 && formData.beds >= 0 && formData.bathrooms >= 0;
      case 'amenities':
        // No validation required for amenities
        return true;
      case 'pricing':
        return formData.pricePerNight > 0;
      case 'availability':
        // No validation required for availability step
        return true;
      case 'rules':
        return !!formData.cancellationPolicy;
      case 'review':
        // Validate that all required fields are filled for final submission
        return formData.propertyType &&
          formData.title.trim() !== '' &&
          formData.description.trim() !== '' &&
          formData.city && formData.state && formData.country &&
          formData.pricePerNight > 0 &&
          formData.photos.length > 0;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Additional validation before submitting
      if (!formData.propertyType || !formData.title.trim() || !formData.description.trim() ||
        !formData.city || !formData.state || !formData.country || !formData.address ||
        formData.pricePerNight <= 0) {
        throw new Error('Please fill in all required fields before submitting.');
      }

      // For create mode, require at least one photo
      if (!isEditMode && formData.photos.length === 0) {
        throw new Error('At least one photo is required to save a listing draft.');
      }

      // Get current user ID from Supabase auth
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Filter out temporary blob URLs, only send actual image URLs to the database
      const validPhotos = formData.photos.filter(photo => !photo.startsWith('blob:'));

      // Handle photo validation differently for edit vs create mode
      let finalPhotos = validPhotos;
      if (validPhotos.length === 0) {
        if (isEditMode) {
          // In edit mode, keep existing photos if no new ones uploaded
          finalPhotos = formData.photos;
        } else {
          // In create mode, require at least one photo
          throw new Error('At least one photo is required to save a listing draft.');
        }
      }

      if (isEditMode && urlId) {
        // UPDATE existing listing
        const updatedListing = await listingService.update(urlId, {
          title: formData.title.trim(),
          description: formData.description.trim(),
          propertyType: formData.propertyType as PropertyType,
          location: {
            address: formData.address,
            city: formData.city,
            state: formData.state,
            country: formData.country,
            postalCode: formData.postalCode,
            lat: 37.7749,
            lng: -122.4194,
          },
          photos: finalPhotos,
          amenities: formData.amenities,
          pricePerNight: formData.pricePerNight,
          cleaningFee: formData.cleaningFee,
          serviceFee: formData.serviceFee,
          maxGuests: formData.maxGuests,
          bedrooms: formData.bedrooms,
          beds: formData.beds,
          bathrooms: formData.bathrooms,
          houseRules: formData.houseRules,
          cancellationPolicy: formData.cancellationPolicy,
          instantBook: formData.instantBook,
        });

        if (updatedListing) {
          toast({
            title: 'Listing updated',
            description: 'Your listing has been successfully updated.',
          });
          navigate('/host/dashboard');
        } else {
          throw new Error('Failed to update listing');
        }
      } else {
        // CREATE new listing as draft
        const listing = await listingService.create({
          hostId: user.id,
          title: formData.title.trim(),
          description: formData.description.trim(),
          propertyType: formData.propertyType as PropertyType,
          location: {
            address: formData.address,
            city: formData.city,
            state: formData.state,
            country: formData.country,
            postalCode: formData.postalCode,
            lat: 37.7749,
            lng: -122.4194,
          },
          photos: finalPhotos,
          amenities: formData.amenities,
          pricePerNight: formData.pricePerNight,
          cleaningFee: formData.cleaningFee,
          serviceFee: formData.serviceFee,
          maxGuests: formData.maxGuests,
          bedrooms: formData.bedrooms,
          beds: formData.beds,
          bathrooms: formData.bathrooms,
          houseRules: formData.houseRules,
          cancellationPolicy: formData.cancellationPolicy,
          instantBook: formData.instantBook,
        });

        toast({
          title: 'Draft saved',
          description: 'Your listing draft has been saved. You can publish it when ready.',
        });

        navigate('/host/dashboard');
      }
    } catch (error: unknown) {
      console.error(`${isEditMode ? 'Update' : 'Create'} listing draft error:`, error);
      const rawMessage = getErrorMessage(error, '');
      let errorMessage = `Failed to ${isEditMode ? 'update' : 'save'} listing draft. Please try again.`;

      // A few specific failures get a friendlier message; everything else
      // falls back to the raw error appended to the generic message above.
      if (rawMessage.includes('User not authenticated')) {
        errorMessage = 'User not authenticated. Please log in first.';
      } else if (
        rawMessage.includes('Please fill in all required fields') ||
        rawMessage.includes('at least one photo') ||
        rawMessage.includes('Unauthorized')
      ) {
        errorMessage = rawMessage;
      } else if (rawMessage) {
        errorMessage = `Failed to ${isEditMode ? 'update' : 'save'} listing draft: ${rawMessage}`;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'type':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-pillar font-bold uppercase tracking-wide mb-2">What type of property?</h2>
              <p className="text-text-secondary">Choose the option that best describes your place</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {propertyTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => updateForm({ propertyType: type.value })}
                  className={`p-6 rounded-xl text-left trivara-transition ${formData.propertyType === type.value
                    ? 'bg-accent ring-2 ring-accent'
                    : 'bg-card hover:bg-surface-3'
                    }`}
                >
                  <div className="mb-4">{type.icon}</div>
                  <h3 className="font-medium mb-1">{type.label}</h3>
                  <p className="text-sm text-text-secondary">{type.description}</p>
                </button>
              ))}
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-pillar font-bold uppercase tracking-wide mb-2">Where is your property?</h2>
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

      case 'photos':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-pillar font-bold uppercase tracking-wide mb-2">Add photos</h2>
              <p className="text-text-secondary">Photos help guests imagine staying at your place</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {formData.photos.map((photo, idx) => (
                <div key={idx} className="aspect-[4/3] rounded-xl overflow-hidden bg-surface-0 relative group">
                  <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddPhotos}
                className="aspect-[4/3] rounded-xl bg-card hover:bg-surface-3 trivara-transition flex flex-col items-center justify-center gap-2"
              >
                <Image className="h-8 w-8 text-text-secondary" />
                <span className="text-sm text-text-secondary">Add photos</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {formData.photos.length === 0 && (
              <div className="text-sm text-destructive">
                At least one photo is required to save a listing draft
              </div>
            )}
          </div>
        );

      case 'details':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-pillar font-bold uppercase tracking-wide mb-2">Tell guests about your place</h2>
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

      case 'amenities':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-pillar font-bold uppercase tracking-wide mb-2">What amenities do you offer?</h2>
              <p className="text-text-secondary">Select all that apply</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {amenitiesList.map((amenity) => (
                <label
                  key={amenity.id}
                  className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer trivara-transition ${formData.amenities.includes(amenity.id)
                    ? 'bg-accent'
                    : 'bg-card hover:bg-surface-3'
                    }`}
                >
                  <Checkbox
                    checked={formData.amenities.includes(amenity.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        updateForm({ amenities: [...formData.amenities, amenity.id] });
                      } else {
                        updateForm({ amenities: formData.amenities.filter(a => a !== amenity.id) });
                      }
                    }}
                  />
                  <span>{amenity.label}</span>
                </label>
              ))}
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2 mt-4">Accessibility</h3>
              <p className="text-text-secondary mb-4">Select any that apply - these show up as filters for guests who need them</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {accessibilityList.map((feature) => (
                  <label
                    key={feature.id}
                    className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer trivara-transition ${formData.amenities.includes(feature.id)
                      ? 'bg-accent'
                      : 'bg-card hover:bg-surface-3'
                      }`}
                  >
                    <Checkbox
                      checked={formData.amenities.includes(feature.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateForm({ amenities: [...formData.amenities, feature.id] });
                        } else {
                          updateForm({ amenities: formData.amenities.filter(a => a !== feature.id) });
                        }
                      }}
                    />
                    <span>{feature.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'pricing':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-pillar font-bold uppercase tracking-wide mb-2">Set your price</h2>
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

      case 'availability':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-pillar font-bold uppercase tracking-wide mb-2">Set availability</h2>
              <p className="text-text-secondary">You can update your calendar after publishing</p>
            </div>
            <div className="bg-card rounded-xl p-8 text-center">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 text-text-secondary" />
              <p className="text-text-secondary">Calendar management will be available after publishing</p>
            </div>
          </div>
        );

      case 'rules':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-pillar font-bold uppercase tracking-wide mb-2">Set house rules</h2>
              <p className="text-text-secondary">Let guests know what to expect</p>
            </div>
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm text-text-secondary mb-2">Cancellation policy</label>
                <div className="space-y-3">
                  {cancellationPolicies.map((policy) => (
                    <label
                      key={policy.value}
                      className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer trivara-transition ${formData.cancellationPolicy === policy.value
                        ? 'bg-accent'
                        : 'bg-card hover:bg-surface-3'
                        }`}
                    >
                      <input
                        type="radio"
                        name="cancellationPolicy"
                        checked={formData.cancellationPolicy === policy.value}
                        onChange={() => updateForm({ cancellationPolicy: policy.value })}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium">{policy.label}</p>
                        <p className="text-sm text-text-secondary">{policy.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">Booking type</label>
                <div className="space-y-3">
                  <label
                    className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer trivara-transition ${formData.instantBook ? 'bg-accent' : 'bg-card hover:bg-surface-3'}`}
                  >
                    <input
                      type="radio"
                      name="instantBook"
                      checked={formData.instantBook}
                      onChange={() => updateForm({ instantBook: true })}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium">Instant Book</p>
                      <p className="text-sm text-text-secondary">Guests can book and pay immediately, no approval needed.</p>
                    </div>
                  </label>
                  <label
                    className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer trivara-transition ${!formData.instantBook ? 'bg-accent' : 'bg-card hover:bg-surface-3'}`}
                  >
                    <input
                      type="radio"
                      name="instantBook"
                      checked={!formData.instantBook}
                      onChange={() => updateForm({ instantBook: false })}
                      className="mt-1"
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

      case 'review':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-pillar font-bold uppercase tracking-wide mb-2">Review your listing draft</h2>
              <p className="text-text-secondary">Make sure everything looks good before saving as draft</p>
            </div>
            <div className="bg-card rounded-xl overflow-hidden">
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
                <p className="text-lg font-semibold">{formatINR(formData.pricePerNight)}/night</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">

      <div className="container py-8">
        {/* Loading state for edit mode */}
        {isEditMode && isLoading && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card rounded-xl p-8 text-center border border-border">
              <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mb-4" />
              <p className="text-foreground">Loading listing data...</p>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-8 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            {STEPS.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => idx <= currentStep && setCurrentStep(idx)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm trivara-transition ${idx === currentStep
                  ? 'bg-accent text-accent-foreground'
                  : idx < currentStep
                    ? 'bg-surface-3 text-foreground cursor-pointer hover:bg-surface-4'
                    : 'bg-surface-2 text-text-secondary cursor-not-allowed'
                  }`}
                disabled={idx > currentStep || (isEditMode && isLoading)}
              >
                <step.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-4xl mx-auto mb-8">
          {isEditMode && isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mb-4" />
              <p className="text-text-secondary">Loading listing data...</p>
            </div>
          ) : (
            renderStepContent()
          )}
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-surface-0 border-t border-border p-4">
          <div className="container flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={currentStep === 0 || (isEditMode && isLoading)}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            {currentStep === STEPS.length - 1 ? (
              <Button
                className="trivara-btn-primary gap-2"
                onClick={handleSubmit}
                disabled={isSubmitting || (isEditMode && isLoading) || (isEditMode && !initialLoadComplete) || formData.photos.length === 0}
              >
                {isSubmitting ? (
                  isEditMode ? 'Saving changes...' : 'Saving draft...'
                ) : (
                  <>
                    {isEditMode ? 'Save changes' : 'Save as draft'}
                    {formData.photos.length === 0 && !isEditMode && (
                      <span className="ml-2 text-xs">(Add photos to save draft)</span>
                    )}
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="trivara-btn-primary gap-2"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed() || (isEditMode && isLoading)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
