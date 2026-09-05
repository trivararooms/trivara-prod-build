import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';

// Rendered exactly once, in App.tsx, below every route - the footer
// equivalent of Header.tsx: one shared instance so every page gets it, not
// just the homepage. Legally/Razorpay-required links only, no full sitemap.
// Sits on the plain page canvas (never over a hero photo), so it can use
// the ordinary light-theme text tokens instead of the white-on-dark-scrim
// treatment the homepage's photo sections need.
const SIDE_PAD = 'px-[clamp(20px,4vw,48px)]';

export function Footer() {
  return (
    <footer className={`border-t border-border py-8`}>
      <div className={`w-full ${SIDE_PAD} flex flex-wrap items-center justify-between gap-6`}>
        <Logo markClassName="h-11 w-11" nameClassName="text-xl" color="hsl(var(--foreground))" />
        <div className="flex flex-wrap gap-1">
          <Link to="/privacy" className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-foreground hover:opacity-70 hover:bg-surface-2 trivara-transition">Privacy</Link>
          <Link to="/terms" className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-foreground hover:opacity-70 hover:bg-surface-2 trivara-transition">Terms</Link>
          <Link to="/help" className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-foreground hover:opacity-70 hover:bg-surface-2 trivara-transition">Talk to Us</Link>
          <Link to="/cancellation-options" className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-foreground hover:opacity-70 hover:bg-surface-2 trivara-transition">Cancellation options</Link>
        </div>
        <span className="text-xs text-text-meta">© {new Date().getFullYear()} Trivara. All rights reserved.</span>
      </div>
    </footer>
  );
}
