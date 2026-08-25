# Trivara — architecture, what changed, and what's next

This document does two things: explains how the app is put together, and
records what this refactor pass changed and what's still left to do. It
replaces the scattered `*_FIX.md`/`*_FIX.sql`/`TODO.md` files that used to
sit at the repo root as the single place to start — those files have been
moved into `deprecated/` (safe to delete entirely; nothing reads them).
Going forward, whenever a fix changes the architecture or setup, update this
file and/or `README.md` in place rather than adding another one-off file.

## What Trivara is

Trivara is a short-term rental marketplace — an Airbnb-style app for the
Indian market. Guests search listings, book stays, and pay through Razorpay;
hosts create listings, manage bookings, and request payouts of their
earnings; an admin can see platform-wide stats, approve payouts, and
configure the Razorpay/SMTP integration. The project was originally
scaffolded and largely built through Lovable (an AI app builder) and
deployed on Vercel, which explains some of the surrounding tooling
(`lovable-tagger` in `vite.config.ts`, the Lovable-branded `README.md`).

## Tech stack

- **Frontend**: React 18 + TypeScript, built with Vite, styled with
  Tailwind CSS and shadcn/ui (Radix primitives under `src/components/ui`).
  Routing via `react-router-dom`, data fetching via direct Supabase calls
  (no React Query usage despite it being installed — see Next steps).
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions). There
  is no separate application server; the browser talks to Postgres directly
  through the Supabase client, protected by Row Level Security (RLS)
  policies and a handful of `SECURITY DEFINER` RPC functions for anything
  that needs server-side validation (payouts, admin stats, profile
  creation).
- **Payments**: Razorpay. Order creation and webhook signature verification
  happen server-side in Supabase Edge Functions
  (`supabase/functions/create-razorpay-order`,
  `supabase/functions/razorpay-webhook`) so the client never sets its own
  charge amount.
- **Email**: Supabase Edge Functions using SMTP directly
  (`sendBookingConfirmationEmail`, `sendBookingCancellationEmail`,
  `sendPayoutRequestEmail`), configurable through the `app_settings` table
  via the admin settings page.

## Repository structure

```
src/
  pages/                 One file per route (see App.tsx for the route table)
    host/                Host-only pages: BecomeHost, CreateListing, HostDashboard, HostEarnings
    admin/                Admin-only pages: AdminSettings (AdminDashboard.tsx lives one level up)
  components/
    ui/                  shadcn/ui primitives (generated, mostly untouched)
    layout/Header.tsx    Site-wide nav, user menu
    listings/            ListingCard, ListingGrid
    reviews/             ReviewCard, ReviewsList (review submission itself lives in Trips.tsx)
    search/SearchBar.tsx
  services/              All Supabase access lives here, one class per table/domain
  lib/
    supabase.ts          Supabase client instance
    mappers.ts           snake_case (DB) <-> camelCase (frontend) conversions (new - see below)
    errors.ts            getErrorMessage() helper for catch blocks (new)
    adminAccess.ts        Shared admin-email check (new)
    utils.ts             toDateOnly, formatINR, cn (Tailwind class merge)
  context/AuthContext.tsx Supabase session + profile, exposed via useAuth()
  types/index.ts          Shared domain types (Listing, Booking, Review, etc.)
supabase/
  functions/              Edge Functions (Deno) - Razorpay + email
  migrations/             Canonical DB schema - see supabase/migrations/README.md
deprecated/               Superseded schema dumps, one-off fix files, old scripts - see README.md.
                          Nothing here is read by the app; safe to delete the whole folder.
```

## Data model

