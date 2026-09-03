# Database migrations — read this first

## TL;DR

**`00000000000001_consolidated_baseline.sql`** is the single, canonical source
of truth for the database schema going forward. It has been tested end-to-end
(schema creation, idempotent re-run, signup → profile, listing publish → host
promotion, booking → completion → earnings, review → rating aggregation,
payout request/approval RPCs, and RLS/security enforcement) against a local
Postgres 16 instance with a stub `auth` schema.

`00000000000002_saved_listings_and_scheduled_jobs.sql` (saved listings +
the pg_cron auto-complete job), `00000000000003_storage_bucket.sql` (the
`listing-photos` storage bucket + its RLS policies, previously only ever
created by hand in the dashboard), `00000000000004_payout_rejection_and_audit.sql`
(a `reject_payout_request()` RPC, and audit logging extended to payout
rejections and booking completions/cancellations), `00000000000005_messaging_and_review_categories.sql`
(host-guest `conversations`/`messages` + per-category review ratings),
`00000000000006_booking_requests_pricing_and_settings.sql` (Instant Book vs.
Request to Book, host-managed blackout dates + per-date price overrides,
notification preferences, and an abandoned-booking cleanup job), and
`00000000000007_avatars_bucket.sql` (the `avatars` storage bucket for Account
Settings) build on top of it. `00000000000010_commission_engine.sql` replaces
the hardcoded 18% platform fee with a configurable one: 3 default global
tiers keyed by a host's trailing 30-day revenue (admin sets the thresholds
and rates), overridable per host or per property - see the file header for
the exact precedence. **To stand up a brand new project from zero** — e.g.
after a project is deleted — run every migration file in this directory, in
filename order, in the new project's SQL editor; nothing else needs to be
created by hand in the database. Razorpay/SMTP config still needs to be
entered through the Admin Settings page (or `update_app_setting`) afterward
— the baseline only seeds disabled, blank placeholder rows for those.

Every other `*.sql` file in this repo — now moved into `deprecated/` and
`deprecated/migrations/` — is **historical and superseded**. They are kept
for reference/audit purposes but should not be run against a new project,
and no new fixes should be added to them (the whole `deprecated/` folder is
safe to delete; nothing reads it). All future schema changes should be new
files added to `supabase/migrations/` (the standard Supabase CLI migrations
directory) that build on top of the consolidated baseline.

## Superseded files

`deprecated/` — root-level schema dumps (each was a full, slightly-different
snapshot of the same schema at different points in time):
- `database_schema.sql`
- `final_database_schema.sql`
- `updated_database_schema.sql`
- `SUPABASE_SCHEMA_FIX.sql`
- `SUPABASE_COLUMNS_FIX.sql`
- `SUPABASE_LOGIN_FIX.sql`
- `SUPABASE_PAYOUT_FIX.sql`
- `FIX_PAYOUT_UPDATED_AT.sql`

`deprecated/migrations/*.sql` (one-off fixes, diagnostics, and hardening
passes applied over time, in roughly the order they were written):
- `add_is_host_column.sql`
- `add_updated_at_to_bookings.sql`
- `add_guests_column_to_bookings.sql`
- `add_host_earnings_table.sql`
- `add_missing_columns_and_fix_rls.sql`
- `add_approve_payout_request_function.sql`
- `backfill_missing_host_earnings.sql`
- `create_admin_dashboard_stats_function.sql`
- `create_host_earnings_trigger.sql`
- `create_profile_on_auth_user.sql`
- `CRITICAL_security_fixes.sql`
- `debug_admin_stats.sql` *(pure diagnostic, dropped entirely)*
- `diagnose_data.sql` *(pure diagnostic, dropped entirely)*
- `diagnose_earnings_mismatch.sql` *(pure diagnostic, dropped entirely)*
- `ensure_booking_status_consistency.sql`
- `ensure_profile_existence_for_booking.sql`
- `fix_duplicate_payouts.sql`
- `fix_host_booking_cancellation.sql`
- `fix_payout_requests_host_bank_accounts_relationship.sql`
- `fix_profiles_and_bookings_schema.sql`
- `fix_rls_policies.sql`
- `fix_rls_policies_for_profile_creation.sql`
- `grant_permissions_for_admin_dashboard_stats.sql`
- `production_hardening.sql`
- `razorpay_integration_schema.sql`
- `secure_payout_logic.sql`
- `verify_earnings_fix.sql` *(pure diagnostic, dropped entirely)*

(`migrations/diagnose_admin_stats.sql` was listed in the task brief but does
not exist in this checkout — confirmed via `ls migrations/`.)

## What's in the consolidated file, section by section

1. **Extensions** — `pgcrypto` (for `gen_random_uuid()`), `btree_gist` (for
   the booking-overlap exclusion constraint).
