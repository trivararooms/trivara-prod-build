import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/*
 * The Trivara tern. It flies a slow wave across the screen while the page
 * scrolls, then lands on a visible button when scrolling stops. Move the
 * cursor near it and it takes off for another perch; leave it alone and it
 * occasionally hops somewhere new.
 *
 * Perched it is the brand portrait (public/brand/tern-cutout.webp). In the
 * air it is a matching drawn pose with flapping wings, since the portrait is
 * a standing bird. Everything runs in one rAF loop writing transforms, so
 * React never re-renders while it flies. Hidden for reduced motion and on
 * working surfaces (login, admin, host tools), same as the dock.
 */

const HIDDEN_PREFIXES = ['/login', '/admin', '/host/'];

// Things worth landing on: primary actions, chips, the dock, call-to-action
// links. Any element can opt in with data-perch. The header is excluded:
// its buttons sit too close to the top edge for the bird to stand on.
const PERCH_SELECTOR = [
  '[data-perch]',
  '.btn-hard',
  '.trivara-btn-primary',
  '.tide-cta',
  '.nu-chip',
  'nav[aria-label="Quick navigation"] a',
  'button[type="submit"]',
].join(',');

const DOCK = 'nav[aria-label="Quick navigation"]';

const HEADER_BAND = 76; // px reserved by the sticky header
const SETTLE_MS = 700; // no scroll for this long: drift down and land
const IDLE_HOP_MS = 32000; // perched this long: hop to another perch
const SCARE_RADIUS = 64; // cursor this close: take off
const CUTOUT_RATIO = 756 / 1241; // tern-cutout height / width
const FEET_X = 0.72; // feet position across the perched image

// Motion. A critically damped spring never overshoots, so the bird eases
// into place instead of swinging past it and back (the old left-right
// jitter). The target itself is low-pass filtered so a flick of the scroll
// wheel bends the flight path gently instead of yanking it.
const SPRING = 0.00045; // per ms^2
const DAMPING = 2 * Math.sqrt(SPRING); // critical
const MAX_SPEED = 0.42; // px per ms (~25 px per frame at 60fps)
const TARGET_EASE_MS = 900; // how slowly the flight target follows the scroll
const TURN_MS = 520; // a full left/right turn takes this long
const TURN_HOLD_MS = 450; // must head the other way this long before turning
const TURN_MIN_SPEED = 0.06; // ignore drift slower than this when deciding to turn
const TILT_EASE_MS = 260;

type Mode = 'flying' | 'landing' | 'perched';
type Lane = 'left' | 'right';

// The middle 40% of the screen width is a no-fly zone, so the bird never
// crosses the content people are reading. It lives in the left or right
// lane, and changes sides by flying up off the top and back down.
const NO_FLY_FROM = 0.3;
const NO_FLY_TO = 0.7;
const BODY_REACH = FEET_X; // how far the body extends either side of the feet, in widths
const EDGE = 8;

function laneRange(lane: Lane, w: number): [number, number] {
  const vw = window.innerWidth;
  const reach = w * BODY_REACH;
  return lane === 'left'
    ? [reach + EDGE, vw * NO_FLY_FROM - reach]
    : [vw * NO_FLY_TO + reach, vw - reach - EDGE];
}

const laneOf = (x: number): Lane => (x < window.innerWidth / 2 ? 'left' : 'right');

// Where on this element the bird can stand without its body entering the
// no-fly zone, per lane. Null when there is no room on either side.
function perchSpots(r: DOMRect, w: number): { lane: Lane; from: number; to: number }[] {
  const spots: { lane: Lane; from: number; to: number }[] = [];
  for (const lane of ['left', 'right'] as Lane[]) {
    const [lo, hi] = laneRange(lane, w);
    const from = Math.max(lo, r.left + 10);
    const to = Math.min(hi, r.right - 10);
    if (to > from) spots.push({ lane, from, to });
  }
  return spots;
}

