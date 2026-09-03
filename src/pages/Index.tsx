import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Logo } from '@/components/layout/Logo';
import { SearchBar } from '@/components/search/SearchBar';
import { FeaturedListingCard } from '@/components/listings/FeaturedListingCard';
import { listingService } from '@/services/listingService';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Listing } from '@/types';

type Destination = Awaited<ReturnType<typeof listingService.getPopularDestinations>>[number];

export default function Index() {
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featured, popularDestinations] = await Promise.all([
          listingService.getFeatured(3),
          listingService.getPopularDestinations()
        ]);
        setFeaturedListings(featured);
        setDestinations(popularDestinations);
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
        <Header />
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
      {/* Hero - the header lives inside it as a transparent overlay topbar
          instead of a separate persistent nav, matching the mock. */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(120% 90% at 30% 20%, hsl(var(--accent) / 0.55) 0%, transparent 55%),
              radial-gradient(90% 70% at 80% 80%, hsl(var(--primary) / 0.45) 0%, transparent 60%),
              linear-gradient(160deg, hsl(var(--surface-1)), hsl(var(--surface-0)))
            `,
          }}
        />

        <Header variant="transparent" />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="font-script text-2xl text-accent-hover mb-3 animate-fade-in">
            wander well
          </p>
          <h1 className="mb-8 animate-fade-in">
            Find your place
          </h1>
          <p className="text-xl text-text-secondary animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Discover extraordinary stays around the world
          </p>

          <div className="w-full max-w-2xl mx-auto mt-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <SearchBar variant="hero" />
          </div>
        </div>
      </section>

      {/* Popular Destinations */}
      {destinations.length > 0 && (
        <section className="py-24 md:py-32">
          <div className="container">
            <h2 className="text-2xl font-display font-medium mb-8">Popular destinations</h2>

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
                    className="group relative w-44 sm:w-48 flex-shrink-0 aspect-[4/5] rounded-lg overflow-hidden bg-surface-2 border border-border"
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

      {/* Featured Listings */}
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-display font-medium">Featured stays</h2>
            <Link to="/search" aria-label="Explore more" className="text-text-meta hover:text-foreground trivara-transition">
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

      {/* Become a Host CTA */}
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="min-h-[85vh] flex items-center justify-center text-center border border-border rounded-xl px-8">
            <div className="max-w-xl">
              <span className="inline-block font-morderline text-[10px] tracking-wide bg-accent text-accent-foreground px-4 py-1.5 rounded-full mb-8">
                share &amp; earn
              </span>
              <h2 className="text-3xl md:text-5xl font-display font-medium mb-6">
                Share your space
              </h2>
              <p className="text-text-secondary mb-2 text-lg">
                Join hosts who earn by sharing their homes with travelers worldwide
              </p>
              <p className="font-bastliga text-2xl text-primary mb-8">
                your home, your rules
              </p>
              <Link to="/host">
                <Button className="trivara-btn-primary rounded-full px-9 py-6 text-sm uppercase tracking-wide font-bold">
                  Become a Host
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - legally/Razorpay-required links only, no full sitemap */}
      <footer className="py-8">
        <div className="container flex flex-wrap items-center justify-between gap-6">
          <Logo markClassName="h-9 w-9" />
          <div className="flex flex-wrap gap-1">
            <Link to="/privacy" className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-foreground hover:bg-surface-2 trivara-transition">Privacy</Link>
            <Link to="/terms" className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-foreground hover:bg-surface-2 trivara-transition">Terms</Link>
            <Link to="/help" className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-foreground hover:bg-surface-2 trivara-transition">Contact Us</Link>
            <Link to="/cancellation-options" className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-foreground hover:bg-surface-2 trivara-transition">Cancellation options</Link>
          </div>
          <span className="text-xs text-text-meta">© {new Date().getFullYear()} Trivara. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