2. **Tables** — `profiles`, `listings`, `bookings`, `reviews`, `host_earnings`,
   `payout_requests`, `host_bank_accounts`, `app_settings`, `audit_log`, with
   the final column set, types, defaults, and CHECK constraints.
3. **Indexes** — every real (non-diagnostic) index from the historical files,
   plus the two uniqueness constraints that fix known duplicate-data bugs:
   `host_earnings.booking_id` UNIQUE, and one-pending-payout-per-host.
4. **`update_updated_at_column()`** generic trigger, wired to every table with
   an `updated_at` column.
5. **Auth/profile provisioning** — `handle_new_user()` trigger on
   `auth.users`, `ensure_profile_exists()` RPC, and an `is_admin()` helper
   used throughout the RLS policies.
6. **`promote_host_on_publish()`** — a trigger that didn't actually exist
   anywhere before (see judgment calls below).
7. **Host earnings automation** — `create_host_earnings_on_completion()`
   trigger + one-time backfill for pre-existing completed bookings.
8. **`refresh_listing_rating()`** — a trigger that didn't exist before (see
   judgment calls below); keeps `listings.rating`/`review_count` in sync with
   the `reviews` table.
9. **Payout RPCs** — `request_payout_by_booking()` (server-side balance
   validation) and `approve_payout_request()` (admin-only, advisory-locked,
   syncs `host_earnings`).
10. **`admin_dashboard_stats()`** — admin-only aggregate stats RPC.
11. **App settings RPCs** — `get_app_setting()` (non-secrets only) and
    `update_app_setting()` (admin-only).
12. **Admin tools** — `get_bank_details_for_payout()` (masked bank details)
    and `process_booking_refund()` (admin-only refund bookkeeping).
13. **Audit logging** — `log_payout_approval()` trigger writing to
    `audit_log` whenever a payout flips to `paid`.
14. **Table-level GRANTs + RLS policies** — every table has RLS enabled with
    a complete policy set; see judgment calls below for the security
    tightening done here relative to the historical files.
15. **Seed data** — `app_settings` rows for `razorpay_*` and `smtp_*` keys,
    with `razorpay_enabled = 'false'` so a fresh deploy is safe by default.

## Judgment calls made when historical files conflicted

- **Table name: `bank_accounts` vs `host_bank_accounts`.** Every schema dump
  (`database_schema.sql` etc.) defines `bank_accounts` with a `user_id`
  column. But the actual shipping frontend
  (`src/pages/PaymentMethods.tsx`, `src/pages/AdminDashboard.tsx`) reads and
  writes `host_bank_accounts` with a `host_id` column exclusively — a rename
  introduced by `fix_payout_requests_host_bank_accounts_relationship.sql` and
  never reflected back into the schema dumps. **Went with `host_bank_accounts`**
  since the running app code is ground truth.
- **`profiles.role` default: `'user'` vs `'guest'`.** Standardized on
  `'guest'` with a `CHECK (role IN ('guest','host','admin'))`, matching
  `src/services/profileService.ts` and the later migration files, per the
  task brief.
- **`promote_host_on_publish` trigger never actually existed.**
  `src/services/listingService.ts` has a comment claiming "this is now
  handled by the PostgreSQL trigger promote_host_on_publish," but no such
  trigger was defined in any of the 27 migration files or 3 schema dumps —
  it was an abandoned dead end (the actual promotion code was commented out
  in the same function). **Implemented it for real**: a listing transitioning
  to `published = true` promotes its host's profile (`is_host = true`,
  `role` upgraded from `guest` to `host`, never downgraded).
- **`listings.rating` / `review_count` were never kept in sync with `reviews`.**
  No historical file ever added a trigger to recompute these from actual
  review rows — they're set to `0` on insert and never touched again, even
  though `ListingCard.tsx` and `Search.tsx` render `listing.rating` directly.
  **Added `refresh_listing_rating()`** as a genuine additive fix (not present
  in any prior file) so ratings actually reflect submitted reviews.
- **`reviews` schema: simple vs. granular columns.** Per the task brief, kept
  the simple 4-field version (`reviewer_id`, `reviewee_id`, `rating`,
  `comment`) matching `final_database_schema.sql`/`database_schema.sql` and
  the live `reviewService.createReview()` code path, and deliberately did
  **not** add the `cleanliness`/`accuracy`/`communication`/`location`/
  `checkIn`/`value` columns referenced only by the dead `reviewService.create()`
  path — the frontend fix for that is out of scope here (being done in
  parallel by another engineer, per the task brief).
