import { useEffect, type RefObject } from 'react';

/**
 * The tide engine behind the homepage's signature move: one wave function,
 *
 *   y(x) = A · sin(k·x − φ)
 *
 * shared by every wave seam on the page and printed live in the corner
 * readout. A (amplitude) falls to exactly 0 whenever a "calm anchor" (the
 * featured-stays peak and the closing sunset) sits under the middle of the
 * viewport, so the sea visibly settles as the visitor gets close to choosing
 * a stay. φ (phase) advances with scroll plus a slow drift over time.
 *
 * Everything is written straight to the DOM (path `d` attributes, a
 * `--lp` custom property, the readout's text) from a single rAF loop, so
 * React never re-renders on scroll. The loop only runs while something is
 * registered and the tab is visible.
 */

const TAU = Math.PI * 2;
const SAMPLES = 64;
const CALM_RADIUS_VH = 0.9;
const DRIFT_PER_SECOND = 0.35;
const SCROLL_PHASE_PER_VH = 1.1;

export type ProgressMode = 'travel' | 'pin' | 'exit';

export interface SeamOptions {
  /** viewBox width the path is drawn in */
  width: number;
  /** viewBox height */
  height: number;
  /** resting y of the wave's centre line, in viewBox units */
  base: number;
  /** peak amplitude at A = 1, in viewBox units */
  amp: number;
  /** full sine cycles across the width */
  cycles: number;
  /** phase offset so stacked seams don't move in lockstep */
  offset?: number;
  /** close the path to the bottom edge (a filled seam) or leave it open (a line) */
  fill?: boolean;
  /** overrides the global amplitude, e.g. the peak's own local calm-down */
  amplitude?: () => number;
}

interface Seam extends SeamOptions {
  path: SVGPathElement;
}

const seams = new Set<Seam>();
const progressEls = new Set<{ el: HTMLElement; mode: ProgressMode }>();
const calmAnchors = new Set<HTMLElement>();
const readouts = new Set<HTMLElement>();

let frame = 0;
let started = 0;
let reducedMotion = false;
let globalAmplitude = 1;
let globalPhase = 0;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function getAmplitude() {
  return globalAmplitude;
}

function computeAmplitude(vh: number) {
  if (calmAnchors.size === 0) return 1;
  const centre = vh / 2;
  let nearest = Infinity;
  calmAnchors.forEach((el) => {
    const r = el.getBoundingClientRect();
    const distance = centre < r.top ? r.top - centre : centre > r.bottom ? centre - r.bottom : 0;
    nearest = Math.min(nearest, distance / vh);
  });
  return smoothstep(0, CALM_RADIUS_VH, nearest);
}

function wavePath(seam: Seam, amplitude: number, phase: number) {
  const { width, height, base, amp, cycles, offset = 0, fill = true } = seam;
  let d = '';
  for (let i = 0; i <= SAMPLES; i++) {
    const x = (i / SAMPLES) * width;
    const y = base + amp * amplitude * Math.sin((i / SAMPLES) * cycles * TAU - phase + offset);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(2)}`;
  }
  return fill ? `${d}L${width},${height}L0,${height}Z` : d;
}

function formatReadout(amplitude: number, phase: number) {
  if (amplitude < 0.01) return 'y = 0 · calm';
  const wrapped = ((phase % TAU) + TAU) % TAU;
  return `y = ${amplitude.toFixed(2)} · sin(x − ${wrapped.toFixed(2)})`;
}

function tick(now: number) {
  frame = 0;
  if (seams.size + progressEls.size + readouts.size === 0) return;

  const vh = window.innerHeight || 1;
  const elapsed = started ? (now - started) / 1000 : 0;
  if (!started) started = now;

  globalAmplitude = computeAmplitude(vh);
  const drift = reducedMotion ? 0 : elapsed * DRIFT_PER_SECOND * globalAmplitude;
  globalPhase = (window.scrollY / vh) * SCROLL_PHASE_PER_VH + drift;

  progressEls.forEach(({ el, mode }) => {
    const r = el.getBoundingClientRect();
    const p = mode === 'pin'
      ? clamp01(-r.top / Math.max(1, r.height - vh))
      : mode === 'exit'
        ? clamp01(-r.top / Math.max(1, r.height))
        : clamp01((vh - r.top) / (r.height + vh));
    el.style.setProperty('--lp', p.toFixed(4));
  });

  seams.forEach((seam) => {
    const amplitude = reducedMotion ? 0.35 : seam.amplitude ? seam.amplitude() : globalAmplitude;
    seam.path.setAttribute('d', wavePath(seam, amplitude, globalPhase));
  });

  const text = formatReadout(globalAmplitude, globalPhase);
  readouts.forEach((el) => {
    if (el.textContent !== text) el.textContent = text;
  });

  if (!document.hidden) frame = requestAnimationFrame(tick);
}

function ensureRunning() {
  if (typeof window === 'undefined' || frame) return;
  reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  frame = requestAnimationFrame(tick);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) ensureRunning();
  });
}

function register<T>(set: Set<T>, item: T) {
  set.add(item);
  ensureRunning();
  return () => {
    set.delete(item);
  };
}

/** Drive an SVG path as a wave seam. */
export function useTideSeam(ref: RefObject<SVGPathElement>, options: SeamOptions) {
  useEffect(() => {
    if (!ref.current) return;
    return register(seams, { ...options, path: ref.current });
    // Options are static per seam; re-registering on every render would churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}

/**
 * Write the element's own scroll progress (0..1) to `--lp`.
 * `travel`: 0 when its top enters the bottom of the viewport, 1 when its
 * bottom leaves the top. `pin`: 0..1 across a sticky section's scroll room.
 * `exit`: 0 while its top is at the top of the viewport, 1 once it has fully
 * scrolled away (for the hero, which starts on screen).
 */
export function useScrollProgress(ref: RefObject<HTMLElement>, mode: ProgressMode = 'travel') {
  useEffect(() => {
    if (!ref.current) return;
    const item = { el: ref.current, mode };
    return register(progressEls, item);
  }, [ref, mode]);
}

/** Mark an element as a place where the sea goes still. */
export function useCalmAnchor(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!ref.current) return;
    return register(calmAnchors, ref.current);
  }, [ref]);
}

/** Print the live equation into an element. */
export function useTideReadout(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!ref.current) return;
    return register(readouts, ref.current);
  }, [ref]);
}

/** Local calm-down for a pinned stage: full swell at 0, flat from `flatAt` on. */
export function localCalm(el: HTMLElement | null, flatAt = 0.45) {
  if (!el) return 1;
  const lp = parseFloat(el.style.getPropertyValue('--lp') || '0');
  return 1 - smoothstep(0.04, flatAt, lp);
}