Six tables carry the app: `profiles` (one per auth user; `role` is
`guest`/`host`/`admin`, `is_host` is a separate boolean flipped on first
published listing), `listings`, `bookings` (status flows
`pending`/`pending_payment` → `confirmed` → `completed`/`cancelled`,
`end_date` is exclusive so a checkout day can be a new booking's check-in
day), `reviews` (one row per booking, a single 1-5 rating, no per-category
breakdown despite what an earlier UI assumed), `host_earnings` (created
automatically when a booking completes, one row per booking, 18% platform
fee), and `payout_requests` / `host_bank_accounts` (a host requests a payout
of their pending earnings; an admin approves it). `app_settings` holds
Razorpay/SMTP configuration, editable from `/admin/dashboard/settings`.

The full, current schema — with every column, constraint, RLS policy, and
trigger function — is in
`supabase/migrations/00000000000001_consolidated_baseline.sql`. Read
`supabase/migrations/README.md` alongside it: it documents every place the
old, scattered migration files disagreed with each other or with the
running frontend code, and which version was kept and why.

## Key flows

- **Auth**: Google OAuth only (no separate signup form — `/login` is the
  single entry point for new and returning users). `handle_new_user()`
  creates a `profiles` row on signup; `AuthContext` loads the session and
  that profile on mount and on every auth state change.
- **Browsing/search**: `Index.tsx` shows featured listings and popular
  destinations; `Search.tsx` does server-side filtering for simple fields
  (guests, price, rating) and client-side filtering for JSONB/array fields
  (location text, amenities, property type, cancellation policy), capped at
  200 rows when those complex filters are active to avoid pulling the whole
  table.
- **Booking**: `ListingDetail.tsx` calculates pricing, checks date
  conflicts against existing confirmed/completed bookings, creates the
  booking as `pending_payment` (if Razorpay is enabled in `app_settings`) or
  `confirmed` directly, then — for the payment case — opens Razorpay
  Checkout client-side while the actual order was already created
  server-side. The `razorpay-webhook` function is what actually flips the
  booking to `confirmed` on `payment.captured`, not the client.
- **Reviews**: only reachable from `Trips.tsx` (past bookings tab) — a
  simple 1-5 star rating + optional comment, tied to a completed booking.
- **Hosting**: `CreateListing.tsx` is a multi-step wizard that autosaves a
  draft every 1.5s; `publishListing()` flips `status` to `published`, and a
  Postgres trigger (`promote_host_on_publish`) promotes the user's profile
  to `is_host = true` — this used to be a no-op referenced only in a code
  comment (see "What was fixed" below).
- **Earnings/payouts**: `host_earnings` rows are created by a database
  trigger when a booking completes (not by the client, to avoid the
  duplicate-earnings bug the old code had to patch after the fact). A host
  requests a payout via the `request_payout_by_booking` RPC, which validates
  the amount server-side against `host_earnings` rather than trusting a
  client-supplied number. An admin approves via `approve_payout_request`.
- **Admin**: `/admin/dashboard` is gated by both a hardcoded admin email
  (`src/lib/adminAccess.ts`, UX shortcut only) and the database-enforced
  `role = 'admin'` check (the real gate). Shows platform stats via the
  `admin_dashboard_stats` RPC and lets the admin mark payouts as paid.

## What was fixed in this pass

This was a genuine bug-fixing and cleanup pass, not just a lint pass. In
rough order of severity:

