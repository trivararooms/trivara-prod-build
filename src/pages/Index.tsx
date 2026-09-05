import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SearchBar } from '@/components/search/SearchBar';
import { FeaturedListingCard } from '@/components/listings/FeaturedListingCard';
import { EditableText } from '@/components/content/EditableText';
import { listingService } from '@/services/listingService';
import { siteSettingsService } from '@/services/siteSettingsService';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Listing } from '@/types';

type Destination = Awaited<ReturnType<typeof listingService.getPopularDestinations>>[number];

// Mirrors the mock's own locked page margin (--page-margin: clamp(20px, 4vw,
// 48px)) instead of Tailwind's default .container gutter (2rem fixed,
// capped at 1400px) - used on every section below so the side spacing stays
// identical from the hero header down through the footer.
const SIDE_PAD = 'px-[clamp(20px,4vw,48px)]';

export default function Index() {
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [heroOverlay, setHeroOverlay] = useState(65);
  const [hostCtaImage, setHostCtaImage] = useState<string | null>(null);
  const [hostCtaOverlay, setHostCtaOverlay] = useState(80);
  const [collectionSlots, setCollectionSlots] = useState<{ image: string | null; link: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featured, popularDestinations, heroBackground, hostBackground, heroOverlaySetting, hostCtaOverlaySetting, collections] = await Promise.all([
          listingService.getFeatured(3),
          listingService.getPopularDestinations(),
          siteSettingsService.getHeroBackgroundImageUrl(),
          siteSettingsService.getHostCtaBackgroundImageUrl(),
          siteSettingsService.getAppSetting('hero_overlay_opacity'),
          siteSettingsService.getAppSetting('host_cta_overlay_opacity'),
          Promise.all([1, 2, 3].map(async (slot) => ({
            image: await siteSettingsService.getHomepageCollectionImageUrl(slot),
            link: await siteSettingsService.getHomepageCollectionLinkUrl(slot),
          }))),
        ]);
        setFeaturedListings(featured);
        setDestinations(popularDestinations);
        setHeroImage(heroBackground);
        setHostCtaImage(hostBackground);
        if (heroOverlaySetting) setHeroOverlay(parseInt(heroOverlaySetting, 10));
        if (hostCtaOverlaySetting) setHostCtaOverlay(parseInt(hostCtaOverlaySetting, 10));
        setCollectionSlots(collections);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8 flex items-center justify-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero - the common <Header /> (rendered once in App.tsx, sticky and
          transparent) still reserves its own 5rem of flow height above this
          section (so nothing on any other page is ever covered/unclickable
          behind it - see Header.tsx), but -mt-20 here pulls this section's
          own box up underneath that reserved space, so its background image
          extends behind the header instead of stopping below it. pt-20 on
          the content wrapper below keeps the actual hero text roughly where
          it was before, rather than drifting up into the header's row. */}
      <section className="relative -mt-20 min-h-screen flex flex-col overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            // With an admin-uploaded photo: a flat, single-tone dark tint
            // (adjustable in Admin Settings > Branding), pinned to
            // --foreground rather than --surface-0 - foreground is the one
            // token guaranteed to stay near-black across themes, so the
            // photo always reads through a dark scrim regardless of which
            // way the site palette is currently set. With no photo: the one
            // continuous diagonal blend between the two locked palette hues
            // that's the actual brand background.
            backgroundImage: heroImage
              ? `linear-gradient(hsl(var(--foreground) / ${heroOverlay / 100}), hsl(var(--foreground) / ${heroOverlay / 100})), url(${heroImage})`
              : `linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pt-20">
          <EditableText
            settingKey="content_hero_eyebrow"
            fallback="wander well"
            as="p"
            className="font-script italic text-2xl text-accent mb-4 animate-fade-in"
          />
          <EditableText
            settingKey="content_hero_heading"
            fallback="Find your place"
            as="h1"
            className="text-white mb-8 animate-fade-in"
          />
          <EditableText
            settingKey="content_hero_subtitle"
            fallback="Discover extraordinary stays around the world"
            as="p"
            className="text-xl text-white/70 animate-fade-in"
            style={{ animationDelay: '0.1s' }}
          />

          <div className="w-full max-w-[1100px] mx-auto mt-16 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <SearchBar variant="hero" />
          </div>
        </div>
      </section>

      {/* Popular Destinations - tight bottom padding so the cards sit close
          to "Featured stays" below, instead of a big gap between sections. */}
      {destinations.length > 0 && (
        <section className="pt-24 md:pt-32 pb-4 md:pb-6">
          <div className={`w-full ${SIDE_PAD}`}>
            <EditableText
              settingKey="content_destinations_heading"
              fallback="Popular destinations"
              as="h2"
              className="text-[27px] sm:text-[42px] lg:text-[55px] font-display font-medium text-center mb-10"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {destinations.map((dest) => (
                <Link
                  key={dest.city}
                  to={`/search?location=${encodeURIComponent(dest.city)}`}
                  className="group relative aspect-[4/5] overflow-hidden bg-surface-2"
                >
                  <img
                    src={dest.image}
                    alt={dest.city}
                    className="w-full h-full object-cover group-hover:scale-105 trivara-transition duration-500"
                  />
                  {/* Dark scrim pinned to --foreground (always near-black,
                      unlike --surface-0 which now flips with the palette)
                      so the caption stays legible over any photo. */}
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/5 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="font-bold text-xs uppercase tracking-wide text-white">{dest.city}</h3>
                    <p className="text-[11px] text-white/70 mt-0.5">{dest.listings} {dest.listings === 1 ? 'stay' : 'stays'}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Collections - up to three admin-uploaded photo tiles (Admin
          Settings > Branding), each optionally linking somewhere. A slot
          with no image renders nothing; the whole section is hidden if
          none of the three are set. */}
      {collectionSlots.some((slot) => slot.image) && (
        <section className="pt-4 md:pt-6 pb-16 md:pb-20">
          <div className={`w-full ${SIDE_PAD}`}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {collectionSlots
                .filter((slot): slot is { image: string; link: string | null } => !!slot.image)
                .map((slot, i) => {
                  const tile = (
                    <div className="group relative aspect-[3/4] overflow-hidden bg-surface-2">
                      <img
                        src={slot.image}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 trivara-transition duration-500"
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

      {/* Featured Listings - tight top padding to match the destinations
          section's tight bottom padding above, so the gap between the two
          sections stays minimal. */}
      <section className="pt-4 md:pt-6 pb-16 md:pb-20">
        <div className={`w-full ${SIDE_PAD}`}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-10 gap-4">
            <div />
            <EditableText
              settingKey="content_featured_heading"
              fallback="Featured stays"
              as="h2"
              className="text-[42px] sm:text-[64px] lg:text-[84px] font-display font-medium text-center leading-none"
            />
            <Link to="/search" aria-label="Explore more" className="justify-self-end text-text-meta hover:text-foreground trivara-transition">
              <ArrowRight className="h-6 w-6" />
            </Link>
          </div>

          {featuredListings.length === 0 ? (
            <p className="text-text-secondary py-12 text-center">No featured stays yet - check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredListings.map((listing) => (
                <FeaturedListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Become a Host CTA - full-bleed section sized and structured just
          like the Hero above: the background image spans edge-to-edge
          (no bordered/rounded card floating inside the page margins) and
          the section fills the viewport the same way, only `.container`-
          style horizontal padding is applied to the actual content. */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            // Flat single-tone dark tint (adjustable in Admin Settings >
            // Branding), pinned to --foreground same as the hero above - see
            // that section's comment for why --surface-0 no longer works
            // here now that it tracks the light canvas instead of the dark one.
            backgroundImage: hostCtaImage
              ? `linear-gradient(hsl(var(--foreground) / ${hostCtaOverlay / 100}), hsl(var(--foreground) / ${hostCtaOverlay / 100})), url(${hostCtaImage})`
              : `linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="max-w-2xl">
            <EditableText
              settingKey="content_host_ribbon"
              fallback="share & earn"
              as="span"
              className="inline-block font-morderline text-xs uppercase tracking-wide bg-accent text-accent-foreground px-5 py-2 rounded-full mb-10"
            />
            <EditableText
              settingKey="content_host_heading"
              fallback="Share your space"
              as="h2"
              className="text-4xl md:text-6xl font-display font-medium text-white mb-8"
            />
            <EditableText
              settingKey="content_host_subtitle"
              fallback="Join hosts who earn by sharing their homes with travelers worldwide"
              as="p"
              className="text-white/70 mb-4 text-xl"
            />
            <EditableText
              settingKey="content_host_aside"
              fallback="your home, your rules"
              as="p"
              className="font-bastliga italic text-3xl text-accent mb-12"
            />
            <Link to="/host">
              <Button className="trivara-btn-primary rounded-full px-12 py-7 text-base uppercase tracking-wide font-bold">
                <EditableText settingKey="content_host_button" fallback="Become a Host" as="span" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
