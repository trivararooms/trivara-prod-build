# Fingerprints

Every site you build with **scroll-craft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|
| trivara (2026-11-01) | Tide chart (new): page is one wave function, seams are waves, anchors alternate crest/trough, one pin | Existing floating header pill + fixed corner readout printing the live equation | Six independent SVG planes (striped sun, far/near hills, live sea, road + van on one plane, foreground dunes) with grain; live planner on top | flow hero, line-draw (3 stops), single pin peak (220vh, calm-down), flow featured/destinations/map/host, flow close; ~7 beats, ~6.2 viewport-heights at 1440x900 | Sunset over a flat sea, one line + underlined text link, holds | The settling sea: global A falls to 0 near calm anchors, readout prints `y = A · sin(x − φ)` down to `y = 0 · calm` | Flat screen-print vector, retro-techno, sunshine yellow on paper | React app route `/` (vite) |

---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

- **Tide chart** grammar, wave-function seams driven by one global amplitude.
- Fixed equation readout as nav/progress chrome.
- Striped retro sun as a recurring motif (hero, peak, close).
- "Settling sea" signature: amplitude to zero at calm anchors.
- Close as text-link over a flat horizon.

---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scroll-craft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.
