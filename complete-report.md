# Trivara UI Audit — Complete Report

Source: `trivara_ui_audit.md` ("UI Blind Spots & Gaps vs. Other OTAs"), plus follow-up scope the user
added mid-session (Instant Book/Request to Book, calendar-based pricing, Account settings/Notifications,
price/commission/payout/cancellation/abandoned-payment/blackout-date fixes).

Branch: `worktree-ui-audit-fixes` (PR opened against `main`). This file is also committed directly to
`main` per the user's request, since the code changes themselves go through review on the branch/PR
first rather than merging directly.

---

## Part 1 — Things that looked real but weren't (all fixed)

- **Cancellation policy now shown on the listing page**, with a "Learn more" link to a new
  `/cancellation-options` page explaining all three tiers.
- **All 10 dead footer links are real pages now**: Help Center, Safety information, Cancellation
  options, Resources, Community, About, Careers, Press, Privacy, Terms. Content is honest — where
  something isn't built (e.g. a community forum), the page says so instead of pretending.
- **Account page's "Coming soon" badges are gone** — Account settings and Notifications are real,
  working pages now (see Part 2).
- **Host Dashboard's stale "coming soon" footer copy removed** (payouts/booking management were
  already live).
- **`ReviewCard`/`ReviewsList` are wired in** — the listing page no longer reimplements review
  rendering inline; the dead components are dead no more.
- **"Payment methods" renamed to "Payout account"** everywhere a guest could confuse it with how
  they pay for bookings.
- **Map view is real** — Leaflet + OpenStreetMap (no API key needed), plotting actual listing
  coordinates, replacing the "disabled" placeholder.
- **Copyright year is computed**, not hardcoded to 2024.

## Part 2 — Previously missing vs. other OTAs (shipped)

**Trust & communication**
- **Host-guest messaging**: real `conversations`/`messages` tables with RLS, a "Message host" composer
  on the listing page, a `/messages` inbox (works for both guest and host), live updates via Supabase
  Realtime, and an unread badge in the header nav.