1. **Reviews were completely broken against the real schema.** The only
   reachable review-submission code path (`reviewService.createReview`,
   called from `Trips.tsx`) inserted `guest_id`/`host_id` columns that don't
   exist in the `reviews` table (it's `reviewer_id`/`reviewee_id`) — every
   review submission would have failed with a Postgres error. Fixed, and
   the unreachable, differently-broken code path (`ReviewForm.tsx` /
   `reviewService.create()`, which assumed a `cleanliness`/`accuracy`/etc.
   column breakdown that was never in the schema) was deleted rather than
   also patched, since nothing rendered it.
2. **`ReviewsList.tsx` called async service methods without `await` and
   rendered the resulting `Promise` directly** — `reviews.length` and
   `reviews.map(...)` on a `Promise` object throws immediately, so any
   listing detail page with reviews would have crashed on render. Rewritten
   to actually load the data into state.
3. **`host_earnings.listing_title` was always "Unknown Property"** — the
   Supabase `select()` never actually joined `listings(title)` despite the
   code trying to read `earning.listings?.title`. Fixed the join.
4. **A ReferenceError in the "edit listing" save path** —
   `CreateListing.tsx` destructured `urlId` from `useParams` but the submit
   handler referenced an undefined variable `id`; saving changes to an
   existing listing would have thrown at runtime. Fixed (and a related
   `l.published` reference to a field that doesn't exist on the `Listing`
   type).
5. **Four broken in-app links**: "Saved" and "Sign up" in the header menu
   pointed at routes that don't exist and features that were never built;
   "Become a Host" and "Manage Bookings" on the Account page pointed at
   `/host/become-host` and `/host/manage-bookings` instead of the real
   routes (`/host`, `/host/dashboard`). The calendar-management button on
   the host dashboard pointed at a route that also doesn't exist and has
   been removed rather than left dangling.
6. **A live Supabase project URL and anon key were committed in plaintext**
   in `SETUP_INSTRUCTIONS.md`/`SUPABASE_CONNECTION_INSTRUCTIONS.md`. Removed
   and replaced with placeholders; **the exposed key should be rotated** in
   the Supabase dashboard since it's in git history regardless (see the
   Security section below).
7. **RLS/security holes closed at the database level** (see
   `supabase/migrations/README.md` for full detail): any user could update
   their own `profiles.role` to `'admin'`; a host could rewrite a booking's
   `total_price`/dates on any booking they were party to; a host could
   insert a `payout_requests` row directly with an arbitrary amount,
   bypassing the server-side balance check entirely; `admin_dashboard_stats`
   was originally callable by unauthenticated (`anon`) requests.
8. **`promote_host_on_publish` and `refresh_listing_rating` triggers were
   referenced/assumed but never actually created anywhere** — publishing a
   listing never promoted the user to host at the database level (the
   frontend had this logic commented out, believing the DB handled it), and
   `listings.rating`/`review_count` were permanently stuck at 0 regardless
   of real reviews. Both are now real triggers.
9. **~40 scattered SQL files** (3 full schema dumps, ~8 root-level
   `*_FIX.sql` files, 27 files under `migrations/`, several of them pure
   diagnostics) **consolidated into one canonical, idempotent migration**
   (`supabase/migrations/00000000000001_consolidated_baseline.sql`),
   verified end-to-end against a scratch Postgres instance. The old files
   are left in place but marked superseded.
10. **Code quality**: extracted the snake_case/camelCase mapping logic that
    was copy-pasted 15+ times across `listingService`/`bookingService`/
    `reviewService` into `src/lib/mappers.ts`; removed all `any` types in
    favor of real types or an `unknown` + `getErrorMessage()` pattern (64
    lint errors → 0); removed dead code (`src/services/authService.ts`,
    `src/components/NavLink.tsx`, both entirely unused); fixed a
    `require()`-style import in `tailwind.config.ts`; added a basic Vitest
    suite (`npm test`) covering the new mapper and utility functions (16
    tests); fixed a shared-global bug in `CounterInput.tsx` where double-tap
    detection used a single `window.lastTap` shared across every counter
    input on the page instead of one per instance.
11. **Admin pages (`AdminSettings.tsx`, `AdminDashboard.tsx`) could get stuck
    on their loading spinner forever.** Both had their own separate  
    hardcoded-email admin check inside a `useEffect`, duplicating the
    DB-backed `role === 'admin'` check `<ProtectedRoute requiredRole="admin">`
    already enforces upstream. When the two disagreed, the effect called
    `navigate("/")` without ever calling `fetchSettings()`/`fetchData()` -
    and since `loading` only cleared inside those functions, the page never
    actually redirected, it just spun forever. Removed the duplicate check
    from both files; they now rely solely on `ProtectedRoute` + RLS.
