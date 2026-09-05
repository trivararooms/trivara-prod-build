import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Home, MapPin, Image, Sparkles, DollarSign,
  CalendarDays, ClipboardList, FileCheck, ChevronRight, ChevronLeft,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listingService } from '@/services/listingService';
import { PropertyType, CancellationPolicy } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/lib/errors';
import { FIXED_COUNTRY, FIXED_STATE } from '@/data/karnatakaLocations';
import { geocodeAddress, FALLBACK_COORDINATES } from '@/lib/geocode';
import { ListingFormData } from './create-listing-steps/types';
import { PropertyTypeStep } from './create-listing-steps/PropertyTypeStep';
import { LocationStep } from './create-listing-steps/LocationStep';
import { PhotosStep } from './create-listing-steps/PhotosStep';
import { DetailsStep } from './create-listing-steps/DetailsStep';
import { AmenitiesStep } from './create-listing-steps/AmenitiesStep';
import { PricingStep } from './create-listing-steps/PricingStep';
import { AvailabilityStep } from './create-listing-steps/AvailabilityStep';
import { RulesStep } from './create-listing-steps/RulesStep';
import { ReviewStep } from './create-listing-steps/ReviewStep';

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
            // Draft autosave fires on every debounced keystroke, so it
            // deliberately doesn't geocode (that only happens once, in
            // handleSubmit, on an actual publish/update click) - this
            // placeholder is overwritten with the real coordinates then.
            ...FALLBACK_COORDINATES,
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

      // Real geocoding, not the SF placeholder - only done here (on an
      // actual publish/update click), not in the debounced draft autosave
      // above, so typing in an unrelated field never fires a network
      // request against Nominatim's rate-limited public API.
      const coords = (await geocodeAddress({
        address: formData.address,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        postalCode: formData.postalCode,
      })) ?? FALLBACK_COORDINATES;

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
            lat: coords.lat,
            lng: coords.lng,
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
            lat: coords.lat,
            lng: coords.lng,
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
        return <PropertyTypeStep formData={formData} updateForm={updateForm} />;

      case 'location':
        return <LocationStep formData={formData} updateForm={updateForm} />;

      case 'photos':
        return (
          <PhotosStep
            formData={formData}
            fileInputRef={fileInputRef}
            onAddPhotos={handleAddPhotos}
            onFileChange={handleFileChange}
            onRemovePhoto={removePhoto}
          />
        );

      case 'details':
        return <DetailsStep formData={formData} updateForm={updateForm} />;

      case 'amenities':
        return <AmenitiesStep formData={formData} updateForm={updateForm} />;

      case 'pricing':
        return <PricingStep formData={formData} updateForm={updateForm} />;

      case 'availability':
        return <AvailabilityStep />;

      case 'rules':
        return <RulesStep formData={formData} updateForm={updateForm} />;

      case 'review':
        return <ReviewStep formData={formData} />;

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
            <div className="bg-card rounded-lg p-8 text-center border border-border">
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
