import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, Home, DollarSign, Calendar, Shield } from 'lucide-react';

export default function BecomeHost() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative py-20 md:py-32">
        <div className="container">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-pillar font-bold uppercase tracking-wide mb-6 animate-fade-in">
              Share your space,{' '}
              <span className="font-bastliga lowercase tracking-normal text-accent text-[0.75em]">
                earn on your terms
              </span>
            </h1>
            <p className="text-xl text-text-secondary mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Join thousands of hosts who are earning by sharing their homes with travelers.
            </p>
            <Link to="/host/listings/new" className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <Button className="trivara-btn-primary px-8 py-6 text-base gap-2">
                Start hosting
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-surface-0">
        <div className="container">
          <h2 className="text-3xl font-display font-medium text-center mb-12">
            Why host on Trivara?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-6">
                <DollarSign className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-medium mb-3">Earn consistently</h3>
              <p className="text-text-secondary">
                Set your own prices and receive payments directly to your account.
              </p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-6">
                <Calendar className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-medium mb-3">Host your way</h3>
              <p className="text-text-secondary">
                Control your availability, house rules, and how you interact with guests.
              </p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-6">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-medium mb-3">Host with confidence</h3>
              <p className="text-text-secondary">
                Every booking includes host protection and 24/7 support.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20">
        <div className="container">
          <h2 className="text-3xl font-display font-medium text-center mb-12">
            How it works
          </h2>
          <div className="max-w-3xl mx-auto">
            <div className="space-y-8">
              {[
                {
                  step: '01',
                  title: 'Create your listing',
                  description: 'Share details about your space, set your price, and add photos.',
                },
                {
                  step: '02',
                  title: 'Welcome guests',
                  description: 'Accept bookings and provide a great experience for your guests.',
                },
                {
                  step: '03',
                  title: 'Get paid',
                  description: 'Receive payments directly to your account after each stay.',
                },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-6">
                  <div className="flex-shrink-0 h-12 w-12 rounded-full bg-surface-2 flex items-center justify-center text-sm font-medium">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-xl font-medium mb-2">{item.title}</h3>
                    <p className="text-text-secondary">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-surface-0">
        <div className="container text-center">
          <h2 className="text-3xl font-display font-medium mb-6">
            Ready to start hosting?
          </h2>
          <Link to="/host/listings/new">
            <Button className="trivara-btn-primary px-8 py-6 text-base">
              Create your listing
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