12. **A blank page in the Docker build** was `docker-compose.yml` reading
    `VITE_SUPABASE_URL`/etc. as build args from a `.env` file that didn't
    exist next to it - all four came through empty, `supabase-js` threw on
    startup, and React never mounted. Separately, the `.env` that *did*
    exist (for local `npm run dev`) had `VITE_SUPABASE_URL` set to the
    `/rest/v1/` REST path instead of the bare project URL, which breaks
    every request `supabase-js` makes (auth included). Both fixed.
13. **"record new has no field updated_at" on listing creation, and Razorpay
    payments doing nothing even with a test key set.** Root cause for both:
    the live database was built up from the loose `deprecated/*.sql` files
    over time, not from the consolidated migration, so it's missing pieces
    newer code assumes exist - some table has an `update_..._updated_at`
    trigger without the column it writes to, and the `app_settings` table
    (which is where Razorpay/SMTP config actually lives, not `.env` -
    `VITE_RAZORPAY_KEY_ID` is unused by any frontend code) didn't exist at
    all. `deprecated/FIX_LISTING_AND_RAZORPAY_SETTINGS.sql` patches both
    idempotently (auto-detects and fixes any table missing `updated_at` for
    its trigger; creates `app_settings` + `get_app_setting`/
    `update_app_setting` + `is_admin()` + seed rows) and has been run. See
    "Admin access" in `README.md` for where to actually enter Razorpay keys
    now that the table exists.
14. **The same "stuck on loading forever" bug, audited across every page and
    fixed everywhere it actually occurred.** Two distinct root causes,
    both now a settled pattern (`authLoading` spinner → `!user` →
    `<Navigate>` → data-loading spinner → content, top to bottom, in that
    order, on every page that gates on auth):
    - A data-fetching `useEffect` early-returning (`if (!user?.id) return;`)
      *before* ever setting `loading`/calling the function whose `finally`
      clears it, on a route not wrapped in `<ProtectedRoute>`. Confirmed
      reachable (not just theoretical) on **`Trips.tsx`** - a logged-out
      visitor hitting `/trips` directly got stuck forever, because the
      `if (!user)` redirect further down the render was unreachable: the
      `if (loading)` spinner check above it never resolved. Also hardened
      `host/HostDashboard.tsx` the same way even though it's
      `<ProtectedRoute>`-wrapped (defense in depth), and `ListingDetail.tsx`
      for the `!id` case (same shape, different guard).
    - A react-query `useQuery` with `enabled: !!user?.id`, gated on
      `.isPending` with no `authLoading`/`!user` check first. `isPending`
      stays `true` forever for a *disabled* query - it never runs, so it
      never settles to success/error. Fixed on **`PaymentMethods.tsx`**
      (also removed a now-redundant imperative `navigate('/login')` effect
      in favor of a declarative `<Navigate>`, same as the pattern below) and
      defensively on `host/HostEarnings.tsx`. `Account.tsx`/`Saved.tsx`
      already had the correct order from an earlier pass;
      `admin/AdminSettings.tsx`/`AdminDashboard.tsx` were fixed in the
      previous pass (a *different* root cause - a duplicate hardcoded-email
      check disagreeing with `<ProtectedRoute>`, not this one).
    Audited and confirmed clean (no gated `loading`/`isPending` full-page
    return without a preceding auth check): `Index.tsx` (unconditional
    fetch, no auth), `Search.tsx` (no `enabled` gate; the one query that
    does use `enabled` correctly guards it: `isExploring && isPending`),
    `Login.tsx` (never gates the page, redirect is a background effect only).
    `host/CreateListing.tsx`'s `isLoading` never gets permanently stuck
    (unconditional `finally`), so it wasn't touched.
