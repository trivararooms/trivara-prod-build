import { Link } from 'react-router-dom';

interface InfoPageProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Shared shell for the footer's static content pages (Privacy, Terms, Talk
 * to Us, Cancellation options). Careers/Press/Safety/Resources/Community
 * were scrapped - they had no real content to offer and nothing linked to
 * them any more once the footer was trimmed down. About's content now lives
 * at the top of Talk to Us instead of its own separate page.
 */
export function InfoPage({ title, subtitle, children }: InfoPageProps) {
  return (
    <div className="min-h-screen bg-background">
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

export function TalkToUsPage() {
  return (
    <InfoPage title="Talk to Us" subtitle="About Trivara, common questions, and how to reach us.">
      <h2>About Trivara</h2>
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