- **Host verified badge** on the listing page, using the existing `profiles.is_verified` column.
  (Response rate/time were *not* faked — there's no data backing them yet; see Limitations.)
- **Guest identity shown to host** — Host Dashboard's booking list now shows the guest's real name
  instead of the literal word "Guest".

**Discovery & search**
- **Sort control**: price low↔high, top rated, newest.
- **Real date-availability filtering** — search previously ignored check-in/check-out entirely; now a
  listing with a conflicting confirmed/completed booking is actually excluded.
- **Flexible-date search** (±3/±7 days), built on top of the real availability filtering above.
- **Guest breakdown** (adults/children/infants) in both the search bar and the listing page — infants
  don't count against a listing's max-guest capacity. A "bringing a pet?" toggle warns if the listing
  isn't marked pet-friendly.
- **Accessibility filters** (step-free access, wide doorways, accessible bathroom) and a **pet-friendly**
  amenity, selectable by hosts in Create Listing and filterable in Search.
- **Similar stays** section on the listing page (same city, falls back to same property type).

**Listing page**
- **Photo lightbox** — full-screen gallery with "Show all N photos", arrow navigation, and a photo
  counter.
- **Review breakdown by category** — cleanliness/accuracy/communication/value/location, each an
  optional 1–5 score alongside the existing overall rating (which stays the single source of truth
  for `listings.rating`).
- **Share listing** — native share sheet where available, clipboard-copy fallback otherwise.
- **Instant Book vs. Request to Book** — hosts choose per listing; guests see which applies before
  booking; a Request-to-Book flow requires host approval before any payment is attempted (details
  below).

**Booking & after booking**
- **Booking confirmation/itinerary page** (`/bookings/:id/confirmation`) with a reference number and a
  print-friendly receipt (browser print-to-PDF), linked from Trips and from the payment-success path.
- **Calendar-based price view** — hosts can set custom per-date pricing; the listing page's calendar
  shows upcoming custom-priced date ranges, and the price guests are actually charged reflects those
  overrides (not just a cosmetic label).

**Platform-level**
- Multi-currency, multi-language, a live-chat vendor widget, and a loyalty/referral program were
  **not** built — see Limitations for why.

---

## Additional scope added mid-session

### Instant Book vs. Request to Book (full flow)
- `listings.instant_book` (default `true`, so every existing listing keeps today's behavior).
- Request-to-Book: booking is created as `pending` (no payment attempted) → host **Approve**/**Decline**
  in Host Dashboard → approval moves it to `pending_payment` via a new `approve_booking_request()`
  RPC (the one transition existing RLS didn't already allow) → guest completes payment from Trips.
- Guests can now see `pending`/`pending_payment` bookings in Trips at all (previously invisible),
  with **Pay now** / **Withdraw request** / **Cancel** actions as appropriate.

### Calendar/blackout date management (new host page)
- `/host/listings/:id/calendar` — hosts can block off dates for personal use, and set custom pricing
  for date ranges. Both read into `availabilityService` so they actually affect what guests see and
  are charged, not just a display.

### Account settings & Notifications (real, not "Coming soon")
- `/account/settings`: edit name, phone, bio, avatar (upload to a new `avatars` storage bucket) —
  restricted to exactly the columns the existing `profiles` UPDATE grant permits.
- `/account/notifications`: email preferences (booking updates / messages / marketing), backed by a
  new `notification_preferences` table. The booking-confirmation and booking-cancellation email
  functions now actually check `email_booking_updates` before sending to each recipient.

### Backend bugs found and fixed (via an investigation pass + a live integration-test pass)
- **Commission mismatch (real bug)**: `bookingService.getStats()` computed host earnings assuming a
  15% platform fee; the actual fee charged by `create_host_earnings_on_completion()` is 18%. Account
  page showed a different "total earnings" number than Host Dashboard for the same host. Fixed by
  removing the incorrect computation and having both pages read `host_earnings` (the real 18%-fee
  source of truth) via `earningsService`.
- **Cancellation policy never enforced at refund time (real bug, matches the original audit)**:
  `refund-razorpay-payment` always refunded 100%, regardless of the listing's cancellation policy or
  how close to check-in the cancellation happened. Fixed to compute the actual refund % from the
  policy (flexible/moderate/strict) and days-until-check-in, matching the copy shown to guests on the
  listing page.
- **Abandoned payments (real gap)**: a booking stuck in `pending`/`pending_payment` (checkout modal
  closed, or a request never approved) had no cleanup and was invisible to the guest. Fixed with an
  hourly cron job that cancels rows stuck in that state for 48+ hours, plus the Trips UI changes above
  so a guest isn't stuck waiting on nothing.
- **Blackout-date/price-override RLS gap (found by the test pass below, fixed same session)**: the
  first version of these policies checked that a row's own `host_id` column matched the caller, but
  never confirmed that `host_id` actually owns `listing_id` — letting any authenticated user plant
  blackout dates or price overrides on a listing they don't own. Fixed to also require
  `listings.host_id = auth.uid()`.
- **Price calculation, admin payout approval**: investigated, found correct as-is — no changes made.

---

## How this was tested

- `tsc --noEmit`, `npm run lint`, `npm run build`, and the existing `vitest` unit suite all pass clean.
- A local Supabase stack (`supabase start`) was spun up and every migration (through the three new
  ones added this session) applied cleanly from a fresh `supabase db reset`.
- **Browser-based UI click-through was not possible in this session** — this is a headless background
  job with no Chrome extension connected, so the interactive browser-automation tool was unavailable.
  In its place, a ~40-assertion integration-test script exercised the real local Postgres/Supabase
  instance directly (as two real authenticated users, plus a deliberate third "eavesdropper" account)
  covering: listing creation/publish, the `promote_host_on_publish` trigger, Instant Book and
  Request-to-Book booking creation, the `approve_booking_request` RPC (and confirming a guest *cannot*
  call it on their own booking, nor self-approve via a plain update), the no-overlapping-bookings DB
  constraint, guest-identity visibility to hosts, messaging (send/reply, the `UNIQUE` per-listing
  conversation constraint, the third-party eavesdrop attempt correctly seeing zero rows), reviews with
  category ratings (and the `refresh_listing_rating` trigger, the duplicate-review constraint, an
  out-of-range category rating rejection), the 18% commission figure, blackout dates and price
  overrides (including the RLS gap above, which this pass is what actually caught), notification
  preferences privacy, the profile-update column restriction (and that a guest cannot self-promote to
  admin), the refund-percentage math for all three cancellation policies, and the abandoned-booking
  cron function. All 40 checks pass after the RLS fix above.
- What this does **not** cover: actually clicking through the React UI in a real browser, and the real
  Razorpay payment flow (no live Razorpay sandbox credentials are available in this environment —
  `create-razorpay-order`/`refund-razorpay-payment` were exercised only up to that external-API
  boundary; payment success was simulated directly in the database, the same way the real webhook
  would flip a booking to `confirmed`).

---

## Known limitations / deliberately not built

- **Multi-currency & multi-language** — not built. This needs a product decision (which FX-rate source
  to trust for currency conversion, which i18n library and who writes/maintains translated content)
  that's out of scope for a bug-fix-and-gap-filling pass to decide unilaterally.
- **Live chat / help-desk widget** — not built. The in-app messaging system now gives guests and hosts
  a real contact channel, and the Help Center page is real, but a live-agent chat widget means picking
  and paying for a vendor (Intercom, Crisp, etc.) — a business decision, not an engineering one.
- **Loyalty / rewards / referral program** — not built. Needs real business rules (point formulas,
  tiers, budget) that no one has specified yet.
- **Host response rate / response time** — not shown, and not faked. There's no data to back these
  numbers yet (they'd need to be computed from message reply times, which the new messaging system
  could support later, but doesn't track yet). Showing them now would just be the exact "looks real
  but isn't" problem this whole audit is about.
- **Listing coordinates are still hardcoded** to one fixed lat/lng in `CreateListing.tsx` (a
  pre-existing gap, not introduced here) — the map component is real and will plot real coordinates
  once real geocoding is wired up, but until then every listing's pin lands in the same spot.
- **Calendar-based pricing is a list, not an inline calendar overlay** — the listing page shows
  upcoming custom-priced date ranges as text ("Dec 24–26: ₹15,000/night") above the calendar rather
  than coloring/annotating individual calendar cells. The pricing itself is real and affects what a
  guest is charged; the presentation is the simpler of two reasonable options.
- **Payment/SMTP integrations need real credentials to fully verify** — Razorpay and SMTP are both
  feature-flagged off by default (`app_settings`) in a fresh environment; this session verified the
  code paths up to where they'd call out to those real services, not the services themselves.