15. **The loading issue kept recurring after #14 - on reload, on browser
    back, and on direct links - because #14 fixed how pages react to
    `authLoading`, not why `authLoading` itself could get stuck.** Two
    causes at the root, both underneath every page at once (which is why it
    wasn't isolated to one page):
    - `AuthContext`'s `getInitialSession()` calls `supabase.auth.getSession()`
      once on every mount - i.e. on every hard reload. `supabase-js` v2
      coordinates token refresh across tabs via the Web Locks API; if that
      lock is left in a bad state (a crashed/throttled tab, certain private-
      browsing restrictions), `getSession()` can hang instead of rejecting,
      which left `loading` (and therefore every page gated on it) stuck
      forever. Now raced against an 8s timeout - if it fires, the app
      proceeds as logged-out immediately, and the independent
      `onAuthStateChange` subscription still corrects `user`/`session`/
      `profile` on its own once the real auth state comes through.
    - `nginx.conf` had no explicit cache header on `index.html`. Its default
      caching meant a browser could hold onto an old `index.html` across a
      Docker rebuild, which references that old build's content-hashed JS
      filenames - files that no longer exist in the new image once rebuilt,
      so they 404 and React never mounts. Looks identical to "stuck
      loading" from the outside, worse on reload/back (more likely to hit
      the cached copy) and on direct links (no in-app navigation to trigger
      a fresh fetch of anything). Fixed: `index.html` is now
      `no-cache, no-store, must-revalidate`; the hashed asset files
      underneath keep their long-lived immutable cache, since their
      filename is exactly what changes when their content does.

16. **`/admin` 404'd, and there was no in-app way to reach the admin pages
    short of typing the URL.** Added `<Route path="/admin" element={<Navigate
    to="/admin/dashboard" replace />} />` in `App.tsx`. Added "Admin
    dashboard"/"Admin settings" items to the user menu in `Header.tsx`,
    shown whenever `profile?.role === 'admin'` - and while touching that
    file, removed a redundant second `profileService.getByUserId()` fetch
    Header was doing on every single render just to read `is_host`, since
    `AuthContext`'s own `profile` already has both `is_host` and `role`.
17. **`vercel.json` had no cache headers - only `nginx.conf` (used by the
    local Docker build) got the `index.html` no-cache fix in #15.** The
    production site on Vercel is a completely separate deploy path from the
    Docker/nginx setup used for local testing, so it needed the equivalent
    fix independently. Added the same "index.html always revalidates,
    hashed assets cache forever" split to `vercel.json`'s `headers`.
    **Important: none of this session's fixes (this one included) are live
    on the production domain yet** - the app auto-deploys from `main` on
    push, and nothing has been pushed. Everything so far has only been
    verified in the local Docker build.

Everything above was verified with `npx tsc --noEmit`, `npm run lint`
(0 errors), `npm run build` (succeeds), and `npm test` (16/16 passing) after
the change.

## What's next

Roughly in priority order:

