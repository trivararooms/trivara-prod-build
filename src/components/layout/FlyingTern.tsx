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
const SETTLE_MS = 380; // no scroll for this long: go and land
const IDLE_HOP_MS = 18000; // perched this long: hop to another perch
const SCARE_RADIUS = 70; // cursor this close: take off
const CUTOUT_RATIO = 756 / 1241; // tern-cutout height / width
const FEET_X = 0.72; // feet position across the perched image
const SPRING = 0.0032; // per ms^2
const DAMPING = 0.0062; // per ms

type Mode = 'flying' | 'landing' | 'perched';

function visiblePerches(exclude: Element | null): HTMLElement[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return Array.from(document.querySelectorAll<HTMLElement>(PERCH_SELECTOR)).filter((el) => {
    if (el === exclude || el.closest('[role="dialog"]') || el.closest('header')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 36 || r.height < 18) return false;
    return r.top > HEADER_BAND + 30 && r.top < vh - 24 && r.left > 8 && r.right < vw - 8 && getComputedStyle(el).visibility !== 'hidden';
  });
}

function pickPerch(exclude: Element | null, from: { x: number; y: number }): HTMLElement | null {
  const options = visiblePerches(exclude);
  if (!options.length) return null;
  // Prefer something mid-screen and not right next to where it is now,
  // with a little randomness so it doesn't always pick the same button.
  const vh = window.innerHeight;
  const scored = options.map((el) => {
    const r = el.getBoundingClientRect();
    const midPull = Math.abs(r.top - vh * 0.5) / vh;
    const dist = Math.hypot(r.left + r.width / 2 - from.x, r.top - from.y) / Math.max(window.innerWidth, vh);
    const nearPenalty = dist < 0.08 ? 1 : 0;
    // The dock is always on screen; prefer buttons in the page itself.
    const dockPenalty = el.closest(DOCK) ? 0.45 : 0;
    return { el, score: midPull + nearPenalty + dockPenalty + Math.random() * 0.35 };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0].el;
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
    const pos = { x: -80, y: window.innerHeight * 0.3 };
    const vel = { x: 0, y: 0 };
    let mode: Mode = 'flying';
    let perch: HTMLElement | null = null;
    let perchFrac = FEET_X;
    let lastScroll = performance.now();
    let perchedAt = 0;
    let facing = 1;
    let last = performance.now();
    let frame = 0;
    const startedAt = performance.now();

    const perchPoint = () => {
      if (!perch) return null;
      const r = perch.getBoundingClientRect();
      return { x: r.left + r.width * perchFrac, y: r.top + 2 };
    };

    // A slow wave across the screen that the bird follows while scrolling.
    const wavePoint = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const t = window.scrollY / vh;
      return {
        x: vw * (0.5 + 0.34 * Math.sin(t * 1.15 + 0.6)),
        y: HEADER_BAND + 40 + (vh * 0.42) * (0.5 + 0.5 * Math.cos(t * 0.8)),
      };
    };

    const takeOff = () => {
      if (mode === 'perched' && perch) perch.removeAttribute('data-tern-perched');
      mode = 'flying';
      perch = null;
      vel.y -= 0.35; // a little hop up
    };

    const land = (exclude: Element | null) => {
      const next = pickPerch(exclude, pos);
      if (!next) return false;
      perch = next;
      perchFrac = 0.28 + Math.random() * 0.5;
      mode = 'landing';
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
        vel.x += (pos.x > e.clientX ? 1 : -1) * 0.5;
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

      let target: { x: number; y: number } | null = null;
      if (mode === 'flying') {
        target = wavePoint();
        // Settle once scrolling stops (and after the opening fly-in).
        if (now - lastScroll > SETTLE_MS && now - startedAt > 1400) land(null);
      }
      if (mode === 'landing' || mode === 'perched') {
        target = perchPoint();
        if (!target || !perch?.isConnected) {
          takeOff();
          target = wavePoint();
        }
      }

      if (mode === 'perched' && target) {
        pos.x = target.x;
        pos.y = target.y;
        vel.x = 0;
        vel.y = 0;
        if (now - perchedAt > IDLE_HOP_MS) {
          const from = perch;
          takeOff();
          land(from);
        }
      } else if (target) {
        // Damped spring toward the target.
        const ax = (target.x - pos.x) * SPRING - vel.x * DAMPING;
        const ay = (target.y - pos.y) * SPRING - vel.y * DAMPING;
        vel.x += ax * dt;
        vel.y += ay * dt;
        const speed = Math.hypot(vel.x, vel.y);
        const max = 1.25;
        if (speed > max) {
          vel.x = (vel.x / speed) * max;
          vel.y = (vel.y / speed) * max;
        }
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;
        if (mode === 'landing' && Math.hypot(target.x - pos.x, target.y - pos.y) < 4 && speed < 0.12) {
          mode = 'perched';
          perchedAt = now;
          perch?.setAttribute('data-tern-perched', '');
        }
      }

      if (Math.abs(vel.x) > 0.05) facing = vel.x >= 0 ? 1 : -1;
      const tilt = mode === 'perched' ? 0 : Math.max(-22, Math.min(22, vel.y * 26));
      const h = w * CUTOUT_RATIO;
      // Anchor = feet. The perched image's feet sit at FEET_X across, bottom.
      const left = pos.x - (facing === 1 ? w * FEET_X : w * (1 - FEET_X));
      const top = pos.y - h;
      root.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0) scaleX(${facing}) rotate(${(tilt * facing).toFixed(1)}deg)`;
      root.dataset.mode = mode === 'perched' ? 'perched' : Math.abs(vel.y) < 0.08 && mode === 'landing' ? 'glide' : 'flying';

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
