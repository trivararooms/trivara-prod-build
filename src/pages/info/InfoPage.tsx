import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';

interface InfoPageProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Shared shell for the footer's static content pages (About, Careers, Press,
 * Privacy, Terms, Help Center, Safety, Cancellation options, Resources,
 * Community). These used to all be `<Link to="#">` - dead links that did
 * nothing when clicked. Each page below carries real, honest content rather
 * than lorem-ipsum filler: where something genuinely isn't built yet (e.g.
 * a community forum), the page says so instead of pretending otherwise.
 */
export function InfoPage({ title, subtitle, children }: InfoPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-display font-medium text-foreground mb-2">{title}</h1>
        {subtitle && <p className="text-text-secondary mb-8">{subtitle}</p>}
        <div className="prose-sm space-y-4 text-text-secondary leading-relaxed [&_h2]:text-foreground [&_h2]:font-medium [&_h2]:text-lg [&_h2]:mt-8 [&_h2]:mb-2 [&_strong]:text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

export function SupportContact() {
  return (
    <p>
      Need something not covered here? Email{' '}
      <a href="mailto:support@trivara.example" className="text-foreground underline underline-offset-2">
        support@trivara.example
      </a>{' '}
      and a real person will get back to you.
    </p>
  );
}

export function AboutPage() {
  return (
    <InfoPage title="About Trivara" subtitle="Find your place, wherever that is.">
      <p>
        Trivara is a marketplace that connects travelers with hosts who have a spare room, a whole
        home, or something in between. We handle search, booking, and payment so hosts can focus on
        their space and guests can focus on their trip.
      </p>
      <p>
        We're a small, early-stage team, still building out the product feature by feature -
        if something feels unfinished, it probably is, and we'd rather be upfront about that than
        pretend otherwise.
      </p>
    </InfoPage>
  );
}

export function CareersPage() {
  return (
    <InfoPage title="Careers">
      <p>We're not actively hiring for any open roles right now.</p>
      <p>
        If you're excited about travel-tech and want to reach out anyway, email{' '}
        <a href="mailto:careers@trivara.example" className="text-foreground underline underline-offset-2">
          careers@trivara.example
        </a>{' '}
        and we'll keep your note on file.
      </p>
    </InfoPage>
  );
}

export function PressPage() {
  return (
    <InfoPage title="Press">
      <p>
        For press or media inquiries, contact{' '}
        <a href="mailto:press@trivara.example" className="text-foreground underline underline-offset-2">
          press@trivara.example
        </a>
        . We don't have a press kit published yet.
      </p>
    </InfoPage>
  );
}

export function PrivacyPage() {
  return (
    <InfoPage title="Privacy Policy" subtitle="Last updated 2026">
      <p>
        This page describes, in plain terms, what we collect and why. It's a working policy for an
        early-stage product, not a substitute for legal advice.
      </p>
      <h2>What we collect</h2>
      <p>
        Account details (name, email, avatar) from Google sign-in; listing and booking data you or a
        host enter; payment details are handled directly by Razorpay - we never see or store your
        card number.
      </p>
      <h2>How we use it</h2>
      <p>
        To create bookings, process payments and refunds, show hosts who's staying with them, send
        booking confirmation/cancellation emails, and improve the product.
      </p>
      <h2>Who we share it with</h2>
      <p>
        Razorpay (payments), and the host or guest on the other side of a booking (name, and once
        messaging is used, message content). We don't sell your data.
      </p>
      <h2>Your choices</h2>
      <p>
        <SupportContact />
      </p>
    </InfoPage>
  );
}

export function TermsPage() {
  return (
    <InfoPage title="Terms of Service" subtitle="Last updated 2026">
      <p>By using Trivara, you agree to the following:</p>
      <h2>Bookings</h2>
      <p>
        A booking is confirmed once payment succeeds. Cancellation terms depend on the listing's
        cancellation policy (flexible, moderate, or strict) - see{' '}
        <Link to="/cancellation-options" className="text-foreground underline underline-offset-2">
          Cancellation options
        </Link>
        .
      </p>
      <h2>Hosting</h2>
      <p>
        Hosts are responsible for the accuracy of their listing and for meeting guests as described.
        Trivara takes a platform fee from each completed booking's payout.
      </p>
      <h2>Conduct</h2>
      <p>
        Harassment, discrimination, or fraudulent listings/bookings are not allowed and may result in
        account suspension.
      </p>
      <p>
        <SupportContact />
      </p>
    </InfoPage>
  );
}

export function HelpCenterPage() {
  return (
    <InfoPage title="Help Center" subtitle="Common questions, and how to reach us.">
      <h2>How do I cancel a booking?</h2>
      <p>
        Guests can cancel from{' '}
        <Link to="/trips" className="text-foreground underline underline-offset-2">
          Trips
        </Link>
        ; hosts can cancel a booking from the{' '}
        <Link to="/host/dashboard" className="text-foreground underline underline-offset-2">
          Host Dashboard
        </Link>
        . Refund eligibility depends on the listing's cancellation policy - see{' '}
        <Link to="/cancellation-options" className="text-foreground underline underline-offset-2">
          Cancellation options
        </Link>
        .
      </p>
      <h2>How do I become a host?</h2>
      <p>
        Start from the{' '}
        <Link to="/host" className="text-foreground underline underline-offset-2">
          Become a Host
        </Link>{' '}
        page. Your first listing goes live once you publish it.
      </p>
      <h2>How do I contact a host or guest?</h2>
      <p>
        Use the "Message host" button on any listing page, or reply from your{' '}
        <Link to="/messages" className="text-foreground underline underline-offset-2">
          Messages
        </Link>{' '}
        inbox.
      </p>
      <h2>Something else?</h2>
      <SupportContact />
    </InfoPage>
  );
}

export function SafetyPage() {
  return (
    <InfoPage title="Safety information">
      <h2>Payments</h2>
      <p>
        All payments run through Razorpay's secure checkout. Trivara never sees or stores your card
        details.
      </p>
      <h2>Before you book</h2>
      <p>
        Check the listing's reviews, house rules, and cancellation policy. Message the host with any
        questions before booking if anything is unclear.
      </p>
      <h2>Verified hosts</h2>
      <p>
        Hosts with a "Verified" badge on their listing have completed identity verification.
        An unverified host isn't necessarily untrustworthy - it just means verification hasn't
        happened yet.
      </p>
      <h2>Report a problem</h2>
      <SupportContact />
    </InfoPage>
  );
}

export function CancellationOptionsPage() {
  return (
    <InfoPage title="Cancellation options" subtitle="Every listing uses one of three policies, set by the host.">
      <h2>Flexible</h2>
      <p>Full refund if you cancel at least 24 hours before check-in; no refund after that.</p>
      <h2>Moderate</h2>
      <p>Full refund if you cancel at least 5 days before check-in; 50% refund after that.</p>
      <h2>Strict</h2>
      <p>50% refund if you cancel at least 7 days before check-in; no refund after that.</p>
      <p>
        You can filter search results by cancellation policy, and each listing page shows which
        policy applies before you book.
      </p>
    </InfoPage>
  );
}

export function ResourcesPage() {
  return (
    <InfoPage title="Hosting resources">
      <h2>Getting started</h2>
      <p>
        New to hosting? Start with{' '}
        <Link to="/host" className="text-foreground underline underline-offset-2">
          Become a Host
        </Link>
        , then create your first listing from the{' '}
        <Link to="/host/dashboard" className="text-foreground underline underline-offset-2">
          Host Dashboard
        </Link>
        .
      </p>
      <h2>Pricing your place</h2>
      <p>
        Check what similar listings in your area charge per night before setting your price - you
        can always adjust it later by editing your listing.
      </p>
      <h2>Cancellation policy</h2>
      <p>
        Pick flexible, moderate, or strict when you create your listing - see{' '}
        <Link to="/cancellation-options" className="text-foreground underline underline-offset-2">
          Cancellation options
        </Link>{' '}
        for what each one means for a guest.
      </p>
      <h2>Getting paid</h2>
      <p>
        Add your bank details under Account →{' '}
        <Link to="/account/payment-methods" className="text-foreground underline underline-offset-2">
          Payout account
        </Link>{' '}
        so completed bookings can be paid out.
      </p>
    </InfoPage>
  );
}

export function CommunityPage() {
  return (
    <InfoPage title="Community">
      <p>
        There isn't a host community forum built yet - this page exists so the footer link isn't
        dead, not to pretend one does. In the meantime, questions go to{' '}
        <Link to="/help" className="text-foreground underline underline-offset-2">
          Help Center
        </Link>{' '}
        or directly to support.
      </p>
      <SupportContact />
    </InfoPage>
  );
}
