import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { SEO } from '@/components/SEO';
import { HeroPlanner } from '@/components/home/HeroPlanner';
import { ExploreSection } from '@/components/home/ExploreSection';
import { DestinationPanels } from '@/components/home/DestinationPanels';
import { CalmPeak, EaseLine, HeroScene, HostScene, SunsetClose, TideSeam } from '@/components/home/Tide';
import { EditableText } from '@/components/content/EditableText';
import { listingService } from '@/services/listingService';
import { siteSettingsService } from '@/services/siteSettingsService';
import { INITIAL_HOME_SEARCH, HomeSearchState, buildSearchFilters, buildSearchParams } from '@/lib/homeSearch';
import { useReveal } from '@/hooks/useReveal';
import { formatINR } from '@/lib/utils';
import { Listing } from '@/types';

type Destination = Awaited<ReturnType<typeof listingService.getPopularDestinations>>[number];

// Mirrors the mock's own locked page margin (--page-margin: clamp(20px, 4vw,
// 48px)) instead of Tailwind's default .container gutter (2rem fixed,
// capped at 1400px) - used on every section below so the side spacing stays
// identical from the hero header down through the footer.
const SIDE_PAD = 'px-[clamp(20px,4vw,48px)]';

const FEATURED_COUNT = 5;
const EXPLORE_PAGE_SIZE = 20;