- **`profiles.full_name`.** `AdminDashboard.tsx` selects
  `.select('id, full_name, role')` from `profiles`, but no column named
  `full_name` exists anywhere in any schema file — only `first_name`/
  `last_name`. Rather than leave that query permanently broken (or invent a
  column nothing else writes to), added `full_name` as a `GENERATED ALWAYS
  ... STORED` column derived from `first_name`/`last_name`, so it always
  stays correct without a separate write path.
- **Role/`is_host` privilege escalation hole, closed.** Every historical
  version of the `profiles` UPDATE policy was
  `FOR UPDATE USING (auth.uid() = id)` with **no column restriction**, which
  means any logged-in user could call `.from('profiles').update({role:
  'admin'})` on their own row and grant themselves admin. `profileService
  .updateRole()`/`.setIsHost()` are unused dead code today, but the RLS hole
  was real. **Fixed** by revoking blanket `UPDATE` from `authenticated` and
  granting `UPDATE` only on the non-privileged columns (`first_name`,
  `last_name`, `phone`, `avatar_url`, `bio`, `updated_at`); `role`/`is_host`
  can now only change via the `SECURITY DEFINER` trigger functions.
- **Bookings UPDATE policy was dangerously broad, tightened.**
  `fix_host_booking_cancellation.sql` added
  `"Users can update own bookings" FOR UPDATE USING (guest_id = auth.uid() OR
  host_id = auth.uid())` with **no `WITH CHECK` and no column restriction** —
  meaning a guest or host could rewrite `total_price`, dates, or even
  `host_id`/`guest_id` on any booking they were party to. **Fixed** the same
  way as profiles: column-level `GRANT UPDATE (status, cancelled_at)` only,
  plus separate guest/host policies that only allow
  `pending`/`pending_payment`/`confirmed` → `cancelled`/`completed`
  transitions (the `completed` transition is needed because
  `bookingService.autoCompletePastBookings()` is triggered client-side from
  both `Trips.tsx` and `HostDashboard.tsx`).
- **Direct `payout_requests` INSERT policy removed — this was a real bypass
  of the payout security work.** `CRITICAL_security_fixes.sql` added
  `"Hosts can insert own payout requests" WITH CHECK (auth.uid() = host_id)`,
  which let a host `INSERT` a `payout_requests` row directly with **any
  `amount` of their choosing** — completely defeating the point of
  `secure_payout_logic.sql`'s `request_payout_by_booking()` RPC, which
  computes the payout amount server-side from `host_earnings`. **Removed
  that policy entirely**; there is now no `INSERT` grant for
  `authenticated`/`anon` on `payout_requests` at all — every payout request
  must go through the RPC (which is `SECURITY DEFINER` and therefore
  unaffected by the missing grant).
- **`admin_dashboard_stats()` was originally callable by `anon`.**
  `create_admin_dashboard_stats_function.sql`'s first version had no admin
  check inside the function body and was `GRANT`ed to `anon`, exposing
  platform revenue/booking counts to unauthenticated requests.
  `CRITICAL_security_fixes.sql` fixed this later; the consolidated file keeps
  the fixed (admin-checked, `authenticated`-only) version.
- **`payment_status` allowed values conflicted between two files.**
  `razorpay_integration_schema.sql` used
  `('pending', 'paid', 'failed', 'refunded')`; `production_hardening.sql`
  used `('pending', 'processing', 'succeeded', 'failed', 'refunded')`. Cross-
  checked against `supabase/functions/razorpay-webhook/index.ts` (the actual
  code that writes this column) and confirmed only `'pending'`, `'paid'`,
  `'failed'` are ever written, plus `'refunded'` from `process_booking_refund`.
  **Went with `('pending', 'paid', 'failed', 'refunded')`.**
- **Dropped genuinely unused speculative columns.** `production_hardening.sql`
  added `payment_intent_id`/`payment_captured_at` on `bookings` and
  `transfer_id`/`transfer_status`/`transfer_completed_at`/
  `transfer_failure_reason` on `payout_requests` — Stripe-Connect-style
  columns that no code (frontend or edge function) ever reads or writes; the
  actual Razorpay integration uses `razorpay_order_id`/`razorpay_payment_id`/
  `razorpay_signature` and `payout_requests.status` instead. Treated these as
  abandoned dead ends and dropped them, per the task brief's instruction to
  drop abandoned dead ends.
- **Booking default status changed from `'confirmed'` to `'pending'`.** Every
  schema dump defaulted `bookings.status` to `'confirmed'`, a fail-*open*
  default (any insert that forgets to set status silently becomes a
  confirmed booking). The app always sets status explicitly, so this only
  changes behavior for a hypothetical future insert that omits it — in the
  safe, fail-*closed* direction.
