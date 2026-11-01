# Trivara redesign: brief

Interviewed 2026-11-01. User answers are verbatim. Where the user said "use your
judgements", the decision is marked **Authored under explicit creative delegation**.

## The interview

0. **Subject.** "redesign the entire trivara website."
   Trivara (TRIVARASTAYS) is a short-stay rentals marketplace for Karnataka: Coorg, Hampi, Gokarna and so on. It has guests, hosts, and an admin team.

1. **Vibe and references.** "oyster in my pocket, yellow by coldplay, little miss sunshine."
   Read as: a small treasure carried around casually; warm yellow devotion; a sunny, slightly ramshackle road trip in a yellow van. Warm, unpolished in a lovable way, never glossy.

2. **Scroll journey.** "use your judgements". **Authored under explicit creative delegation.**
   1. Recognition: a sunny road toward water, the trip they keep meaning to take.
   2. Ease: booking is three small moves on one wave.
   3. Peak: the water goes still, and good stays rest on the calm line.
   4. Curiosity: places to wander, one tap to filter.
   5. Control: every stay on the map, live.
   6. Warmth: hosts, the spare room with a view.
   7. Resolve: sunset, "Whenever you're ready."

3. **Energy curve.** "it should feel calm and resistance free throughout. make the website make the user book but never be pushy."
   Low energy throughout. Variation comes from feeling, not loudness. There is no urgency language, no countdowns, no scarcity badges, and one CTA label used everywhere.

4. **Feeling.** "ease, fun, travel, adventure"

5. **The one thing no other site does.** "feel relatable"
   Seeded the signature move: the sea is the visitor's own restlessness, and it visibly settles the closer they get to choosing a stay.

6. **Range.** "retro-techno-premium-minimal"
   This is a blend, not one family. Retro-techno supplies an instrument readout, expanded grotesk, a mono-ish label rhythm and hairline rules. Premium-minimal supplies air, one accent and restraint.

7. **Structure.** "freeflowing like water, but with a math to it"
   Not a worldflight, because there is no generated footage (see 8). Instead it is a new grammar, **Tide chart**: the page is one wave function. Section seams are wave paths, not straight edges, and every seam reads the same global equation. Copy anchors alternate between crest (lead) and trough (trail).

8. **Assets.** "generate using claude itself, dont use any api key."
   Every image on the marketing surfaces is hand-authored SVG and CSS, written in code. There is no kie.ai and no raster generation. This forces an illustrated world, which the brief supports anyway (retro-techno, Little Miss Sunshine van). There are no clay dioramas: the style is flat screen-print vector with grain.

**Delivery constraint (user):** "build should re-edit current files and commit locally". The redesign lives inside the existing React app, not as a standalone HTML page. It is committed on a local branch and not pushed.

## The next action

One label, everywhere: **Find a stay** (links to `/search`). The hero planner is live and feeds the map, so nobody is forced to click anything.

## Feeling curve

```
1  Ease         a yellow van idling on a coast road, sun low, layers drifting apart as you scroll
2  Fun          a sine wave draws itself under your thumb and three small stops light up on its crests
3  Calm (PEAK)  the restless sea flattens to a perfect line, the readout hits y = 0, stays rest on the horizon
4  Curiosity    tall place panels that open when touched, nothing explained, just names
5  Control      the live map answers every change in the planner
6  Warmth       a lit window on a hill, hosts addressed like neighbours
7  Resolve      sunset, the sea calm, one quiet line and one link
```

There are no adjacent duplicates. The peak (3) follows the busiest-feeling act (2, things drawing and lighting up), so stillness lands as relief.

## The peak

"The waves on the page literally go flat when you get to the stays, and it made me relax." It lives in act 3 and gets the largest span (a 220vh sticky stage), the only pin on the page.

## Tell-someone sentence

"It's the site where the sea calms down the closer you get to picking a room."

## Authored silence

- Act 3, first ~30% of its span: the wave settles with no copy on screen. This is intentional, not dead scroll.
- Act 7: no motion beyond the sun sinking. This is intentional.

## Grammar decision

**Tide chart** (new grammar).
- **Nav:** the existing minimal header pill plus a fixed tide readout, a live equation in the corner that is also the progress signal.
- **Sequence:** seams are waves; anchors alternate crest and trough; exactly one pin (the peak); no hard cuts.
- **Ending:** the sea at zero amplitude, with a text-link CTA. No button island.
- **Bans:** straight section borders on the homepage, scrubbed video, urgency or scarcity copy, counters with invented numbers, more than one pin.

Why the eight defined grammars lost:
- **Filmic one-shot:** needs scrub video; there is no footage.
- **Chaptered editorial:** too printed for "free flowing".
- **Live surface:** only partially fits; the map is live, but the brief is emotional, not a demo.
- **Continuous world:** requires worldflight footage.
- **Typographic poster:** loses "travel / adventure" imagery.
- **Gallery:** this is a booking funnel, not a catalog.
- **Split stage:** there is no two-sided argument.
- **Rhythmic cutlist:** the opposite of "calm".

## Signature move

**The settling sea.** One global function drives every wave seam on the homepage and the fixed readout:

y(x) = A(p) · sin(k·x − φ(p)), where A(p) = A₀ · (1 − smoothstep(p)) and φ = 6·p.

A is the amplitude, p is the scroll progress, and φ is the phase. Amplitude falls as you approach the stays and is exactly 0 at the peak. The readout prints the live equation in mono: `y = 0.84·sin(x − 1.92)`, falling to `y = 0 · calm`. Below the peak the amplitude rises gently again, so the sea breathes, then settles to calm at the close.
