import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { SearchBar } from '@/components/search/SearchBar';
import { ListingGrid } from '@/components/listings/ListingGrid';
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
          listingService.getFeatured(4),
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative py-32 md:py-44 lg:py-56">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center mb-20">
            <p className="font-script text-2xl text-accent mb-3 animate-fade-in">
              wander well
            </p>
            <h1 className="font-beast tracking-wide mb-8 animate-fade-in">
              Find your place
            </h1>
            <p className="text-xl text-text-secondary animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Discover extraordinary stays around the world
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-4xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <SearchBar variant="hero" />
          </div>
        </div>
      </section>

      {/* Popular Destinations */}
      <section className="py-32 md:py-40 bg-surface-0">
        <div className="container">
          <div className="flex items-center justify-between mb-16">
            <h2 className="text-2xl font-beast tracking-wide">Popular destinations</h2>
            <Link to="/search" className="text-sm text-text-secondary hover:text-foreground flex items-center gap-1 trivara-transition">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
            {destinations.map((dest) => (
              <Link
                key={dest.city}
                to={`/search?location=${encodeURIComponent(dest.city)}`}
                className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-surface-2 border border-border"
              >
                <img
                  src={dest.image}
                  alt={dest.city}
                  className="w-full h-full object-cover group-hover:scale-105 trivara-transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-0/80 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="font-medium text-sm">{dest.city}</h3>
                  <p className="text-xs text-text-meta">{dest.listings} stays</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      <section className="py-32 md:py-40">
        <div className="container">
          <div className="flex items-center justify-between mb-16">
            <h2 className="text-2xl font-display font-medium">Featured stays</h2>
            <Link to="/search" className="text-sm text-text-secondary hover:text-foreground flex items-center gap-1 trivara-transition">
              Explore more <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <ListingGrid listings={featuredListings} />
        </div>
      </section>

      {/* Become a Host CTA */}
      <section className="py-40 bg-surface-0">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center relative border border-border rounded-xl px-8 py-24 md:px-24 md:py-32">
            <span className="inline-block font-morderline text-[10px] tracking-wide bg-accent text-accent-foreground px-3 py-1 rounded-full border border-accent-hover -mt-32 mb-8">
              share &amp; earn
            </span>
            <h2 className="text-3xl md:text-4xl font-pillar font-bold uppercase tracking-wide mb-8">
              Share your space
            </h2>
            <p className="text-text-secondary mb-4 text-lg">
              Join hosts who earn by sharing their homes with travelers worldwide
            </p>
            <p className="font-bastliga text-2xl text-primary mb-16">
              your home, your rules
            </p>
            <Link to="/host">
              <Button className="trivara-btn-primary px-8 py-6 text-base">
                Become a Host
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-32 border-t border-border">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-16 mb-24">
            <div>
              <h4 className="font-medium mb-5 text-sm">Support</h4>
              <ul className="space-y-4 text-sm text-text-secondary">
                <li><Link to="/help" className="hover:text-foreground trivara-transition">Help Center</Link></li>
                <li><Link to="/safety" className="hover:text-foreground trivara-transition">Safety information</Link></li>
                <li><Link to="/cancellation-options" className="hover:text-foreground trivara-transition">Cancellation options</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-5 text-sm">Hosting</h4>
              <ul className="space-y-4 text-sm text-text-secondary">
                <li><Link to="/host" className="hover:text-foreground trivara-transition">Become a Host</Link></li>
                <li><Link to="/resources" className="hover:text-foreground trivara-transition">Resources</Link></li>
                <li><Link to="/community" className="hover:text-foreground trivara-transition">Community</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-5 text-sm">Trivara</h4>
              <ul className="space-y-4 text-sm text-text-secondary">
                <li><Link to="/about" className="hover:text-foreground trivara-transition">About</Link></li>
                <li><Link to="/careers" className="hover:text-foreground trivara-transition">Careers</Link></li>
                <li><Link to="/press" className="hover:text-foreground trivara-transition">Press</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-5 text-sm">Legal</h4>
              <ul className="space-y-4 text-sm text-text-secondary">
                <li><Link to="/privacy" className="hover:text-foreground trivara-transition">Privacy</Link></li>
                <li><Link to="/terms" className="hover:text-foreground trivara-transition">Terms</Link></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-12 border-t border-border">
            <span className="font-display text-xl font-semibold mb-4 md:mb-0">Trivara</span>
            <p className="text-sm text-text-meta">© {new Date().getFullYear()} Trivara. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
