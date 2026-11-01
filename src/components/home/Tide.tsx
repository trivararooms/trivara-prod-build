import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatINR } from '@/lib/utils';
import type { Listing } from '@/types';
import {
  localCalm,
  useCalmAnchor,
  useScrollProgress,
  useTideSeam,
  type SeamOptions,
} from '@/lib/tide';

/*
 * Hand-drawn SVG scenes for the "Tide" homepage. Every moving value is a
 * CSS calc() off --lp, written by src/lib/tide.ts; nothing here re-renders
 * on scroll. The visual language is flat screen-print vector with grain:
 * a yellow camper on a coast road, a sun cut by retro bands, hairline seas.
 */

const SUN_BANDS = [
  { y: 52, h: 5 },
  { y: 64, h: 7 },
  { y: 78, h: 9 },
  { y: 94, h: 11 },
];

function StripedSun({ id, className, style }: { id: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <defs>
        <mask id={id}>
          <rect width="200" height="200" fill="white" />
          {SUN_BANDS.map((b) => (
            <rect key={b.y} x="0" y={100 + b.y - 52} width="200" height={b.h} fill="black" />
          ))}
        </mask>
      </defs>
      <circle cx="100" cy="100" r="96" fill="hsl(var(--accent))" mask={`url(#${id})`} />
    </svg>
  );
}

