import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { SEO } from '@/components/SEO';
import { HeroPlanner } from '@/components/home/HeroPlanner';
import { ExploreSection } from '@/components/home/ExploreSection';
import { DestinationPanels } from '@/components/home/DestinationPanels';
import { InstrumentsBento } from '@/components/home/InstrumentsBento';
import { FeaturedListingCard } from '@/components/listings/FeaturedListingCard';
import { EditableText } from '@/components/content/EditableText';
import { listingService } from '@/services/listingService';
import { siteSettingsService } from '@/services/siteSettingsService';
import { generatedArtUrl } from '@/lib/generatedArt';
import { INITIAL_HOME_SEARCH, HomeSearchState, buildSearchFilters, buildSearchParams } from '@/lib/homeSearch';
import { useReveal } from '@/hooks/useReveal';
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
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [heroOverlay, setHeroOverlay] = useState(35);
  const [hostCtaImage, setHostCtaImage] = useState<string | null>(null);
  const [hostCtaOverlay, setHostCtaOverlay] = useState(40);
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
        const [featured, popularDestinations, heroBackground, hostBackground, heroOverlaySetting, hostCtaOverlaySetting, collections, banner75Data, bannerHeroData] = await Promise.all([
          listingService.getFeatured(FEATURED_COUNT),
          listingService.getPopularDestinations(),
          siteSettingsService.getHeroBackgroundImageUrl(),
          siteSettingsService.getHostCtaBackgroundImageUrl(),
          siteSettingsService.getAppSetting('hero_overlay_opacity'),
          siteSettingsService.getAppSetting('host_cta_overlay_opacity'),
          Promise.all([1, 2, 3].map(async (slot) => ({
            image: await siteSettingsService.getHomepageCollectionImageUrl(slot),
            link: await siteSettingsService.getHomepageCollectionLinkUrl(slot),
          }))),
          Promise.all([siteSettingsService.getHomepage75BannerImageUrl(), siteSettingsService.getHomepage75BannerLinkUrl()]),
          Promise.all([siteSettingsService.getHomepageHeroBannerImageUrl(), siteSettingsService.getHomepageHeroBannerLinkUrl()]),
        ]);
        setFeaturedListings(featured);
        setDestinations(popularDestinations);
        setHeroImage(heroBackground);
        setHostCtaImage(hostBackground);
        if (heroOverlaySetting) setHeroOverlay(parseInt(heroOverlaySetting, 10));
        if (hostCtaOverlaySetting) setHostCtaOverlay(parseInt(hostCtaOverlaySetting, 10));
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

  const heroBackgroundImage = heroImage
    ? `linear-gradient(rgba(0,0,0,${heroOverlay / 100}), rgba(0,0,0,${heroOverlay / 100})), url(${heroImage})`
    : generatedArtUrl({ hue: 150, variant: 2 });
  const hostBackgroundImage = hostCtaImage
    ? `linear-gradient(rgba(0,0,0,${hostCtaOverlay / 100}), rgba(0,0,0,${hostCtaOverlay / 100})), url(${hostCtaImage})`
    : generatedArtUrl({ hue: 170, variant: 1 });

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

      {/* Hero - the common <Header /> (rendered once in App.tsx, sticky)
          reserves its own 5rem of flow height above this section (so
          nothing on any other page is ever covered/unclickable behind it -
          see Header.tsx), but -mt-20 here pulls this section's own box up
          underneath that reserved space, so the cinematic backdrop extends
          behind the floating pill. */}
      <section className="relative -mt-20 flex min-h-screen flex-col justify-center overflow-hidden bg-black pb-16 pt-28 text-white">
        <div className="scene-bg" style={{ backgroundImage: heroBackgroundImage }} />
        <div className="scene-scrim" />

        <div className={`relative z-10 grid w-full items-end gap-9 ${SIDE_PAD} lg:grid-cols-[1.15fr_.85fr]`}>
          <div>
            <h1 className="animate-fade-in text-[clamp(3.4rem,8.4vw,8.75rem)] font-light leading-[0.9] text-white">
              <EditableText settingKey="content_hero_title_a" fallback="Where will you" as="span" />{' '}
              <span className="relative inline-block isolate px-[0.14em] font-medium italic text-accent-foreground">
                <span aria-hidden="true" className="absolute inset-x-0 bottom-[0.04em] top-[0.1em] -z-10 -rotate-[1.5deg] -skew-x-[9deg] rounded-[0.12em] bg-accent" />
                <EditableText settingKey="content_hero_title_b" fallback="get lost" as="span" />
              </span>{' '}
              <EditableText settingKey="content_hero_title_c" fallback="next?" as="span" />
            </h1>
            <EditableText
              settingKey="content_hero_subtitle"
              fallback="Karnataka's finest stays — villas above the clouds, lofts between boulders, a tent on the river. Instant Book where hosts allow it, prices that show their working."
              as="p"
              className="mt-[22px] max-w-[42ch] animate-fade-in text-lg text-white/85"
              style={{ animationDelay: '0.1s' }}
            />
          </div>

          <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <HeroPlanner state={search} onChange={patchSearch} resultCount={resultTotal} />
          </div>
        </div>
      </section>

      {/* Featured stays - admin-curated (is_featured, capped by
          featured_stays_max_slots), five across. */}
      <section id="featured" className="scroll-mt-24 py-20 md:py-24">
        <div className={`w-full ${SIDE_PAD}`}>
          <div className="rv mb-10 flex items-end justify-between gap-4">
            <EditableText
              settingKey="content_featured_heading"
              fallback="Featured stays"
              as="h2"
              className="text-[42px] font-light leading-none sm:text-[64px] lg:text-[84px]"
            />
            <Link to="/search" aria-label="Explore more" className="text-text-meta trivara-transition hover:text-foreground">
              <ArrowRight className="h-6 w-6" />
            </Link>
          </div>

          {featuredListings.length === 0 ? (
            <p className="py-12 text-center text-text-secondary">
              {dataReady ? 'No featured stays yet - check back soon.' : ' '}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {featuredListings.map((listing, i) => (
                <div key={listing.id} className="rv" style={{ transitionDelay: `${i * 60}ms` }}>
                  <FeaturedListingCard listing={listing} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Image band - admin-configurable (Admin Settings > Branding, the
          "75% banner" slot): a full-bleed image+link when set, otherwise a
          calm inset space the same size. */}
      {banner75.image ? (
        banner75.link ? (
          <a href={banner75.link} className="block h-[75vh] overflow-hidden">
            <img src={banner75.image} alt="" loading="lazy" className="h-full w-full object-cover" />
          </a>
        ) : (
          <div className="h-[75vh] overflow-hidden">
            <img src={banner75.image} alt="" loading="lazy" className="h-full w-full object-cover" />
          </div>
        )
      ) : (
        <div className={`w-full ${SIDE_PAD}`}>
          <div className="nu-in h-60" aria-hidden="true" />
        </div>
      )}

      {/* Built like instruments, not brochures. */}
      <section id="why" className="scroll-mt-24 py-20 md:py-24">
        <div className={`w-full ${SIDE_PAD}`}>
          <h2 className="rv mb-10 max-w-[18ch] text-[40px] font-light leading-none sm:text-6xl lg:text-7xl">
            Built like <em className="text-text-secondary">instruments</em>, not brochures.
          </h2>
          <InstrumentsBento />
        </div>
      </section>

      {/* Popular destinations - click one to filter the live results below. */}
      {destinations.length > 0 && (
        <section id="destinations" className="scroll-mt-24 pb-20 md:pb-24">
          <div className={`w-full ${SIDE_PAD}`}>
            <div className="rv mb-8 flex flex-wrap items-end justify-between gap-3">
              <EditableText
                settingKey="content_destinations_heading"
                fallback="Popular destinations"
                as="h2"
                className="text-[40px] font-light leading-none sm:text-6xl lg:text-7xl"
              />
              <span className="text-sm text-text-secondary">Hover to explore · click to filter the map</span>
            </div>
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

      {/* Every stay, on the map - live results */}
      <section id="explore" className="scroll-mt-24 pb-20 md:pb-24">
        <div className={`w-full ${SIDE_PAD}`}>
          <div className="rv mb-8 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-[40px] font-light leading-none sm:text-6xl lg:text-7xl">
              Every stay, <em className="text-text-secondary">on the map</em>
            </h2>
            <span className="text-sm text-text-secondary">
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

      {/* Host CTA - full-bleed cinematic section with an accent slab. */}
      <section className="relative flex min-h-[90vh] items-center overflow-hidden bg-black text-white">
        <div className="scene-bg" style={{ backgroundImage: hostBackgroundImage }} />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 to-black/5" />
        <div className={`relative z-10 w-full ${SIDE_PAD}`}>
          <div
            className="rv max-w-[640px] rounded-[10px] bg-accent py-14 pl-[52px] pr-[60px] text-accent-foreground"
            style={{ clipPath: 'polygon(0 6%, 100% 0, 100% 94%, 0 100%)' }}
          >
            <EditableText
              settingKey="content_host_heading"
              fallback="Your land. Your terms."
              as="h2"
              className="mb-4 text-[clamp(2.75rem,6vw,5.75rem)] font-light leading-[0.92]"
            />
            <EditableText
              settingKey="content_host_subtitle"
              fallback="Tiered commission, per-date pricing, blackout dates and payouts you can follow."
              as="p"
              className="mb-6 max-w-[42ch] font-medium"
            />
            <Link
              to="/host"
              className="inline-flex rounded-full bg-accent-foreground px-8 py-4 font-ui text-sm font-bold text-accent transition-all duration-200 hover:-translate-y-0.5"
            >
              <EditableText settingKey="content_host_button" fallback="Start hosting →" as="span" />
            </Link>
          </div>
        </div>
      </section>

      {/* Collections - up to three admin-uploaded photo tiles (Admin
          Settings > Branding), each optionally linking somewhere. A slot
          with no image renders nothing; the whole section is hidden if
          none of the three are set. */}
      {collectionSlots.some((slot) => slot.image) && (
        <section className="py-16 md:py-20">
          <div className={`w-full ${SIDE_PAD}`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {collectionSlots
                .filter((slot): slot is { image: string; link: string | null } => !!slot.image)
                .map((slot, i) => {
                  const tile = (
                    <div className="nu group relative aspect-[3/4] overflow-hidden rounded-[30px] bg-surface-2">
                      <img
                        src={slot.image}
                        alt=""
                        className="h-full w-full object-cover duration-500 trivara-transition group-hover:scale-105"
                      />
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

      {/* Hero-size banner - full-bleed image+link, same width and height
          treatment as Hero (100vh). Admin-configurable (Admin Settings >
          Branding); renders nothing if no image is set. Last section
          before the footer. */}
      {bannerHero.image && (
        bannerHero.link ? (
          <a href={bannerHero.link} className="block h-screen overflow-hidden">
            <img src={bannerHero.image} alt="" loading="lazy" className="h-full w-full object-cover" />
          </a>
        ) : (
          <div className="h-screen overflow-hidden">
            <img src={bannerHero.image} alt="" loading="lazy" className="h-full w-full object-cover" />
          </div>
        )
      )}
    </div>
  );
}