- **Booking INSERT policy now also validates `host_id`.** Added
  `AND host_id = (SELECT host_id FROM listings WHERE id = listing_id)` to the
  insert `WITH CHECK`, since `bookingService.create()` passes a client-derived
  `host_id` that wasn't previously cross-checked against the listing's actual
  owner.
- **`bookings` DELETE removed for regular users.** No frontend code ever
  calls `.from('bookings').delete()` — cancellation is always a status
  update. The historical `"Users can delete own bookings"` policy was
  dropped as unused surface area.
- **Auto-promoted `trivararooms@gmail.com` to `role = 'admin'` on signup.**
  This email is hardcoded as the primary admin check in
  `AdminDashboard.tsx`/`AdminSettings.tsx`/`Login.tsx`. The DB-side `role =
  'admin'` check is used as "defense in depth" alongside it, so
  `handle_new_user()`/`ensure_profile_exists()` now auto-assign `role =
  'admin'` for that email so the DB-side check works without a manual SQL
  step after every fresh deploy.

## Known TODO.md items NOT fully resolved at the schema level

These required a product/engineering decision beyond what a migration file
could decide on its own. Three were resolved this pass (see
`00000000000004_payout_rejection_and_audit.sql` and `NEXT_STEPS.md`):

- ~~**"Show host bank details securely."**~~ **Resolved.**
  `get_bank_details_for_payout()` (masks all but the last 4 digits of the
  account number) already existed and was admin-only, but
  `src/pages/AdminDashboard.tsx` was reading `host_bank_accounts` directly,
  bypassing it. `AdminDashboard.tsx` now calls the RPC instead — admins only
  ever see `••••<last 4>`, never the full account number.
- ~~**"Add admin payout approval flow" / "Add payout status: pending →
  approved → paid".**~~ **Resolved, without an intermediate `approved`
  state.** `payout_requests.status` already allowed `'rejected'` in its
  CHECK constraint, but nothing ever set it. `reject_payout_request(p_payout_id,
  p_reason)` now does, mirroring `approve_payout_request()`'s admin-only +
  advisory-lock shape; the reason is stored in the existing `notes` column
  and shown to the admin (and to the host, on their own earnings page) —
  no new column needed. Rejecting a payout leaves the underlying
  `host_earnings` row `'pending'`, so the host can request a payout again.
- ~~**"Add audit logs for ... completions."**~~ **Resolved.** Previously only
  payout *approvals* were audited (`log_payout_approval()`). That function now
  also fires on rejections, and a new `audit_booking_status_changes` trigger
  logs booking transitions to `'completed'`/`'cancelled'` the same way —
  `changed_by` is `NULL` for the unauthenticated `auto_complete_past_bookings()`
  cron job, and `auth.uid()` for a guest/host-initiated cancellation.

Still open:

- **`process_booking_refund()` is not wired to any UI.** It exists (ported
  from `production_hardening.sql`) but there's no cancellation-refund button
  anywhere in the frontend that calls it, and no Razorpay refund API call
  happens alongside it (it only updates DB bookkeeping) — actually issuing
  the refund via the Razorpay API is unimplemented.
- **`availability` table**: confirmed no schema file ever created a
  standalone `availability` table (`src/services/availabilityService.ts`'s
  `getByListingId()` method that queries `.from('availability')` is truly
  dead code with nothing backing it) — per the task brief, this was
  intentionally **not** invented. That method will continue to fail if
  called; it should be deleted from the frontend rather than given a fake
  backing table.

## How this was verified

The consolidated file was run against a scratch local Postgres 16 database
(with a minimal stub of Supabase's `auth` schema: `auth.users`, `auth.uid()`,
`auth.role()`, and the `anon`/`authenticated`/`service_role` roles) to confirm:
- It applies cleanly top-to-bottom on an empty database.
- It re-applies cleanly a second time with zero errors (only expected
  `DROP POLICY IF EXISTS ... does not exist, skipping` notices).
- End-to-end flow: auth signup → profile row created with `role='guest'`
  (or `'admin'` for the hardcoded admin email) → listing publish promotes the
  host → booking completion creates exactly one `host_earnings` row (and
  re-firing the same transition does not duplicate it) → review insert
  recalculates `listings.rating`/`review_count` → `request_payout_by_booking`
  computes the correct net amount → `approve_payout_request` (admin-only)
  marks both the payout and the earnings row `paid` and writes an audit log
  row.
- RLS/security: a host cannot read another host's bank account; a guest
  cannot self-promote to `role = 'admin'`; a host cannot insert a
  `payout_requests` row directly with an arbitrary amount; a guest cannot
  rewrite a booking's `total_price`; a guest *can* legitimately cancel their
  own booking; and two overlapping `confirmed` bookings on the same listing
  are rejected by the exclusion constraint.