/** A filled wave seam between two sections; colour comes from `currentColor`. */
export function TideSeam({ className = '', height = 72, options }: { className?: string; height?: number; options?: Partial<SeamOptions> }) {
  const ref = useRef<SVGPathElement>(null);
  useTideSeam(ref, { width: 1440, height, base: height * 0.55, amp: height * 0.32, cycles: 2.5, fill: true, ...options });
  return (
    <div aria-hidden="true" className={`pointer-events-none relative z-10 -mb-px ${className}`}>
      <svg viewBox={`0 0 1440 ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }}>
        <path ref={ref} fill="currentColor" />
      </svg>
    </div>
  );
}

function SeaSurface({ base, amp, cycles, offset, color, stroke }: { base: number; amp: number; cycles: number; offset: number; color?: string; stroke?: string }) {
  const ref = useRef<SVGPathElement>(null);
  useTideSeam(ref, { width: 1440, height: 600, base, amp, cycles, offset, fill: !stroke });
  return stroke
    ? <path ref={ref} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    : <path ref={ref} fill={color} />;
}

/* Thin retro haze bands across the upper sky. */
function SkyBands({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMin slice" className={className} style={style} aria-hidden="true">
      {[120, 150, 176, 198, 216, 232].map((y, i) => (
        <rect key={y} x="0" y={y} width="1440" height={2 + i * 0.6} fill="hsl(var(--card))" opacity={0.55 - i * 0.06} />
      ))}
    </svg>
  );
}

/* Flat stacked-pill clouds, screen-print style. */
// Kept to the open sky: the strip under the header and the gap between the
// headline and the planner, so nothing sits on the copy.
const CLOUDS = [
  { x: 20, y: 80, w: 170 },
  { x: 560, y: 96, w: 210 },
  { x: 1300, y: 84, w: 150 },
];

function Clouds({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMin slice" className={className} style={style} aria-hidden="true">
      {CLOUDS.map(({ x, y, w }) => (
        <g key={`${x}-${y}`} fill="hsl(var(--card))">
          <rect x={x + w * 0.18} y={y} width={w * 0.5} height="26" rx="13" opacity="0.92" />
          <rect x={x} y={y + 22} width={w} height="30" rx="15" opacity="0.92" />
          <rect x={x + w * 0.32} y={y + 48} width={w * 0.56} height="18" rx="9" opacity="0.75" />
        </g>
      ))}
    </svg>
  );
}

/* A few gulls, a nod to the bird in the logo. */
const BIRDS = [
  [722, 336, 1],
  [756, 316, 0.8],
  [784, 344, 0.65],
];

function Birds({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMin slice" className={className} style={style} aria-hidden="true">
      {BIRDS.map(([x, y, k]) => (
        <path
          key={`${x}-${y}`}
          d={`M${x - 16 * k} ${y - 6 * k} Q${x - 7 * k} ${y - 12 * k} ${x} ${y} Q${x + 7 * k} ${y - 12 * k} ${x + 16 * k} ${y - 6 * k}`}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function Camper() {
  return (
    <svg viewBox="0 0 170 104" className="h-full w-full" aria-hidden="true">
      {/* roof rack + board */}
      <rect x="34" y="6" width="96" height="5" rx="2" fill="hsl(var(--foreground))" />
      <rect x="40" y="0" width="84" height="7" rx="3.5" fill="hsl(var(--sea))" />
      {/* body: white top, yellow bottom */}
      <path d="M18 14 H136 Q160 14 162 40 V72 Q162 80 154 80 H14 Q8 80 8 72 V34 Q8 14 18 14Z" fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeWidth="2.5" />
      <path d="M8 46 H162 V72 Q162 80 154 80 H14 Q8 80 8 72Z" fill="hsl(var(--accent))" stroke="hsl(var(--foreground))" strokeWidth="2.5" />
      {/* windows */}
      <rect x="20" y="22" width="26" height="18" rx="4" fill="hsl(var(--foreground))" />
      <rect x="52" y="22" width="26" height="18" rx="4" fill="hsl(var(--foreground))" />
      <rect x="84" y="22" width="26" height="18" rx="4" fill="hsl(var(--foreground))" />
      <path d="M118 22 H136 Q150 22 152 40 H118Z" fill="hsl(var(--foreground))" />
      {/* door seam + bumper + headlight */}
      <line x1="114" y1="46" x2="114" y2="78" stroke="hsl(var(--foreground))" strokeWidth="2" />
      <rect x="150" y="54" width="10" height="7" rx="3" fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeWidth="2" />
      <rect x="4" y="74" width="162" height="6" rx="3" fill="hsl(var(--foreground))" />
      {/* wheels */}
      {[42, 128].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="84" r="16" fill="hsl(var(--foreground))" />
          <circle cx={cx} cy="84" r="6" fill="hsl(var(--card))" />
        </g>
      ))}
    </svg>
  );
}

/**
 * Hero: six independent planes. Far planes cancel more of the native scroll
 * (they appear to move slower), the foreground cancels none and slightly
 * leads, so the scene separates as the visitor scrolls. The van shares the
 * road's plane (wheels stay on the road) and drives right as you leave.
 */
export function HeroScene({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useScrollProgress(ref, 'exit');
  const plane = (vh: number): React.CSSProperties => ({ transform: `translate3d(0, calc(var(--lp, 0) * ${vh}vh), 0)` });

  return (
    <section
      ref={ref}
      className="relative -mt-20 overflow-hidden pb-[34vh] pt-28 md:min-h-[100svh] md:pb-0"
      style={{ background: 'linear-gradient(180deg, hsl(40 92% 84%) 0%, hsl(var(--sky-top)) 30%, hsl(var(--sky-low)) 68%)' }}
    >
      {/* sky: haze bands, then clouds and birds, each on its own plane */}
      <SkyBands className="tide-layer inset-0 h-full" style={plane(56)} />
      <Clouds className="tide-layer inset-0 h-full" style={plane(44)} />
      <Birds className="tide-layer inset-0 h-full" style={plane(30)} />
      <StripedSun id="hero-sun" className="tide-layer !right-auto bottom-[26%] left-[40%] w-[30vw] max-w-[400px] md:left-[38%] md:bottom-[22%]" style={plane(50)} />
      {/* far hills */}
      <svg viewBox="0 0 1440 600" preserveAspectRatio="xMidYMax slice" className="tide-layer h-[46%]" style={plane(36)} aria-hidden="true">
        <path d="M0 330 C180 250 330 280 500 310 C680 240 880 220 1060 290 C1220 250 1340 270 1440 300 L1440 600 L0 600Z" fill="hsl(var(--hill-far))" />
      </svg>
      {/* near hills */}
      <svg viewBox="0 0 1440 600" preserveAspectRatio="xMidYMax slice" className="tide-layer h-[40%]" style={plane(24)} aria-hidden="true">
        <path d="M0 400 C240 340 420 380 620 410 C820 360 1010 390 1190 420 C1310 400 1390 410 1440 412 L1440 600 L0 600Z" fill="hsl(var(--hill))" />
      </svg>
      {/* sea */}
      <svg viewBox="0 0 1440 600" preserveAspectRatio="none" className="tide-layer h-[30%]" style={plane(14)} aria-hidden="true">
        <SeaSurface base={250} amp={22} cycles={4} offset={0} color="hsl(var(--sea))" />
        <SeaSurface base={330} amp={14} cycles={6} offset={1.4} stroke="hsl(0 0% 100% / 0.45)" />
        <SeaSurface base={420} amp={10} cycles={7.5} offset={2.6} stroke="hsl(0 0% 100% / 0.3)" />
      </svg>
      {/* road + van, one plane */}
      <div className="tide-layer h-[16%]" style={plane(6)}>
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d="M0 70 C420 40 980 50 1440 30 L1440 200 L0 200Z" fill="hsl(var(--land))" />
          <path d="M0 96 C420 66 980 76 1440 56" fill="none" stroke="hsl(var(--accent))" strokeWidth="3" strokeDasharray="26 22" vectorEffect="non-scaling-stroke" />
        </svg>
        <div
          className="absolute bottom-[42%] left-[22%] w-[clamp(96px,11vw,170px)]"
          style={{ transform: 'translate3d(calc(var(--lp, 0) * 38vw), 0, 0)' }}
        >
          <Camper />
        </div>
      </div>
      {/* foreground dunes + reeds lead the scroll slightly */}
      <svg viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice" className="tide-layer h-[10%]" style={plane(-4)} aria-hidden="true">
        <path d="M0 300 L0 150 C90 120 160 170 250 200 C330 225 420 240 520 300Z" fill="hsl(var(--foreground))" />
        <path d="M1440 300 L1440 120 C1360 110 1300 170 1210 205 C1130 235 1050 250 960 300Z" fill="hsl(var(--foreground))" />
        {[60, 92, 128, 1330, 1368, 1400].map((x, i) => (
          <path key={x} d={`M${x} 200 Q${x + (i % 2 ? 10 : -8)} 120 ${x + (i % 2 ? 22 : -16)} ${80 + (i % 3) * 14}`} stroke="hsl(var(--foreground))" strokeWidth="4" fill="none" strokeLinecap="round" />
        ))}
      </svg>
      <div className="tide-grain" />

      {/* copy + planner sit above the hills, below nothing */}
      <div className="relative z-10">{children}</div>
    </section>
  );
}

const STOPS = [
  { title: 'Choose a place', body: 'Search by town, or tap a destination below to see it on the map.', at: 0.18 },
  { title: 'Check the total', body: 'Cleaning and service fees are in the price before you pay. Some hosts allow Instant Book.', at: 0.3 },
  { title: 'Talk to your host', body: 'Ask about directions, food or the weather in Messages once you have booked.', at: 0.42 },
];

/** Three small moves on one wave: the line draws itself, stops light up crest, trough, crest. */
export function EaseLine() {
  const ref = useRef<HTMLElement>(null);
  useScrollProgress(ref, 'travel');
  // 1.5 cycles of -sin: crest at 1/6, trough at 1/2, crest at 5/6 of the width.
  const path = Array.from({ length: 97 }, (_, i) => {
    const x = (i / 96) * 1200;
    const y = 110 - 70 * Math.sin((i / 96) * 3 * Math.PI);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('');
  const points = [[200, 40], [600, 180], [1000, 40]];

  return (
    <section ref={ref} className="relative py-24 md:py-32">
      <div className="px-[clamp(20px,4vw,48px)]">
        <h2 className="rv max-w-[16ch] text-[clamp(2.4rem,5.4vw,4.75rem)] font-semibold leading-[0.95]">
          Booking takes a couple of minutes.
        </h2>

        <div className="relative mt-14 hidden md:block">
          <svg viewBox="0 0 1200 220" className="w-full overflow-visible" aria-hidden="true">
            <path d={path} fill="none" stroke="hsl(var(--foreground) / 0.12)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <path
              d={path}
              pathLength={1}
              fill="none"
              stroke="hsl(var(--foreground))"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="1"
              className="tide-draw"
              style={{ strokeDashoffset: 'calc(1 - min(1, max(0, (var(--lp, 0) - 0.12) * 3.2)))' } as React.CSSProperties}
            />
            {points.map(([cx, cy], i) => (
              <g key={cx} className="tide-fade" style={{ opacity: `calc((var(--lp, 0) - ${STOPS[i].at}) * 8)` }}>
                <circle cx={cx} cy={cy} r="15" fill="hsl(var(--accent))" stroke="hsl(var(--foreground))" strokeWidth="2.5" />
              </g>
            ))}
          </svg>
        </div>

        <ol className="mt-10 grid gap-10 md:mt-6 md:grid-cols-3 md:gap-8">
          {STOPS.map((s) => (
            <li
              key={s.title}
              className="tide-fade max-w-[34ch] md:justify-self-center"
              style={{ opacity: `calc((var(--lp, 0) - ${s.at}) * 8)` }}
            >
              <span aria-hidden="true" className="mb-3 block h-3 w-3 rounded-full border-2 border-foreground bg-accent md:hidden" />
              <h3 className="text-2xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-text-secondary">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CalmLine({ stageRef, base, amp, cycles, offset, stroke, width = 2 }: { stageRef: React.RefObject<HTMLElement>; base: number; amp: number; cycles: number; offset: number; stroke: string; width?: number }) {
  const ref = useRef<SVGPathElement>(null);
  useTideSeam(ref, { width: 1440, height: 400, base, amp, cycles, offset, fill: false, amplitude: () => localCalm(stageRef.current) });
  return <path ref={ref} fill="none" stroke={stroke} strokeWidth={width} vectorEffect="non-scaling-stroke" />;
}

function CalmSea({ stageRef }: { stageRef: React.RefObject<HTMLElement> }) {
  const ref = useRef<SVGPathElement>(null);
  useTideSeam(ref, { width: 1440, height: 400, base: 60, amp: 46, cycles: 2.5, offset: 0.4, fill: true, amplitude: () => localCalm(stageRef.current) });
  return <path ref={ref} fill="hsl(var(--sea-deep))" />;
}


/* Illustrated fallbacks, used when no stays are featured yet. */
const PLACE_CARDS = [
  {
    city: 'Coorg',
    line: 'Coffee hills and mist',
    art: (
      <>
        <rect width="200" height="150" fill="hsl(var(--sky-low))" />
        <path d="M0 90 C50 50 110 60 200 80 V150 H0Z" fill="hsl(var(--hill))" />
        <path d="M0 120 C60 90 130 100 200 110 V150 H0Z" fill="hsl(var(--land))" />
        {[96, 106, 116, 126].map((y) => (
          <path key={y} d={`M0 ${y + 14} C60 ${y - 14} 130 ${y - 4} 200 ${y + 6}`} stroke="hsl(var(--hill))" strokeWidth="2" fill="none" />
        ))}
      </>
    ),
  },
  {
    city: 'Hampi',
    line: 'Boulders at golden hour',
    art: (
      <>
        <rect width="200" height="150" fill="hsl(var(--sky-top))" />
        <circle cx="150" cy="52" r="22" fill="hsl(var(--accent))" />
        <ellipse cx="60" cy="116" rx="54" ry="34" fill="hsl(28 30% 52%)" />
        <ellipse cx="128" cy="124" rx="40" ry="26" fill="hsl(28 26% 42%)" />
        <ellipse cx="96" cy="84" rx="26" ry="20" fill="hsl(28 30% 58%)" />
        <rect y="138" width="200" height="12" fill="hsl(var(--land))" />
      </>
    ),
  },
  {
    city: 'Gokarna',
    line: 'Quiet beaches, long walks',
    art: (
      <>
        <rect width="200" height="150" fill="hsl(var(--sky-low))" />
        <rect y="78" width="200" height="40" fill="hsl(var(--sea))" />
        <path d="M0 112 C70 100 140 108 200 98 V150 H0Z" fill="hsl(42 60% 78%)" />
        <path d="M150 128 Q146 92 156 64" stroke="hsl(var(--foreground))" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M156 64 q-22 -4 -34 8 M156 64 q20 -10 34 0 M156 64 q-6 -18 -22 -22 M156 64 q12 -14 28 -12" stroke="hsl(var(--land))" strokeWidth="5" fill="none" strokeLinecap="round" />
      </>
    ),
  },
];

const CARD_TILTS = ['-rotate-[4deg]', 'rotate-[2deg]', '-rotate-[1deg]'];

function Postcard({ to, image, art, kicker, title, price, tilt }: { to: string; image?: string; art?: ReactNode; kicker: string; title: string; price?: string; tilt: string }) {
  return (
    <Link
      to={to}
      className={`group block w-[min(13rem,44vw)] shrink-0 rounded-[12px] border-2 border-foreground bg-card p-2.5 pb-3 shadow-[var(--hard)] transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-[var(--hard-lg)] lg:w-[clamp(10rem,13vw,13.5rem)] ${tilt}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[6px] border-2 border-foreground bg-surface-2">
        {image ? (
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <svg viewBox="0 0 200 150" className="h-full w-full" aria-hidden="true">{art}</svg>
        )}
        {price && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full border border-foreground bg-accent px-2 py-0.5 font-ui text-[11px] font-bold text-accent-foreground">
            {price}
          </span>
        )}
      </div>
      <span className="label-tech mt-2.5 block truncate text-text-meta">{kicker}</span>
      <span className="mt-1 block truncate font-ui text-[15px] font-semibold leading-tight" style={{ fontStretch: '108%' }}>{title}</span>
    </Link>
  );
}