export default function Index() {
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [hostCtaImage, setHostCtaImage] = useState<string | null>(null);
  const [collectionSlots, setCollectionSlots] = useState<{ image: string | null; link: string | null }[]>([]);
  const [banner75, setBanner75] = useState<{ image: string | null; link: string | null }>({ image: null, link: null });
  const [bannerHero, setBannerHero] = useState<{ image: string | null; link: string | null }>({ image: null, link: null });
  const [dataReady, setDataReady] = useState(false);
  const [search, setSearch] = useState<HomeSearchState>(INITIAL_HOME_SEARCH);

  const patchSearch = useCallback((patch: Partial<HomeSearchState>) => {
    setSearch((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // The hero is fully illustrated now, so the admin hero photo and the
        // two overlay settings are no longer read here.
        const [featured, popularDestinations, hostBackground, collections, banner75Data, bannerHeroData] = await Promise.all([
          listingService.getFeatured(FEATURED_COUNT),
          listingService.getPopularDestinations(),
          siteSettingsService.getHostCtaBackgroundImageUrl(),
          Promise.all([1, 2, 3].map(async (slot) => ({
            image: await siteSettingsService.getHomepageCollectionImageUrl(slot),
            link: await siteSettingsService.getHomepageCollectionLinkUrl(slot),
          }))),
          Promise.all([siteSettingsService.getHomepage75BannerImageUrl(), siteSettingsService.getHomepage75BannerLinkUrl()]),
          Promise.all([siteSettingsService.getHomepageHeroBannerImageUrl(), siteSettingsService.getHomepageHeroBannerLinkUrl()]),
        ]);
        setFeaturedListings(featured);
        setDestinations(popularDestinations);
        setHostCtaImage(hostBackground);
        setCollectionSlots(collections);
        setBanner75({ image: banner75Data[0], link: banner75Data[1] });
        setBannerHero({ image: bannerHeroData[0], link: bannerHeroData[1] });
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setDataReady(true);
      }
    };

    fetchData();
  }, []);

  // Live results for the planner + controls (no search button - every
  // change re-queries). Same service the /search page uses, so the two can
  // never disagree about what matches.
  const filters = useMemo(() => buildSearchFilters(search), [search]);
  const searchQuery = useQuery({
    queryKey: ['home-search', filters],
    queryFn: () => listingService.searchListings(filters, 1, EXPLORE_PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
  const results = searchQuery.data?.listings ?? [];
  const resultTotal = searchQuery.data?.total ?? null;
  const resultsQueryString = useMemo(() => buildSearchParams(search), [search]);

  useReveal([dataReady, featuredListings.length, destinations.length, results.length]);


  const moreFeatured = featuredListings.slice(3);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Trivara"
        description="Trivara handpicks extraordinary vacation rentals and short-term stays around the world."
        path="/"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Trivara',
          url: typeof window !== 'undefined' ? window.location.origin : undefined,
        }}
      />

      {/* 1. Ease: a coast road, the van idling, the planner already open.
          The common <Header /> reserves 5rem above; the scene pulls itself
          up under it (-mt-20 inside HeroScene). */}
      <HeroScene>
        <div className={`grid w-full items-start gap-10 ${SIDE_PAD} lg:grid-cols-[1.1fr_.9fr] lg:gap-14`}>
          <div className="pt-4 lg:pt-10">
            <h1 className="animate-fade-in text-[clamp(3rem,7.2vw,6.75rem)] font-semibold leading-[0.92]">
              <EditableText settingKey="content_hero_title_a" fallback="Get away" as="span" />{' '}
              <EditableText settingKey="content_hero_title_b" fallback="this weekend." as="span" />
            </h1>
            <EditableText
              settingKey="content_hero_subtitle"
              fallback="Homestays, river camps and beach huts across Karnataka, run by people who live there. The price you see includes every fee."
              as="p"
              className="mt-6 max-w-[40ch] animate-fade-in text-lg text-text-secondary"
              style={{ animationDelay: '0.1s' }}
            />
          </div>

          <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <HeroPlanner state={search} onChange={patchSearch} resultCount={resultTotal} />
          </div>
        </div>
      </HeroScene>

      <TideSeam className="-mt-[72px] text-background" />

      {/* 2. Fun: three small moves drawn on one wave. */}
      <EaseLine />

      <TideSeam className="-mt-[72px] text-[hsl(var(--sky-low))]" options={{ offset: 1.7, cycles: 2 }} />

      {/* 3. Peak: the sea goes still. The only pinned stage on the page. */}
      <CalmPeak
        title={<EditableText settingKey="content_peak_title" fallback="A few of our favourites right now" as="span" />}
        postcards={featuredListings}
      />

      <TideSeam className="-mt-[72px] text-background" options={{ offset: 3.2, cycles: 3 }} />

      {/* Featured stays - admin-curated (is_featured, capped by
          featured_stays_max_slots). The first three are the postcards in
          the calm section above; this grid holds the rest, if any. */}
      <section id="featured" className={`scroll-mt-24 pt-12 ${moreFeatured.length ? 'pb-20 md:pb-28' : 'pb-4'}`}>
        <div className={`w-full ${SIDE_PAD}`}>
          {moreFeatured.length > 0 && (
            <EditableText
              settingKey="content_featured_heading"
              fallback="More stays we like"
              as="h2"
              className="rv mb-10 text-[clamp(2rem,4.2vw,3.5rem)] font-semibold leading-[0.95]"
            />
          )}

          {moreFeatured.length > 0 && (
            <ul className="border-t border-foreground/15">
              {moreFeatured.map((listing) => (
                <li key={listing.id} className="rv border-b border-foreground/15">
                  <Link
                    to={`/listing/${listing.id}`}
                    className="group grid grid-cols-[72px_1fr_auto] items-center gap-4 py-4 sm:grid-cols-[120px_1.4fr_1fr_auto] sm:gap-8 sm:py-5"
                  >
                    <img
                      src={listing.photos[0]}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-[6px] border-2 border-foreground object-cover"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-display text-xl font-semibold leading-tight transition-colors group-hover:text-text-secondary sm:text-[1.75rem]">
                        {listing.title}
                      </span>
                      <span className="mt-1 block text-sm text-text-secondary sm:hidden">{listing.location.city}</span>
                    </span>
                    <span className="hidden text-text-secondary sm:block">
                      {listing.location.city}
                      {listing.rating > 0 && <> · ★ {listing.rating.toFixed(1)}</>}
                    </span>
                    <span className="text-right font-ui font-semibold tabular-nums">
                      {formatINR(listing.pricePerNight)}
                      <span className="block text-xs font-normal text-text-meta">a night</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 4. Curiosity: places, nothing explained, just names. */}
      {destinations.length > 0 && (
        <section id="destinations" className="scroll-mt-24 pb-20 md:pb-28">
          <div className={`w-full ${SIDE_PAD}`}>
            <EditableText
              settingKey="content_destinations_heading"
              fallback="Where people are going"
              as="h2"
              className="rv mb-8 text-[clamp(2.4rem,5.4vw,4.75rem)] font-semibold leading-[0.95]"
            />
            <div className="rv">
              <DestinationPanels
                destinations={destinations}
                activeCity={search.location}
                onSelect={(city) => {
                  patchSearch({ location: city });
                  if (city) document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* 5. Control: every stay, live, on the map. */}
      <section id="explore" className="scroll-mt-24 pb-20 md:pb-28">
        <div className={`w-full ${SIDE_PAD}`}>
          <div className="rv mb-8 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-[clamp(2.4rem,5.4vw,4.75rem)] font-semibold leading-[0.95]">
              Every stay, <span className="text-text-secondary">on the map.</span>
            </h2>
            <span className="label-tech text-text-meta">
              {resultTotal === null ? '…' : resultTotal} {resultTotal === 1 ? 'stay' : 'stays'}
            </span>
          </div>
          <ExploreSection
            state={search}
            onChange={patchSearch}
            listings={results}
            total={resultTotal ?? 0}
            loading={searchQuery.isPending}
            searchQuery={resultsQueryString}
          />
        </div>
      </section>

      {/* 6. Warmth: hosts, addressed like neighbours. Copy trails, picture leads. */}
      <section className="pb-24 md:pb-32">
        <div className={`grid w-full items-center gap-10 ${SIDE_PAD} md:grid-cols-[.9fr_1.1fr] md:gap-16`}>
          <div className="rv md:order-2">
            <HostScene photo={hostCtaImage} />
          </div>
          <div className="rv md:order-1">
            <EditableText
              settingKey="content_host_heading"
              fallback="Got a spare room and a good view?"
              as="h2"
              className="text-[clamp(2.2rem,4.6vw,4rem)] font-semibold leading-[0.95]"
            />
            <EditableText
              settingKey="content_host_subtitle"
              fallback="Share it on your terms. Set prices by the date, block the days you want back, and follow every payout."
              as="p"
              className="mt-5 max-w-[42ch] text-lg text-text-secondary"
            />
            <Link
              to="/host"
              className="btn-hard mt-8 inline-flex rounded-full bg-card px-7 py-3.5 font-ui text-sm font-bold text-foreground"
            >
              <EditableText settingKey="content_host_button" fallback="Start hosting" as="span" />
            </Link>
          </div>
        </div>
      </section>

      {/* Admin-configurable image slots (Admin Settings > Branding). Each
          renders only when an image is set. */}
      {banner75.image && (
        <div className={`w-full pb-20 ${SIDE_PAD}`}>
          {banner75.link ? (
            <a href={banner75.link} className="block h-[60vh] overflow-hidden rounded-[var(--radius)] border-2 border-foreground">
              <img src={banner75.image} alt="" loading="lazy" className="h-full w-full object-cover" />
            </a>
          ) : (
            <div className="h-[60vh] overflow-hidden rounded-[var(--radius)] border-2 border-foreground">
              <img src={banner75.image} alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
          )}
        </div>
      )}

      {collectionSlots.some((slot) => slot.image) && (
        <section className="pb-20">
          <div className={`w-full ${SIDE_PAD}`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {collectionSlots
                .filter((slot): slot is { image: string; link: string | null } => !!slot.image)
                .map((slot, i) => {
                  const tile = (
                    <div className="nu group relative aspect-[3/4] overflow-hidden bg-surface-2">
                      <img src={slot.image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    </div>
                  );
                  return slot.link ? (
                    <a key={i} href={slot.link} className="block">{tile}</a>
                  ) : (
                    <div key={i}>{tile}</div>
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {bannerHero.image && (
        <div className={`w-full pb-20 ${SIDE_PAD}`}>
          {bannerHero.link ? (
            <a href={bannerHero.link} className="block h-[80vh] overflow-hidden rounded-[var(--radius)] border-2 border-foreground">
              <img src={bannerHero.image} alt="" loading="lazy" className="h-full w-full object-cover" />
            </a>
          ) : (
            <div className="h-[80vh] overflow-hidden rounded-[var(--radius)] border-2 border-foreground">
              <img src={bannerHero.image} alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
          )}
        </div>
      )}

      <TideSeam className="-mt-[72px] text-[hsl(36_80%_86%)]" options={{ offset: 0.6, cycles: 1.5 }} />

      {/* 7. Resolve: the sea is still again. One line, one link. */}
      <SunsetClose
        line={<EditableText settingKey="content_close_line" fallback="Still deciding? Have a look around." as="span" />}
        cta={{ to: '/search', label: 'Browse all stays' }}
      />
    </div>
  );
}
