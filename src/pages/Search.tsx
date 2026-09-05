import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, Search as SearchIcon, Loader2, Crown } from 'lucide-react';
import { SearchBar } from '@/components/search/SearchBar';
import { GuestCounts } from '@/components/search/DateGuestsFields';
import { ListingCard } from '@/components/listings/ListingCard';
import { ListingsMap } from '@/components/search/ListingsMap';
import { listingService } from '@/services/listingService';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays } from 'date-fns';
import { SearchFilters, SearchResult, CancellationPolicy, PropertyType, Listing, SearchSort } from '@/types';
import { formatINR } from '@/lib/utils';
import { amenitiesList, accessibilityList } from '@/data/amenities';

// Simple Skeleton for Carousels
const CarouselSkeleton = () => (
  <div className="flex gap-4 overflow-hidden pb-4">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="min-w-[280px] w-[280px] flex-shrink-0 animate-pulse">
        <div className="aspect-[4/3] bg-surface-2 rounded-xl mb-3"></div>
        <div className="h-4 bg-surface-2 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-surface-2 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-surface-2 rounded w-1/4"></div>
      </div>
    ))}
  </div>
);

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [highlightedListingId, setHighlightedListingId] = useState<string | null>(null);
  const listingRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // The URL only ever stores a combined `guests` total (no adults/children
  // split), so on first load we can only best-effort restore it as all
  // adults - same limitation the old hero search bar's guest picker had.
  const [adults, setAdults] = useState(() => parseInt(searchParams.get('guests') || '1') || 1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(() => parseInt(searchParams.get('infants') || '0') || 0);
  const [pets, setPets] = useState(() => parseInt(searchParams.get('pets') || '0') || 0);

  // Sync state from URL
  const getParam = useCallback((key: string) => searchParams.get(key), [searchParams]);
  const getArrayParam = (key: string) => getParam(key)?.split(',').filter(Boolean) || [];

  const priceRange: [number, number] = useMemo(() => [
    parseInt(getParam('minPrice') || '0'),
    parseInt(getParam('maxPrice') || '30000')
  ], [getParam]);

  const selectedPropertyTypes = getArrayParam('propertyTypes') as PropertyType[];
  const selectedAmenities = getArrayParam('amenities');
  const minRating = parseFloat(getParam('minRating') || '0');
  const selectedCancellationPolicies = getArrayParam('cancellationPolicy') as CancellationPolicy[];
  const sort = (getParam('sort') || 'recommended') as SearchSort;
  const flexibleDays = parseInt(getParam('flexibleDays') || '0');
  const page = parseInt(getParam('page') || '1');

  // Update URL function(s). Two back-to-back setSearchParams(prev => ...)
  // calls in the same tick don't reliably compose - react-router's setter
  // isn't a plain useState setter, and the second call's `prev` can still
  // reflect the state from before the first call landed, silently losing
  // it. This is exactly what made the price-range slider only ever move
  // its max handle: onValueChange called updateFilter('minPrice', ...)
  // immediately followed by updateFilter('maxPrice', ...), and the second
  // call clobbered the first. updateFilters applies every key in one
  // setSearchParams call instead.
  const updateFilters = useCallback((updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '' || value === '0') {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      }
      if (!('page' in updates)) newParams.delete('page');
      return newParams;
    });
  }, [setSearchParams]);

  const updateFilter = useCallback((key: string, value: string | null) => {
    updateFilters({ [key]: value });
  }, [updateFilters]);

  const updateArrayFilter = useCallback((key: string, values: string[]) => {
    updateFilter(key, values.length > 0 ? values.join(',') : null);
  }, [updateFilter]);

  const filters: SearchFilters = useMemo(() => ({
    location: getParam('location') || undefined,
    guests: getParam('guests') ? parseInt(getParam('guests')!) : undefined,
    checkIn: getParam('checkIn') ? new Date(getParam('checkIn')!) : undefined,
    checkOut: getParam('checkOut') ? new Date(getParam('checkOut')!) : undefined,
    flexibleDays: flexibleDays > 0 ? flexibleDays : undefined,
    minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
    maxPrice: priceRange[1] < 30000 ? priceRange[1] : undefined,
    propertyTypes: selectedPropertyTypes.length > 0 ? selectedPropertyTypes : undefined,
    amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
    minRating: minRating > 0 ? minRating : undefined,
    cancellationPolicy: selectedCancellationPolicies.length > 0 ? selectedCancellationPolicies : undefined,
    sort: sort !== 'recommended' ? sort : undefined,
  }), [
    getParam,
    priceRange,
    selectedPropertyTypes,
    selectedAmenities,
    minRating,
    selectedCancellationPolicies,
    flexibleDays,
    sort,
  ]);

  // Determine if user has actively searched or is just "exploring"
  const isExploring = !filters.location && !filters.checkIn && !filters.guests;

  const carouselsQuery = useQuery({
    queryKey: ['explore-carousels'],
    queryFn: async () => {
      const [featured, popular] = await Promise.all([
        listingService.getFeatured(8),
        listingService.getPopularListings(8)
      ]);
      return { featured, popular };
    },
    enabled: isExploring,
  });

  const featuredStays = carouselsQuery.data?.featured ?? [];
  const popularStays = carouselsQuery.data?.popular ?? [];
  const loadingCarousels = isExploring && carouselsQuery.isPending;

  const emptySearchResult: SearchResult = { listings: [], total: 0, page: 1, pageSize: 20 };

  const searchQuery = useQuery({
    queryKey: ['search-listings', filters, page],
    queryFn: () => listingService.searchListings(filters, page, 20), // 20 per page
  });

  const searchResults = searchQuery.data ?? emptySearchResult;
  const loading = searchQuery.isPending || searchQuery.isFetching;

  if (searchQuery.error) {
    console.error('Search error:', searchQuery.error);
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [filters, page]);

  const locationDisplay = getParam('location') || (isExploring ? 'Explore all destinations' : 'All destinations');

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
    setAdults(1);
    setChildren(0);
    setInfants(0);
    setPets(0);
  };

  const activeFilterCount = [
    priceRange[0] > 0 || priceRange[1] < 30000,
    selectedPropertyTypes.length > 0,
    selectedAmenities.length > 0,
    minRating > 0,
    selectedCancellationPolicies.length > 0,
    !!filters.checkIn && !!filters.checkOut,
    adults > 1 || children > 0 || infants > 0 || pets > 0,
  ].filter(Boolean).length;

  const propertyTypeOptions: { value: PropertyType; label: string }[] = [
    { value: 'entire_place', label: 'Entire place' },
    { value: 'private_room', label: 'Private room' },
    { value: 'shared_room', label: 'Shared room' },
    { value: 'hotel_room', label: 'Hotel room' },
  ];

  const cancellationOptions: { value: CancellationPolicy; label: string }[] = [
    { value: 'flexible', label: 'Flexible' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'strict', label: 'Strict' },
  ];

  return (
    <div className="min-h-screen bg-background pb-12">

      {/* Sticky Search Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-surface-0 shadow-sm transition-all duration-300">
        <div className="container py-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 w-full max-w-3xl">
              <SearchBar
                variant="compact"
                controlled={{
                  location: getParam('location') || '',
                  checkIn: filters.checkIn,
                  checkOut: filters.checkOut,
                  guests: { adults, children, infants, pets },
                  onLocationChange: (value) => updateFilter('location', value || null),
                  onCheckInChange: (date) => {
                    const updates: Record<string, string | null> = { checkIn: date ? date.toISOString() : null };
                    if (date && (!filters.checkOut || filters.checkOut <= date)) {
                      updates.checkOut = addDays(date, 1).toISOString();
                    }
                    updateFilters(updates);
                  },
                  onCheckOutChange: (date) => updateFilters({ checkOut: date ? date.toISOString() : null }),
                  onGuestsChange: (g: GuestCounts) => {
                    setAdults(g.adults);
                    setChildren(g.children);
                    setInfants(g.infants);
                    setPets(g.pets);
                    updateFilters({
                      guests: (g.adults + g.children).toString(),
                      infants: g.infants > 0 ? g.infants.toString() : null,
                      pets: g.pets > 0 ? g.pets.toString() : null,
                    });
                  },
                }}
              />
            </div>

            <div className="flex w-full md:w-auto items-center justify-between md:justify-end gap-2">
              {/* Sort */}
              <Select
                value={sort}
                onValueChange={(value) => updateFilter('sort', value === 'recommended' ? null : value)}
              >
                <SelectTrigger className="w-auto gap-2 border-none bg-transparent shadow-none hover:bg-surface-2">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="price_asc">Price: low to high</SelectItem>
                  <SelectItem value="price_desc">Price: high to low</SelectItem>
                  <SelectItem value="rating">Top rated</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                </SelectContent>
              </Select>

              {/* Filters Button */}
              <Sheet open={showFilters} onOpenChange={setShowFilters}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="gap-2 hover:bg-surface-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="h-5 w-5 rounded-full bg-foreground text-background text-xs flex items-center justify-center font-medium">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md bg-surface-0 overflow-y-auto">
                  <SheetHeader className="mb-6">
                    <SheetTitle className="flex items-center justify-between">
                      Filters
                      {activeFilterCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => {
                          clearFilters();
                          setShowFilters(false);
                        }}>
                          Clear all
                        </Button>
                      )}
                    </SheetTitle>
                  </SheetHeader>

                  <div className="space-y-8">
                    {/* Dates and guest count now live in the search bar itself
                        (DateGuestsFields, shared with the homepage hero) -
                        this sheet only holds the filters that don't fit there. */}

                    {/* Flexible dates - only meaningful once exact dates are picked */}
                    {filters.checkIn && filters.checkOut && (
                      <div>
                        <h4 className="font-medium mb-4">Dates</h4>
                        <div className="flex gap-2">
                          {[
                            { value: 0, label: 'Exact dates' },
                            { value: 3, label: '± 3 days' },
                            { value: 7, label: '± 7 days' },
                          ].map((opt) => (
                            <Button
                              key={opt.value}
                              variant={flexibleDays === opt.value ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateFilter('flexibleDays', opt.value === 0 ? null : opt.value.toString())}
                              className={flexibleDays === opt.value ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                            >
                              {opt.label}
                            </Button>
                          ))}
                        </div>
                        {flexibleDays > 0 && (
                          <p className="text-xs text-text-meta mt-2">
                            Showing stays with room for your dates within {flexibleDays} days either side.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Price Range */}
                    <div>
                      <h4 className="font-medium mb-4">Price range</h4>
                      <Slider
                        value={priceRange}
                        onValueChange={(value) => {
                          updateFilters({
                            minPrice: value[0] === 0 ? null : value[0].toString(),
                            maxPrice: value[1] === 30000 ? null : value[1].toString(),
                          });
                        }}
                        min={0}
                        max={30000}
                        step={500}
                        className="mb-4"
                      />
                      <div className="flex items-center justify-between text-sm text-text-secondary">
                        <span>{formatINR(priceRange[0])}</span>
                        <span>{priceRange[1] >= 30000 ? `${formatINR(30000)}+` : formatINR(priceRange[1])}</span>
                      </div>
                    </div>

                    {/* Property Type */}
                    <div>
                      <h4 className="font-medium mb-4">Property type</h4>
                      <div className="space-y-3">
                        {propertyTypeOptions.map((type) => (
                          <label key={type.value} className="flex items-center gap-3 cursor-pointer group">
                            <Checkbox
                              checked={selectedPropertyTypes.includes(type.value)}
                              onCheckedChange={(checked) => {
                                const newTypes = checked
                                  ? [...selectedPropertyTypes, type.value]
                                  : selectedPropertyTypes.filter(t => t !== type.value);
                                updateArrayFilter('propertyTypes', newTypes);
                              }}
                            />
                            <span className="text-sm group-hover:text-foreground transition-colors">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Minimum Rating */}
                    <div>
                      <h4 className="font-medium mb-4">Minimum rating</h4>
                      <div className="flex gap-2">
                        {[0, 4.0, 4.5, 4.8].map((rating) => (
                          <Button
                            key={rating}
                            variant={minRating === rating ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateFilter('minRating', rating === 0 ? null : rating.toString())}
                            className={minRating === rating ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
                          >
                            {rating === 0 ? 'Any' : `${rating}+`}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Cancellation Policy */}
                    <div>
                      <h4 className="font-medium mb-4">Cancellation policy</h4>
                      <div className="space-y-3">
                        {cancellationOptions.map((policy) => (
                          <label key={policy.value} className="flex items-center gap-3 cursor-pointer group">
                            <Checkbox
                              checked={selectedCancellationPolicies.includes(policy.value)}
                              onCheckedChange={(checked) => {
                                const newPolicies = checked
                                  ? [...selectedCancellationPolicies, policy.value]
                                  : selectedCancellationPolicies.filter(p => p !== policy.value);
                                updateArrayFilter('cancellationPolicy', newPolicies);
                              }}
                            />
                            <span className="text-sm group-hover:text-foreground transition-colors">{policy.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Amenities */}
                    <div>
                      <h4 className="font-medium mb-4">Amenities</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {amenitiesList.map((amenity) => (
                          <label key={amenity.id} className="flex items-center gap-3 cursor-pointer group">
                            <Checkbox
                              checked={selectedAmenities.includes(amenity.id)}
                              onCheckedChange={(checked) => {
                                const newAm = checked
                                  ? [...selectedAmenities, amenity.id]
                                  : selectedAmenities.filter(a => a !== amenity.id);
                                updateArrayFilter('amenities', newAm);
                              }}
                            />
                            <span className="text-sm truncate group-hover:text-foreground transition-colors">{amenity.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Accessibility */}
                    <div>
                      <h4 className="font-medium mb-4">Accessibility</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {accessibilityList.map((feature) => (
                          <label key={feature.id} className="flex items-center gap-3 cursor-pointer group">
                            <Checkbox
                              checked={selectedAmenities.includes(feature.id)}
                              onCheckedChange={(checked) => {
                                const newAm = checked
                                  ? [...selectedAmenities, feature.id]
                                  : selectedAmenities.filter(a => a !== feature.id);
                                updateArrayFilter('amenities', newAm);
                              }}
                            />
                            <span className="text-sm truncate group-hover:text-foreground transition-colors">{feature.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="sticky bottom-0 pt-6 pb-4 bg-surface-0 border-t border-border mt-8">
                    <Button
                      className="w-full bg-foreground text-background hover:bg-foreground/90"
                      onClick={() => setShowFilters(false)}
                    >
                      Show {searchResults.total} {searchResults.total === 1 ? 'result' : 'results'}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-12">
        {/* EXPLORE SECTIONS (Only show if no active query constraints) */}
        {isExploring && (
          <div className="space-y-12">
            {/* Section A: Featured Stays */}
            <section>
              <h2 className="text-2xl font-display font-medium mb-1">Featured Stays</h2>
              <p className="text-text-secondary mb-6">Handpicked premium properties with exceptional ratings.</p>

              {loadingCarousels ? (
                <CarouselSkeleton />
              ) : featuredStays.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                  {featuredStays.map(listing => (
                    <div key={`featured-${listing.id}`} className="min-w-[280px] w-[280px] md:min-w-[320px] md:w-[320px] flex-shrink-0 snap-start">
                      <ListingCard listing={listing} />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            {/* Section B: Popular Stays */}
            <section>
              <h2 className="text-2xl font-display font-medium mb-1">Popular right now</h2>
              <p className="text-text-secondary mb-6">The most booked and reviewed destinations this week.</p>

              {loadingCarousels ? (
                <CarouselSkeleton />
              ) : popularStays.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                  {popularStays.map((listing, idx) => (
                    <div key={`popular-${listing.id}`} className="relative min-w-[280px] w-[280px] md:min-w-[320px] md:w-[320px] flex-shrink-0 snap-start">
                      {idx < 3 && (
                        <div
                          className={`absolute top-2 left-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background shadow ${
                            idx === 0 ? 'bg-yellow-400 text-yellow-950' : idx === 1 ? 'bg-slate-300 text-slate-800' : 'bg-amber-600 text-amber-50'
                          }`}
                          title={`#${idx + 1} most booked`}
                        >
                          <Crown className="h-4 w-4" fill="currentColor" />
                        </div>
                      )}
                      <ListingCard listing={listing} />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <hr className="border-border" />
          </div>
        )}

        {/* Section C: All Results */}
        <section>
          {/* Results Header */}
          <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-medium mb-1">{locationDisplay}</h1>
              {!loading && (
                <p className="text-text-secondary">
                  {searchResults.total > 200 ? '200+' : searchResults.total} {searchResults.total === 1 ? 'stay' : 'stays'} available
                </p>
              )}
            </div>
          </div>

          {/* Empty State / Error Layout */}
          {!loading && searchResults.listings.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-surface-1 rounded-2xl border border-border/50">
              <div className="h-16 w-16 bg-surface-2 rounded-full flex items-center justify-center mb-6">
                <SearchIcon className="h-8 w-8 text-text-tertiary" />
              </div>
              <h3 className="text-xl font-medium mb-2">No exact matches found</h3>
              <p className="text-text-secondary max-w-md mb-8">
                Try changing or removing some of your filters or adjusting your search area.
              </p>
              <Button onClick={clearFilters} className="bg-foreground text-background hover:bg-foreground/90">
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Listings Sidebar */}
              <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-hide pr-2">
                {loading ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl border border-border animate-pulse">
                      <div className="w-48 h-32 bg-surface-2 rounded-lg flex-shrink-0"></div>
                      <div className="flex-1 space-y-3 py-2">
                        <div className="h-4 bg-surface-2 rounded w-1/3"></div>
                        <div className="h-5 bg-surface-2 rounded w-3/4"></div>
                        <div className="h-4 bg-surface-2 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))
                ) : searchResults.listings.map((listing: Listing) => (
                  <div
                    key={listing.id}
                    ref={(el) => { listingRowRefs.current[listing.id] = el; }}
                    onMouseEnter={() => setHighlightedListingId(listing.id)}
                    onMouseLeave={() => setHighlightedListingId(null)}
                    className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border transition-all group ${
                      listing.id === highlightedListingId
                        ? 'border-foreground bg-surface-1 shadow-sm'
                        : 'border-transparent hover:border-border hover:bg-surface-1'
                    }`}
                  >
                    <div className="w-full sm:w-48 h-48 sm:h-32 rounded-lg overflow-hidden flex-shrink-0 relative">
                      <img
                        src={listing.photos[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <p className="text-xs text-text-meta mb-1 capitalize">
                          {listing.propertyType.replace('_', ' ')} · {listing.location.city}
                        </p>
                        <h3 className="font-medium line-clamp-1 mb-1">{listing.title}</h3>
                        <p className="text-sm text-text-secondary line-clamp-1 mb-2">
                          {listing.bedrooms} bed{listing.bedrooms > 1 ? 's' : ''} · {listing.bathrooms} bath{listing.bathrooms > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                        <span className="text-sm">
                          <span className="font-semibold">{formatINR(listing.pricePerNight)}</span> night
                        </span>
                        <span className="text-sm font-medium flex items-center gap-1">
                          ★ {listing.rating.toFixed(2)} <span className="text-text-tertiary font-normal">({listing.reviewCount})</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Map */}
              <div className="hidden lg:block sticky top-36 h-[calc(100vh-200px)] rounded-xl bg-surface-1 border border-border overflow-hidden">
                {loading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
                  </div>
                ) : (
                  <ListingsMap
                    listings={searchResults.listings}
                    highlightedListingId={highlightedListingId}
                    onMarkerHover={setHighlightedListingId}
                    onMarkerClick={(id) => {
                      setHighlightedListingId(id);
                      listingRowRefs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Simple Pagination Footer */}
          {!loading && searchResults.total > searchResults.pageSize && (
            <div className="mt-12 flex justify-center items-center gap-4 border-t border-border pt-8">
              <Button
                variant="outline"
                onClick={() => updateFilter('page', (page - 1).toString())}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm font-medium">
                Page {page} of {Math.ceil(searchResults.total / searchResults.pageSize)}
              </span>
              <Button
                variant="outline"
                onClick={() => updateFilter('page', (page + 1).toString())}
                disabled={page >= Math.ceil(searchResults.total / searchResults.pageSize)}
              >
                Next
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