/**
 * Three postcards that drift in and settle on the horizon once the sea is
 * calm: the featured stays when there are any, otherwise three places.
 */
function PeakPostcards({ listings, from }: { listings: Listing[]; from: number }) {
  const cards = listings.length > 0
    ? listings.slice(0, 3).map((l) => ({
        key: l.id,
        to: `/listing/${l.id}`,
        image: l.photos[0],
        kicker: l.location.city,
        title: l.title,
        price: `${formatINR(l.pricePerNight)} / night`,
      }))
    : PLACE_CARDS.map((p) => ({
        key: p.city,
        to: `/search?location=${encodeURIComponent(p.city)}`,
        art: p.art,
        kicker: p.city,
        title: p.line,
      }));

  return (
    <div className="relative z-20 mt-8 flex gap-3 overflow-x-auto px-[clamp(20px,4vw,48px)] pb-4 pt-2 scrollbar-hide lg:absolute lg:bottom-[33%] lg:right-[clamp(20px,4vw,48px)] lg:mt-0 lg:items-end lg:gap-0 lg:overflow-visible lg:p-0">
      {cards.map((c, i) => (
        <div
          key={c.key}
          className={`tide-fade ${i > 0 ? 'lg:-ml-6' : ''} ${i === 1 ? 'lg:mb-10' : ''}`}
          style={{
            opacity: `calc((var(--lp, 0) - ${from + i * 0.06}) * 6)`,
            transform: `translate3d(0, calc(max(0, ${from + i * 0.06 + 0.16} - var(--lp, 0)) * 160px), 0)`,
          }}
        >
          <Postcard {...c} tilt={CARD_TILTS[i % CARD_TILTS.length]} />
        </div>
      ))}
    </div>
  );
}

