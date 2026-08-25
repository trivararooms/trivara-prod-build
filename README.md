# Trivara

Trivara is a short-term rental marketplace — an Airbnb-style app for the
Indian market. Guests search listings and book stays, paying through
Razorpay; hosts create listings, manage bookings, and request payouts of
their earnings; an admin can see platform-wide stats, approve payouts, and
configure the Razorpay/SMTP integration.

The project was originally scaffolded through [Lovable](https://lovable.dev)
and deployed on Vercel, backed entirely by [Supabase](https://supabase.com)
(Postgres, Auth, Edge Functions) — there is no separate custom backend
server; the React frontend talks to Supabase directly, with Row Level
Security policies as the real access-control layer.

For a deeper walkthrough of the architecture, the data model, what was
fixed in the latest refactor pass, and what's still left to do, see
[`NEXT_STEPS.md`](./NEXT_STEPS.md).

## Tech stack

- **Frontend**: React 18 + TypeScript + Vite, [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS
- **Backend**: Supabase — Postgres database, Auth (Google OAuth), Row Level Security, Storage, Edge Functions
- **Payments**: Razorpay, via a Supabase Edge Function that creates orders and verifies webhook signatures
- **Testing**: Vitest, for pure-function unit tests (mappers, error helpers, utils)

## Getting started

**Requirements**: Node.js (see engines in `package.json`), npm, and a Supabase project with the schema in
`supabase/migrations/00000000000001_consolidated_baseline.sql` applied (via the Supabase SQL Editor).

1. Clone the repo and install dependencies:

   ```sh
   git clone https://github.com/trivararooms/Trivara-app.git
   cd Trivara-app
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in real values from your Supabase project's
   Settings → API page:

   ```
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your anon key>
   VITE_RAZORPAY_KEY_ID=<unused by the frontend - see note below>
   VITE_ADMIN_EMAIL=<optional, overrides the default admin email fallback>
   ```

   `VITE_SUPABASE_URL` must be the bare project URL (`https://<ref>.supabase.co`),
   not the `/rest/v1/` REST endpoint path — `supabase-js` adds that itself, and
   passing the full REST path breaks every request (including auth).

   Razorpay credentials are **not** read from `.env` at all — `VITE_RAZORPAY_KEY_ID`
   is unused by any frontend code. The real key id/secret/enabled flag live in the
   `app_settings` table and are set from `/admin/dashboard/settings` (Razorpay tab)
   once logged in as an admin. See "Admin access" below for how an account becomes
   admin. Never commit a real `.env` file or paste real keys into a tracked file.

3. Start the dev server:

   ```sh
   npm run dev
   ```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview a production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest test suite once |
| `npm run test:watch` | Run Vitest in watch mode |

## Running with Docker

A `Dockerfile` and `docker-compose.yml` are included for a self-contained local build (multi-stage
Node build → static files served by nginx, with SPA routing configured in `nginx.conf`).

```sh
cp .env.example .env   # fill in real Supabase values first
docker compose up --build
```

The app will be available at `http://localhost:8080`. Note that Vite bakes `VITE_*` environment
variables into the JavaScript bundle at *build* time — changing `.env` requires rebuilding
(`docker compose up --build`), not just restarting the container.

## Project structure

```
src/
  components/     Reusable UI components (shadcn/ui primitives + feature components)
  pages/           Route-level pages (guest, host, and admin views)
  services/        Supabase data-access layer (one file per domain: listings, bookings, reviews, ...)
  lib/             Shared helpers - snake_case↔camelCase mappers, error handling, admin-email check
  context/         React context providers (auth session)
  types/           Shared TypeScript domain types
  hooks/           Small custom hooks (mobile detection, toast, debounce)
  data/            Static reference data (e.g. the amenities list)

supabase/
  migrations/       Consolidated, canonical database schema (see the file's own header for details)
  functions/        Deno Edge Functions (Razorpay order creation/webhook, transactional emails)

deprecated/         Superseded schema dumps, one-off *_FIX.sql/*_FIX.md files, and old ad-hoc scripts,
                    kept only so history isn't lost. Nothing in here is read by the app or the build -
                    safe to delete the whole folder. Don't add new files here; if a fix changes the
                    architecture or setup, update this README and/or NEXT_STEPS.md instead.

backend/            (in a separate sibling repo, not part of this project) - an in-progress FastAPI +
                    Postgres backend intended to eventually replace the direct-to-Supabase frontend
                    architecture described above
```

## Database schema

The single source of truth for the database is
[`supabase/migrations/00000000000001_consolidated_baseline.sql`](./supabase/migrations/00000000000001_consolidated_baseline.sql),
plus `00000000000002_saved_listings_and_scheduled_jobs.sql` on top of it. Everything under
`deprecated/` (loose schema dumps and `*_FIX.sql` files that used to live at the repo root, plus the
old `migrations/` folder) is historical only — none of it reflects the live schema going forward. See
`supabase/migrations/README.md` for the judgment calls made when reconciling conflicting historical
schema files.

**If your live database predates these migrations** (was built up from the old `deprecated/*.sql`
files instead), it may be missing pieces newer code assumes exist — e.g. the `app_settings` table, or
an `updated_at` column on a table that has an `update_..._updated_at` trigger. Diff your actual schema
against the consolidated migration before assuming it's fully applied.

## Admin access

An account becomes admin via `profiles.role = 'admin'`, set automatically on first sign-in for
whichever email `VITE_ADMIN_EMAIL` in `.env` names (`trivararooms@gmail.com` by default) — see
`handle_new_user()` in the consolidated migration. If an account already existed before signing up
under that email, promote it manually instead:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = '<your admin email>';
```

Once promoted, log in and go to `/admin/dashboard` (stats, payout approval) and
`/admin/dashboard/settings` (Razorpay/SMTP configuration — see the `.env` note above).

## Deployment

The app auto-deploys to Vercel from the `main` branch. Checklist for pointing this app at a
(new or existing) Supabase project:

1. Apply `supabase/migrations/00000000000001_consolidated_baseline.sql` (and
   `00000000000002_saved_listings_and_scheduled_jobs.sql`) via the SQL Editor.
2. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_ADMIN_EMAIL` locally (`.env`) and in
   Vercel's project settings — both are build-time values baked into the client bundle.
3. Set Edge Function secrets (Dashboard → Edge Functions → your function → Settings, or
   `supabase secrets set`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (never put this in the
   frontend), and `RESEND_API_KEY`/`ADMIN_EMAIL` if using the email functions.
4. Deploy the Edge Functions:
   ```bash
   supabase functions deploy create-razorpay-order
   supabase functions deploy razorpay-webhook
   supabase functions deploy refund-razorpay-payment
   supabase functions deploy sendBookingConfirmationEmail
   supabase functions deploy sendBookingCancellationEmail
   supabase functions deploy sendPayoutRequestEmail
   ```
5. Point the Razorpay webhook (Razorpay dashboard) at the deployed `razorpay-webhook` URL, and set a
   `razorpay_webhook_secret` value in `app_settings` so signature verification works.
6. Configure Google OAuth redirect URLs in Supabase Auth settings for your deployed domain.

## Contributing

Open a pull request against `main`. Since `main` auto-deploys to production, avoid pushing directly
to it — changes should go through review first.