1. **Apply the consolidated migration and rotate credentials — partially
   done.** The live database was built from the old `deprecated/*.sql`
   files, not this migration; rather than run the full ~1000-line
   `00000000000001_consolidated_baseline.sql` against a database that
   already has real data (untested combination), only the pieces that were
   actually missing and blocking things (`app_settings` + its RPCs, the
   `updated_at` fix) were applied via `deprecated/FIX_LISTING_AND_RAZORPAY_SETTINGS.sql`,
   plus `00000000000002_saved_listings_and_scheduled_jobs.sql` in full.
   Still open: diff the rest of the consolidated baseline (RLS policies,
   other triggers/RPCs) against what's actually live, table by table, rather
   than assuming it all matches. Also still open: rotate the Supabase anon
   key that was previously committed to this repo's git history, and
   confirm `SUPABASE_SERVICE_ROLE_KEY` has never been committed anywhere
   (it hasn't been found in this checkout, but check your Supabase
   project's audit log to be sure).
2. **Open product questions from `supabase/migrations/README.md` — partially
   resolved.** A refund via the actual Razorpay API is now wired up: see
   `supabase/functions/refund-razorpay-payment` (calls Razorpay's Refunds API,
   then updates `payment_status`/`refund_id`/`refund_amount`/`refunded_at` in
   one place), called from `bookingService.cancelBooking()` whenever a
   booking was actually paid for. It needs `supabase functions deploy
   refund-razorpay-payment` to go live — until then, cancelling a *paid*
   booking returns an error asking the guest to contact support instead of
   silently skipping the refund (cancelling an unpaid/pending booking is
   unaffected and works immediately). Still open: whether the admin
   dashboard should use the bank-detail-masking RPC instead of reading raw
   account numbers, whether payout rejection needs a workflow (currently only
   pending → paid exists), and whether booking completions/cancellations
   should be audit-logged alongside payout approvals.
3. **"Saved listings" — done.** `supabase/migrations/00000000000002_saved_listings_and_scheduled_jobs.sql`
   adds a `saved_listings` table with RLS (a user can only see/insert/delete
   their own rows). `src/services/savedListingsService.ts` +
   `src/hooks/useSavedListingIds.ts` back the heart button on `ListingCard`
   (now a real per-user toggle instead of local `useState`, prompts sign-in
   if the visitor isn't logged in) and a new `/saved` page, linked back from
   the header's "Saved" menu item.
4. **Client-side `autoCompletePastBookings()` polling — replaced.** The same
   migration adds `auto_complete_past_bookings()` (SQL function, not exposed
   over the API) scheduled hourly via `pg_cron`. `bookingService
   .autoCompletePastBookings()` and its call sites in `Trips.tsx`/
   `HostDashboard.tsx` have been removed. Requires the `pg_cron` extension
   enabled on the project (the migration attempts `CREATE EXTENSION IF NOT
   EXISTS pg_cron`; if that errors on permissions, enable it via Database →
   Extensions in the dashboard first).
5. **Lint warnings — done.** All 15 warnings (`react-hooks/exhaustive-deps`
   and shadcn-ui `react-refresh/only-export-components`) are fixed; `npm run
   lint` is clean.
6. **Bundle size — done.** Route-level code-splitting (`React.lazy` +
   `Suspense` in `App.tsx`) plus vendor chunk splitting
   (`vite.config.ts`'s `manualChunks`) brought the single ~780KB entry chunk
   down to ~160KB, with React/Supabase/Radix/forms/query each in their own
   cacheable chunk. No more chunk-size warning from the build.
7. **React Query — partially adopted.** `PaymentMethods.tsx`,
   `HostEarnings.tsx`, `Account.tsx`, and `Search.tsx` now use
   `useQuery`/`useMutation` instead of hand-rolled `useState`/`useEffect`
   fetching. Still hand-rolled: `Trips.tsx`, `host/HostDashboard.tsx`,
   `admin/AdminSettings.tsx`, and `host/CreateListing.tsx`'s data-loading
   effect (its autosave logic is intentionally left alone). `ListingDetail.tsx`
   (drives the live booking/payment flow) and `AdminDashboard.tsx` (real-time
   Supabase subscriptions) were deliberately left as-is — converting either
   carries real regression risk for comparatively little payoff.
8. **Testing beyond the basics added here.** The new Vitest suite covers
   pure utility/mapper functions only. The service layer (`bookingService`,
   `listingService`, etc.) talks directly to the Supabase client and would
   need either a mocked Supabase client or an integration test against a
   local Supabase instance to test meaningfully.

## Security note

Because a real Supabase anon key was committed to this repository's history,
treat it as public even after removal from the working tree — `git log`
still has it. Rotating it (Supabase dashboard → Settings → API →
"Generate new anon key") is cheap insurance; RLS is what actually protects
data, but there's no reason to leave a real key sitting in history once
you've noticed it.