function visiblePerches(exclude: Element | null, w: number): HTMLElement[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return Array.from(document.querySelectorAll<HTMLElement>(PERCH_SELECTOR)).filter((el) => {
    if (el === exclude || el.closest('[role="dialog"]') || el.closest('header')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 36 || r.height < 18) return false;
    if (!(r.top > HEADER_BAND + 30 && r.top < vh - 24 && r.left > -1 && r.right < vw + 1)) return false;
    if (getComputedStyle(el).visibility === 'hidden') return false;
    return perchSpots(r, w).length > 0;
  });
}

function pickPerch(exclude: Element | null, from: { x: number; y: number }, w: number): { el: HTMLElement; x: number; lane: Lane } | null {
  const options = visiblePerches(exclude, w);
  if (!options.length) return null;
  const vh = window.innerHeight;
  const here = laneOf(from.x);
  const scored = options.map((el) => {
    const r = el.getBoundingClientRect();
    const spots = perchSpots(r, w);
    // Prefer a spot in the lane it's already in.
    const spot = spots.find((sp) => sp.lane === here) || spots[0];
    const x = spot.from + Math.random() * (spot.to - spot.from);
    const midPull = Math.abs(r.top - vh * 0.5) / vh;
    const dist = Math.hypot(x - from.x, r.top - from.y) / Math.max(window.innerWidth, vh);
    const nearPenalty = dist < 0.06 ? 1 : 0;
    const dockPenalty = el.closest(DOCK) ? 0.45 : 0;
    const crossPenalty = spot.lane !== here ? 0.5 : 0;
    return { el, x, lane: spot.lane, score: midPull + nearPenalty + dockPenalty + crossPenalty + Math.random() * 0.35 };
  });
  scored.sort((a, b) => a.score - b.score);
  const best = scored[0];
  return { el: best.el, x: best.x, lane: best.lane };
}

