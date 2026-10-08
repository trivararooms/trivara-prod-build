import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';

// Rendered exactly once, in App.tsx, below every route - the footer
// equivalent of Header.tsx: one shared instance so every page gets it, not
// just the homepage. Legally/Razorpay-required links only, no full sitemap.
// Sits on the plain page canvas (never over a hero photo), so it can use
// the ordinary theme text tokens. Bottom padding clears the floating dock.
const SIDE_PAD = 'px-[clamp(20px,4vw,48px)]';
const linkClass = 'rounded-full px-4 py-2 font-ui text-xs font-semibold text-foreground/80 transition-all duration-200 hover:bg-foreground/10 hover:text-foreground';

export function Footer() {
  return (
    <footer className="border-t border-border pb-32 pt-10">
      <div className={`flex w-full flex-wrap items-center justify-between gap-6 ${SIDE_PAD}`}>
        <Logo markClassName="h-10 w-10" nameClassName="text-lg" />
        <div className="flex flex-wrap gap-1">
          <Link to="/privacy" className={linkClass}>Privacy</Link>
          <Link to="/terms" className={linkClass}>Terms</Link>
          <Link to="/help" className={linkClass}>Talk to Us</Link>
          <Link to="/cancellation-options" className={linkClass}>Cancellation options</Link>
        </div>
        <span className="text-xs text-text-meta">© {new Date().getFullYear()} Trivara. All rights reserved.</span>
      </div>
    </footer>
  );
}