/**
 * The peak. The only pinned stage on the page. The swell settles over the
 * first ~45% of its scroll room with nothing else on screen (authored
 * silence), then the sun's reflection and the line arrive on a flat sea.
 */
export function CalmPeak({ title, subtitle, postcards = [], children }: { title: ReactNode; subtitle?: ReactNode; postcards?: Listing[]; children?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const calmRef = useRef<HTMLDivElement>(null);
  useScrollProgress(ref, 'pin');
  useCalmAnchor(calmRef);
  const late = (from: number): React.CSSProperties => ({
    opacity: `calc((var(--lp, 0) - ${from}) * 5)`,
    transform: `translate3d(0, calc(max(0, ${from + 0.2} - var(--lp, 0)) * 120px), 0)`,
  });

  return (
    <section ref={ref} className="relative h-[220vh] motion-reduce:h-auto" aria-label="A calm moment">
      <div ref={calmRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 top-[38%]" />
      <div
        className="sticky top-0 flex h-[100svh] flex-col overflow-hidden motion-reduce:relative motion-reduce:h-[90vh]"
        style={{ background: 'linear-gradient(180deg, hsl(var(--sky-low)) 0%, hsl(var(--sky-top)) 58%)' }}
      >
        <StripedSun id="peak-sun" className="absolute bottom-[38%] left-1/2 w-[min(38vw,360px)] -translate-x-1/2" />
        <div className="absolute inset-x-0 bottom-0 h-[44%]">
          <svg viewBox="0 0 1440 400" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <CalmSea stageRef={ref} />
            <CalmLine stageRef={ref} base={130} amp={30} cycles={4} offset={1.1} stroke="hsl(0 0% 100% / 0.35)" />
            <CalmLine stageRef={ref} base={210} amp={22} cycles={5.5} offset={2.3} stroke="hsl(0 0% 100% / 0.25)" />
            <CalmLine stageRef={ref} base={300} amp={16} cycles={7} offset={3.1} stroke="hsl(0 0% 100% / 0.18)" />
          </svg>
          {/* reflection: the sun's bands laid on the flat water */}
          {/* centring lives on the wrapper so the reduced-motion reset (transform: none on .tide-fade) can't shift it */}
          <div className="absolute left-1/2 top-[24%] w-[min(30vw,300px)] -translate-x-1/2" aria-hidden="true">
            <div className="tide-fade flex flex-col items-center gap-[10px]" style={{ opacity: 'calc((var(--lp, 0) - 0.42) * 4)' }}>
              {[100, 78, 56, 36, 20].map((w) => (
                <span key={w} className="block h-[5px] rounded-full bg-accent" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        </div>
        <div className="tide-grain" />

        <div className="relative z-10 mt-[16vh] px-[clamp(20px,4vw,48px)] lg:max-w-[58%]">
          <h2 className="tide-fade max-w-[19ch] text-[clamp(2.4rem,4.6vw,4.5rem)] font-semibold leading-[0.95]" style={late(0.45)}>
            {title}
          </h2>
          {subtitle && (
            <p className="tide-fade mt-5 max-w-[38ch] text-lg text-text-secondary" style={late(0.5)}>{subtitle}</p>
          )}
          {children && <div className="tide-fade mt-6" style={late(0.55)}>{children}</div>}
        </div>
        <PeakPostcards listings={postcards} from={0.52} />
      </div>
    </section>
  );
}

/** Host: a lit window on a hill. Replaced by the admin's host photo when one is set. */
export function HostScene({ photo }: { photo?: string | null }) {
  if (photo) {
    return <img src={photo} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-[var(--radius)] border-2 border-foreground object-cover shadow-[var(--hard-lg)]" />;
  }
  return (
    <svg viewBox="0 0 480 360" className="w-full rounded-[var(--radius)] border-2 border-foreground shadow-[var(--hard-lg)]" aria-hidden="true">
      <rect width="480" height="360" fill="hsl(var(--sea-deep))" />
      <circle cx="380" cy="80" r="34" fill="hsl(var(--card))" />
      {[[60, 50], [130, 96], [220, 40], [300, 120], [440, 170], [40, 150]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="hsl(var(--card))" opacity="0.7" />
      ))}
      <path d="M0 260 C120 200 260 190 480 240 L480 360 L0 360Z" fill="hsl(var(--hill))" />
      <path d="M0 300 C160 270 320 280 480 300 L480 360 L0 360Z" fill="hsl(var(--land))" />
      {/* house */}
      <path d="M180 230 L240 186 L300 230 V262 H180Z" fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeWidth="3" />
      <path d="M168 234 L240 178 L312 234" fill="none" stroke="hsl(var(--foreground))" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="204" y="222" width="28" height="22" rx="2" fill="hsl(var(--accent))" stroke="hsl(var(--foreground))" strokeWidth="2.5" />
      <rect x="250" y="226" width="22" height="36" rx="2" fill="hsl(var(--foreground))" />
      <path d="M218 244 L180 300 L270 300 L232 244Z" fill="hsl(var(--accent))" opacity="0.18" />
      {/* tree */}
      <rect x="338" y="214" width="6" height="40" fill="hsl(var(--foreground))" />
      <circle cx="341" cy="204" r="24" fill="hsl(var(--land))" stroke="hsl(var(--foreground))" strokeWidth="3" />
    </svg>
  );
}

/**
 * Close: the sun sinks into a sea that has gone still again. One line, one
 * text link. Holds; nothing fades out.
 */
export function SunsetClose({ line, cta }: { line: ReactNode; cta: { to: string; label: string } }) {
  const ref = useRef<HTMLElement>(null);
  const calmRef = useRef<HTMLDivElement>(null);
  useScrollProgress(ref, 'travel');
  useCalmAnchor(calmRef);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[92vh] flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, hsl(36 80% 86%) 0%, hsl(var(--sky-top)) 55%)' }}
    >
      <div ref={calmRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 top-[30%]" />
      <div className="relative z-10 px-[clamp(20px,4vw,48px)] pt-[16vh] md:ml-auto md:max-w-[52%] md:text-right">
        <h2 className="rv text-[clamp(2.6rem,6vw,5.5rem)] font-semibold leading-[0.95]">{line}</h2>
        <Link to={cta.to} className="tide-cta rv mt-6 inline-block font-ui text-xl font-semibold" style={{ fontStretch: '112%' }}>
          {cta.label}
        </Link>
      </div>
      <div className="relative mt-auto h-[46vh]">
        <StripedSun
          id="close-sun"
          className="absolute bottom-[38%] left-[18%] w-[min(40vw,380px)]"
          style={{ transform: 'translate3d(0, calc(var(--lp, 0) * 18vh), 0)' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-[42%] bg-sea-deep" />
        <div className="absolute inset-x-0 bottom-[42%] h-[2px] bg-foreground/80" />
      </div>
      <div className="tide-grain" />
    </section>
  );
}