export function FlyingTern() {
  const { pathname } = useLocation();
  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hidden) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = rootRef.current;
    if (!root) return;

    const size = () => (window.innerWidth < 640 ? 58 : 84);
    let w = size();
    const pos = { x: -90, y: window.innerHeight * 0.3 };
    const vel = { x: 0, y: 0 };
    let mode: Mode = 'flying';
    let perch: HTMLElement | null = null;
    let perchFrac = FEET_X;
    let lane: Lane = 'left';
    let crossing = false; // flying up and over to the other lane
    let nextPerchSearch = 0; // throttles searching when nothing is perchable
    let lastScroll = performance.now();
    let perchedAt = 0;
    let facing = 1; // where it wants to face
    let facingVis = 1; // what is drawn: eases between -1 and 1 so turns are visible
    let otherWaySince = 0;
    let tilt = 0;
    const tgt = { x: pos.x + 120, y: pos.y };
    let last = performance.now();
    let frame = 0;
    const startedAt = performance.now();

    const perchPoint = () => {
      if (!perch) return null;
      const r = perch.getBoundingClientRect();
      return { x: r.left + r.width * perchFrac, y: r.top + 2 };
    };

    // A slow wave across the screen that the bird follows while scrolling.
    // A slow wave inside the current side lane, following the scroll.
    const wavePoint = () => {
      const vh = window.innerHeight;
      const t = window.scrollY / vh;
      const [lo, hi] = laneRange(lane, w);
      const mid = (lo + hi) / 2;
      const half = Math.max(0, (hi - lo) / 2);
      return {
        x: mid + half * 0.9 * Math.sin(t * 0.55 + 0.6),
        y: HEADER_BAND + 60 + (vh * 0.34) * (0.5 + 0.5 * Math.cos(t * 0.42)),
      };
    };

    // Up and off the top of the screen, still inside the lane.
    const exitPoint = () => {
      const [lo, hi] = laneRange(lane, w);
      return { x: Math.min(hi, Math.max(lo, pos.x)), y: -w * CUTOUT_RATIO - 90 };
    };

    const takeOff = () => {
      if (mode === 'perched' && perch) perch.removeAttribute('data-tern-perched');
      mode = 'flying';
      perch = null;
      vel.y -= 0.12; // a small lift off the perch
    };

    const land = (exclude: Element | null) => {
      const next = pickPerch(exclude, pos, w);
      if (!next) return false;
      perch = next.el;
      const r = next.el.getBoundingClientRect();
      perchFrac = (next.x - r.left) / r.width;
      mode = 'landing';
      if (next.lane !== lane) crossing = true;
      return true;
    };

    const onScroll = () => {
      lastScroll = performance.now();
      if (mode !== 'flying') takeOff();
    };

    const onPointer = (e: PointerEvent) => {
      if (mode !== 'perched') return;
      if (Math.hypot(e.clientX - pos.x, e.clientY - (pos.y - w * CUTOUT_RATIO * 0.5)) < SCARE_RADIUS) {
        const from = perch;
        takeOff();
        vel.x += (pos.x > e.clientX ? 1 : -1) * 0.15;
        land(from);
      }
    };

    const onResize = () => {
      w = size();
      root.style.width = `${w}px`;
    };

    const tick = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;

      let raw: { x: number; y: number } | null = null;
      if (crossing) {
        raw = exitPoint();
        // Out of sight above the page: switch lanes, then come back down.
        if (pos.y < -w * CUTOUT_RATIO - 40) {
          lane = lane === 'left' ? 'right' : 'left';
          const [lo, hi] = laneRange(lane, w);
          pos.x = lane === 'left' ? hi : lo;
          tgt.x = pos.x;
          vel.x = 0;
          crossing = false;
        }
      } else if (mode === 'flying') {
        raw = wavePoint();
        // Settle once scrolling stops (and after the opening fly-in).
        // If nothing is perchable it keeps flying its lane and looks again shortly.
        if (now - lastScroll > SETTLE_MS && now - startedAt > 2200 && now > nextPerchSearch && !land(null)) {
          nextPerchSearch = now + 700;
        }
      }
      if (!crossing && (mode === 'landing' || mode === 'perched')) {
        raw = perchPoint();
        if (!raw || !perch?.isConnected) {
          takeOff();
          raw = wavePoint();
        }
      }

      if (mode === 'perched' && raw) {
        const [plo, phi] = laneRange(lane, w);
        if (raw.x < plo || raw.x > phi) {
          takeOff();
          raw = wavePoint();
        }
      }
      if (mode === 'perched' && raw) {
        pos.x = raw.x;
        pos.y = raw.y;
        tgt.x = raw.x;
        tgt.y = raw.y;
        vel.x = 0;
        vel.y = 0;
        if (now - perchedAt > IDLE_HOP_MS) {
          const from = perch;
          takeOff();
          land(from);
        }
      } else if (raw) {
        // Ease the target toward where it should be; while landing, follow
        // the perch more closely so the bird actually arrives.
        const ease = 1 - Math.exp(-dt / (mode === 'landing' ? TARGET_EASE_MS * 0.45 : TARGET_EASE_MS));
        tgt.x += (raw.x - tgt.x) * ease;
        tgt.y += (raw.y - tgt.y) * ease;

        const ax = (tgt.x - pos.x) * SPRING - vel.x * DAMPING;
        const ay = (tgt.y - pos.y) * SPRING - vel.y * DAMPING;
        vel.x += ax * dt;
        vel.y += ay * dt;
        const speed = Math.hypot(vel.x, vel.y);
        if (speed > MAX_SPEED) {
          vel.x = (vel.x / speed) * MAX_SPEED;
          vel.y = (vel.y / speed) * MAX_SPEED;
        }
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;
        // Hard wall: the body never enters the middle band.
        const [lo, hi] = laneRange(lane, w);
        if (pos.x < lo || pos.x > hi) {
          pos.x = Math.min(hi, Math.max(lo, pos.x));
          tgt.x = Math.min(hi, Math.max(lo, tgt.x));
          vel.x = 0;
        }
        const gap = Math.hypot(raw.x - pos.x, raw.y - pos.y);
        if (mode === 'landing' && gap < 2.5 && Math.hypot(vel.x, vel.y) < 0.05) {
          mode = 'perched';
          perchedAt = now;
          perch?.setAttribute('data-tern-perched', '');
        }
      }

      // Turning: only when it has clearly been heading the other way for a
      // moment, then the flip itself is eased (it narrows and widens).
      const wantsOtherWay = Math.abs(vel.x) > TURN_MIN_SPEED && Math.sign(vel.x) !== facing;
      if (mode !== 'perched' && wantsOtherWay) {
        if (!otherWaySince) otherWaySince = now;
        if (now - otherWaySince > TURN_HOLD_MS) {
          facing = -facing;
          otherWaySince = 0;
        }
      } else {
        otherWaySince = 0;
      }
      const turnStep = (2 * dt) / TURN_MS;
      facingVis += Math.max(-turnStep, Math.min(turnStep, facing - facingVis));
      // Keep a sliver of width mid-turn so it never vanishes.
      const sx = Math.sign(facingVis || facing) * Math.max(0.18, Math.abs(facingVis));

      const wantTilt = mode === 'perched' ? 0 : Math.max(-12, Math.min(12, vel.y * 30));
      tilt += (wantTilt - tilt) * (1 - Math.exp(-dt / TILT_EASE_MS));

      const h = w * CUTOUT_RATIO;
      // Anchor = feet. The perched image's feet sit at FEET_X across, bottom.
      // The anchor slides with the turn, so turning doesn't jolt the bird sideways.
      const feetFrac = 0.5 + (FEET_X - 0.5) * Math.max(-1, Math.min(1, facingVis));
      const left = pos.x - w * feetFrac;
      const top = pos.y - h;
      root.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0) scaleX(${sx.toFixed(3)}) rotate(${(tilt * Math.sign(sx)).toFixed(2)}deg)`;
      const speedNow = Math.hypot(vel.x, vel.y);
      // Always flapping in the air: full beats when climbing or moving
      // briskly, slower beats when easing in.
      root.dataset.mode = mode === 'perched' ? 'perched' : vel.y < -0.04 || speedNow > 0.18 ? 'flying' : 'glide';

      frame = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };

    onResize();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      perch?.removeAttribute('data-tern-perched');
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [hidden, pathname]);

  if (hidden) return null;

  return (
    <div ref={rootRef} className="tern" data-mode="flying" aria-hidden="true">
      <img className="tern-perched" src="/brand/tern-cutout.webp" alt="" draggable={false} />
      <svg className="tern-flying" viewBox="0 0 120 74" aria-hidden="true">
        {/* far wing */}
        <path className="tern-wing tern-wing-back" d="M60 38 C52 22 40 9 22 2 C34 14 46 26 66 38 Z" fill="#D9DCE1" />
        {/* forked tail streamers */}
        <path d="M40 44 C28 44 14 40 2 34 C16 42 26 47 38 48 Z" fill="#F4F5F2" />
        <path d="M40 45 C28 48 14 52 3 56 C17 54 28 51 40 49 Z" fill="#F4F5F2" />
        {/* body */}
        <path d="M34 46 C40 37 58 33 76 36 C86 37 92 42 90 46 C84 52 58 54 34 46 Z" fill="#FBFBF8" />
        {/* tucked red feet */}
        <path d="M58 50 L52 55 M64 51 L59 56" stroke="#D7262E" strokeWidth="2.2" strokeLinecap="round" />
        {/* head, black cap, eye, red beak */}
        <circle cx="88" cy="37" r="8.5" fill="#FBFBF8" />
        <path d="M80 34 C82 27 92 26 97 33 C93 33 88 34 80 37 Z" fill="#111317" />
        <circle cx="91.5" cy="33.4" r="1.1" fill="#F4F5F2" />
        <path d="M95 36 L113 38.5 L95 40 Z" fill="#E1262E" />
        {/* near wing */}
        <path className="tern-wing tern-wing-front" d="M62 39 C56 22 46 8 30 0 C40 14 50 28 70 39 Z" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
