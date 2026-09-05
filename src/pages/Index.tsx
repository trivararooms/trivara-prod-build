import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
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
  const [spacerImage, setSpacerImage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [destCardWidth, setDestCardWidth] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featured, popularDestinations, heroBackground, hostBackground, heroOverlaySetting, hostCtaOverlaySetting, spacerImageSetting] = await Promise.all([
          listingService.getFeatured(5),
          listingService.getPopularDestinations(),
          siteSettingsService.getHeroBackgroundImageUrl(),
          siteSettingsService.getHostCtaBackgroundImageUrl(),
          siteSettingsService.getAppSetting('hero_overlay_opacity'),
          siteSettingsService.getAppSetting('host_cta_overlay_opacity'),
          siteSettingsService.getAppSetting('homepage_spacer_image_url'),
        ]);
        setFeaturedListings(featured);
        setDestinations(popularDestinations);
        setHeroImage(heroBackground);
        setHostCtaImage(hostBackground);
        if (heroOverlaySetting) setHeroOverlay(parseInt(heroOverlaySetting, 10));
        if (hostCtaOverlaySetting) setHostCtaOverlay(parseInt(hostCtaOverlaySetting, 10));
        setSpacerImage(spacerImageSetting || '');
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Destination cards are sized to 0.75x the width of a featured-stay card
  // (both share the same 4:5 aspect ratio, so this is a true proportional
  // scale, not just a crop) - measured live off the rendered featured card,
  // the same way the mock's own vanilla-JS syncDestCardSize() did.
  useEffect(() => {
    const sync = () => {
      const featMedia = document.querySelector('.feat-media');
      if (!featMedia) return;
      setDestCardWidth(featMedia.getBoundingClientRect().width * 0.75);
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [featuredListings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8 flex items-center justify-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Marquee needs at least two rows to loop seamlessly; below that it just
  // renders once, statically.
  const marqueeDestinations = destinations.length > 1 ? [...destinations, ...destinations] : destinations;
  const marqueeDuration = Math.max(destinations.length * 6.5, 16);

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
            // (adjustable in Admin Settings > Branding) so the photo reads
            // through cleanly - no indigo/chestnut color mixed into it.
            // With no photo: the one continuous diagonal blend between the
            // two locked palette hues that's the actual brand background.
            backgroundImage: heroImage
              ? `linear-gradient(hsl(var(--surface-0) / ${heroOverlay / 100}), hsl(var(--surface-0) / ${heroOverlay / 100})), url(${heroImage})`
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
            className="font-script text-2xl text-accent-hover mb-3 animate-fade-in"
          />
          <EditableText
            settingKey="content_hero_heading"
            fallback="Find your place"
            as="h1"
            className="mb-8 animate-fade-in"
          />
          <EditableText
            settingKey="content_hero_subtitle"
            fallback="Discover extraordinary stays around the world"
            as="p"
            className="text-xl text-text-secondary animate-fade-in"
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

            <div className="marquee-mask">
              <div
                className={`flex gap-4 w-max ${destinations.length > 1 ? 'marquee-track' : ''}`}
                style={destinations.length > 1 ? { animationDuration: `${marqueeDuration}s` } : undefined}
              >
                {marqueeDestinations.map((dest, i) => (
                  <Link
                    key={`${dest.city}-${i}`}
                    to={`/search?location=${encodeURIComponent(dest.city)}`}
                    aria-hidden={i >= destinations.length ? true : undefined}
                    className="group relative flex-shrink-0 aspect-[4/5] overflow-hidden bg-surface-2"
                    style={{ width: destCardWidth ? `${destCardWidth}px` : '180px' }}
                  >
                    <img
                      src={dest.image}
                      alt={dest.city}
                      className="w-full h-full object-cover group-hover:scale-105 trivara-transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-0/85 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="font-bold text-xs uppercase tracking-wide">{dest.city}</h3>
                      <p className="text-[11px] text-text-meta mt-0.5">{dest.listings} {dest.listings === 1 ? 'stay' : 'stays'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Homepage spacer image - full-bleed (no .container/SIDE_PAD wrapper,
          so it runs edge to edge like the Hero section does), sized close to
          the Hero's overall height but a little shorter since it's just a
          breather between Popular Destinations and Featured Stays. Nothing
          in here but the image itself - no border, no overlay, no text -
          and if no image is configured in Admin Settings > Branding, the
          whole section renders nothing at all. */}
      {spacerImage && (
        <section className="h-[60vh] md:h-[70vh] overflow-hidden">
          <img src={spacerImage} alt="" className="w-full h-full object-cover" />
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
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
            // Branding), same as the hero - no colored gradient over the photo.
            backgroundImage: hostCtaImage
              ? `linear-gradient(hsl(var(--surface-0) / ${hostCtaOverlay / 100}), hsl(var(--surface-0) / ${hostCtaOverlay / 100})), url(${hostCtaImage})`
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
              className="inline-block font-morderline text-xs tracking-wide bg-accent text-accent-foreground px-5 py-2 rounded-full mb-10"
            />
            <EditableText
              settingKey="content_host_heading"
              fallback="Share your space"
              as="h2"
              className="text-4xl md:text-6xl font-display font-medium mb-8"
            />
            <EditableText
              settingKey="content_host_subtitle"
              fallback="Join hosts who earn by sharing their homes with travelers worldwide"
              as="p"
              className="text-text-secondary mb-4 text-xl"
            />
            <EditableText
              settingKey="content_host_aside"
              fallback="your home, your rules"
              as="p"
              className="font-bastliga text-3xl text-primary mb-12"
            />
            <Link to="/host">
              <Button className="trivara-btn-primary rounded-full px-12 py-7 text-base uppercase tracking-wide font-bold">
                <EditableText settingKey="content_host_button" fallback="Become a Host" as="span" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer - legally/Razorpay-required links only, no full sitemap */}
      <footer className="py-8">
        <div className={`w-full ${SIDE_PAD} flex flex-wrap items-center justify-between gap-6`}>
          <Logo markClassName="h-11 w-11" nameClassName="text-xl" color="#000000" />
          <div className="flex flex-wrap gap-1">
            <Link to="/privacy" className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-black hover:opacity-70 hover:bg-surface-2 trivara-transition">Privacy</Link>
            <Link to="/terms" className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-black hover:opacity-70 hover:bg-surface-2 trivara-transition">Terms</Link>
            <Link to="/help" className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-black hover:opacity-70 hover:bg-surface-2 trivara-transition">Talk to Us</Link>
            <Link to="/cancellation-options" className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-black hover:opacity-70 hover:bg-surface-2 trivara-transition">Cancellation options</Link>
          </div>
          <span className="text-xs text-black">© {new Date().getFullYear()} Trivara. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
