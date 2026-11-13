# BachelorMate

BachelorMate is a shared-living platform for bachelor messes, shared flats and hostels. It covers meal tracking with an automatic meal rate, a transparent per-member ledger, expenses and receipts, member requests, real-time home chat, friends and direct messages, notifications, a grocery list, a calendar and reports, all scoped per home.

## Features

| Area | What you get |
| --- | --- |
| **Accounts** | Email/password sign-up and login, httpOnly refresh-token sessions with rotation and reuse detection, email verification by **6-digit code or link** (hashed, 5 attempts, 60 s resend cooldown, optional "verify before creating/joining homes, posting or reviewing" rule), branded HTML emails via **Brevo, Resend or SMTP**, forgot/reset password (time-limited, single-use, hashed tokens), change password (signs out other devices), "sign out everywhere", profile and avatar upload (auto-cropped to 512 px), optional Google sign-in (Firebase ID token verified server-side) |
| **Multi-home** | Create, join, switch and leave any number of homes. Every home's data is isolated, and every home-scoped API call checks active membership first |
| **Onboarding** | Guided wizard (home → rules → meals → invite → done) with skippable steps. The join flow shows the home's rules and policies, collects member info and requires accepting the rules |
| **Invitations** | Invitation links (hashed token shown once, expiry, usage limit, revoke), 8-character home codes (regenerate, enable/disable), in-app invitations and email invitations, optional approval by Admin or Manager, duplicate-membership protection |
| **Roles & permissions** | Admin (owner), Manager, Meal manager and Member, with granular permissions the Admin can customise per role. Every check is enforced on the backend. Ownership can be transferred |
| **Meals** | Configurable meal types with weights (e.g. breakfast = 0.5), a daily meal grid with +/- counters and guest columns, a week view, filling the day from per-member defaults, meal periods with a live meal rate, closing a period (freezes a snapshot and posts charges) and reopening it (Admin only, reverses the charges) |
| **Requests** | Meal-off with a configurable cut-off time, guest meals, temporary absence, departure with a configurable notice period and Admin-only exceptions, duplicate prevention, and approve/decline/cancel with notes |
| **Finance** | Integer minor-unit money (no float errors), an append-only ledger (`balance = credits − charges`), payments recorded by managers or submitted by members for confirmation, adjustments and opening balances, reversals instead of deletes, expenses split into the meal pool / equally / between selected members / from the home fund, receipts, edit history, voiding, CSV export, payment reminders and charts |
| **Recurring costs** | Rent, internet, cleaner and other bills posted automatically every month or week. Split them equally between everyone or chosen members, or set a custom amount per person (৳0 = doesn't pay). The server does the maths with paisa-exact rounding and never charges an occurrence twice. Every member sees **what they need to pay**: their share plus any dues carried over, minus any advance |
| **Seat listings** | Admins and managers post an empty seat (rent, deposit, meal estimate, move-in date, who it suits, amenities, up to 8 photos). Anyone can browse and filter them on **Find a seat** without an account. Only area and city are shown, never the address. Signed-in users message the poster through a private chat, and the poster can invite them into the home with one click |
| **Reviews** | Members and former members rate their home (overall plus cleanliness, food, management and value), and the home can reply publicly. People who lived together can review each other with tags like "pays on time". Reviews only come from people who actually lived there (configurable minimum stay) and show on listings and profiles |
| **Images** | Uploads are verified by their file contents (not just the extension), auto-rotated, resized, converted to WebP and stripped of EXIF/GPS data, then stored in MongoDB GridFS, so they survive redeploys. Receipts are private to the home |
| **Chat** | Private real-time chat per home (Socket.IO) with typing indicators, read receipts, presence, unread counts, edit and delete (previous versions kept for audit) and emoji. A separate friend system with one-to-one messages |
| **Notifications** | In-app notification centre (live over sockets), unread counts, mark one or all as read, and per-type mute and email preferences. Important types are also emailed |
| **More** | Announcements with acknowledgement, a grocery list (assign a buyer, record the purchase as an expense), a shared calendar (events, meal periods, payment deadlines, departures, absences), six reports with CSV export, an activity/audit log, and archiving or permanently deleting a home |
| **UI** | Custom design system (tokens, light/dark/system, 7 accents, 4 presets, compact density) saved to the account, responsive down to 375 px with a mobile bottom nav, skeletons, empty states, error boundaries and lazy-loaded routes |

## Tech stack

* **Client:** React 19, Vite 7, React Router 7, TanStack Query, socket.io-client, Recharts, Lucide icons, plain CSS with design tokens
* **Server:** Node 20+, Express 5, Mongoose 8 (MongoDB), Socket.IO 4, Zod validation, Helmet, express-rate-limit, Multer, Nodemailer, jose (Google token verification)
* **Tests:** `node:test`, Supertest, and mongodb-memory-server (a real replica set, so transactions run)

## Architecture

```
client (Vite SPA) ──HTTP /api──▶ Express app ──▶ MongoDB (replica set → transactions)
        └────────WebSocket────▶ Socket.IO (same JWT; rooms user:<id>, home:<id>)
```

* **Auth:** short-lived access JWT (15 min, held in memory) plus an httpOnly refresh cookie stored server-side as a SHA-256 hash. Rotated tokens are single-use; reusing one revokes every session. `tokenVersion` invalidates access tokens after a password change or reset.
* **Home scoping:** `/api/homes/:homeId/*` passes through `loadHome`, which loads the caller's **active** membership (returning 404 otherwise) and computes permissions. Route handlers always query with `home: req.home._id`, so ids from another home never resolve.
* **Money:** every amount is an integer in minor units. Shares and meal costs use largest-remainder rounding, so they always sum exactly to the total. Ledger entries are never edited or deleted; corrections are reversal entries. Closing a meal period stores a frozen snapshot, so later configuration changes never rewrite history.
* **Meal accounting:** `meal rate = meal-pool expenses ÷ (weighted member meals + weighted guest meals)`. With fixed guest pricing, guests pay the fixed rate and members share the remainder.
* **Real time:** the server decides which rooms a socket joins (from the database). Removing or archiving a member makes their sockets leave the home room immediately.

## Folder structure

```
client/
  src/components/        UI kit, layout (AppShell, HomeLayout), ChatView, form modals
  src/context/           Auth, Theme, Realtime (socket), Toast, Home
  src/lib/               api client (silent refresh), formatting, hooks, socket
  src/pages/             auth/, home/ (all home-scoped pages), settings/, top-level pages
  src/styles/            tokens.css (themes), app.css (components)
server/
  app.js / server.js     Express app / HTTP + Socket.IO bootstrap
  config/                env validation, DB connection
  lib/                   http/validation, money, dates, permissions, security, mailer, csv
  middleware/            auth, home scoping & permissions, uploads, errors
  models/                User, Session, Home, Membership, Invitation, Meal, Request, Finance, Chat, Misc
  routes/                auth, users, join, homes, meals, requests, finance, chat, homeExtras
  services/              ledger, meal calculations, notifications, activity log, realtime
  sockets/               Socket.IO auth, rooms, typing, presence
  scripts/               migrate-legacy.js, dev-local-db.js
  tests/                 API integration tests + unit tests
```

## Getting started

### Prerequisites
* Node.js 20 or newer
* MongoDB, either Atlas (recommended), a local replica set, or nothing at all with `npm run dev:local` (see below)

### Install
```bash
npm --prefix server install
```
```bash
npm --prefix client install
```

### Configure
```bash
cp server/.env.example server/.env
```
```bash
cp client/.env.example client/.env
```
Set at least `MONGO_URI` and `JWT_ACCESS_SECRET` in `server/.env`.

### Run (development)
With your own MongoDB:
```bash
npm --prefix server run dev
```
Without MongoDB installed (downloads a MongoDB binary once and keeps data in `server/.dev-db/`):
```bash
npm --prefix server run dev:local
```
Then start the client (Vite proxies `/api`, `/uploads` and `/socket.io` to port 5000):
```bash
npm --prefix client run dev
```
Open http://localhost:5173.

Without SMTP settings, emails (verification, reset, invitations) are printed to the server console, so you can copy the links from there.

## Environment variables

**server/.env**

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URI` | ✓ | MongoDB connection string. Use a replica set or Atlas so financial writes run in transactions |
| `JWT_ACCESS_SECRET` | ✓ | At least 32 random characters in production (`JWT_SECRET` is accepted as a legacy fallback) |
| `CLIENT_URL` | ✓ | Public URL of the frontend, used in email links |
| `CORS_ORIGINS` | | Comma-separated allowed origins (defaults to `CLIENT_URL`) |
| `COOKIE_SECURE`, `COOKIE_SAMESITE` | | Use `true` / `none` when the API and frontend are on different domains |
| `TRUST_PROXY` | | `true` behind Render, Railway, Nginx and similar |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_DAYS` | | Session lifetimes (defaults: 15m / 30) |
| `BREVO_API_KEY` | | Brevo transactional email. Works **without a domain**: verify a single sender address (e.g. your Gmail) in Brevo and use it as `MAIL_FROM` |
| `RESEND_API_KEY` | | Resend transactional email (needs a domain verified in Resend to email anyone) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | | Outgoing email (any SMTP provider: Resend, SendGrid, Mailgun, Gmail app password…) |
| `FIREBASE_PROJECT_ID` | | Enables Google sign-in. Tokens are verified against Google's public keys, so no service account is needed |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | | Where avatars and receipts are stored, and the size limit |
| `SERVE_CLIENT` | | `true` to serve `client/dist` from the API (one-service deploy) |
| `SEED_DEMO`, `DEMO_PASSWORD` | | Seed the demo home on first start, and its password |

**client/.env**

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API origin when the frontend is hosted separately without a proxy (leave empty for the one-service and Vercel-rewrite setups) |
| `VITE_SOCKET_URL` | API origin for WebSockets when `/api` is proxied (Vercel → Render) |
| `VITE_FIREBASE_*` | Firebase web config. Leave empty to hide the Google button |

## Database & migration

New data lives in new collections (`homes`, `home_memberships`, `meal_entries`, `meal_periods`, `ledger_entries`, `home_expenses`, `member_requests`, `chat_*`, `friendships`, `notifications`, …). The `users` collection is shared and backwards compatible, so existing accounts can still sign in.

To bring data from the original *family* model (`families`, `memberships`, `meals`, `guestmeals`, `payments`, `expenses`) into homes, first preview the migration (a dry run that writes nothing):
```bash
npm --prefix server run migrate
```
Then apply it:
```bash
npm --prefix server run migrate -- --apply
```
The legacy collections are only read, never modified. Re-running skips families that were already migrated. Legacy float amounts are rounded to the nearest minor unit. Old bill-config amounts are not converted to expenses; record them as expenses after migrating.

## Testing

```bash
npm --prefix server test
```
The suite runs 67 tests (API integration, recurring costs, email codes, uploads, listings, reviews, demo seed and unit) against an in-memory MongoDB replica set. They cover registration, login, email verification, password reset and change, refresh rotation and reuse detection, multiple homes, link/code/in-app joining, approvals, usage limits, revocation, IDOR isolation, role and permission escalation attempts, meal grids and defaults, meal-rate maths, period close/reopen with ledger reversal, payments, expenses with exact splits, edit audit, voiding, reversals, CSV reports, meal-off, guest and departure requests with notice exceptions, home chat access control, editing and deleting messages, friends and DMs, notifications, announcements, grocery-to-expense, dashboard, calendar, member removal, ownership transfer, archiving and deletion.

Client checks:
```bash
npm --prefix client run lint
```
```bash
npm --prefix client run build
```

## Demo accounts

Load a fully populated demo home ("Green Villa Mess", with five members, two weeks of meals, expenses, payments, requests, chat and more):
```bash
npm --prefix server run seed:demo
```
It only replaces the `@demo.bachelormate.app` accounts and their home. Every demo account uses the password `Demo@1234` (override it with `DEMO_PASSWORD`):

| Role | Email |
| --- | --- |
| Admin | `admin@demo.bachelormate.app` |
| Manager | `manager@demo.bachelormate.app` |
| Meal manager | `meal@demo.bachelormate.app` |
| Member | `member@demo.bachelormate.app`, `member2@demo.bachelormate.app` |

Setting `SEED_DEMO=true` seeds the demo automatically on server start, once.

## Deployment

Recommended: **MongoDB Atlas** (free cluster) + **Render**, set up in one step from [`render.yaml`](render.yaml) (Render → New → Blueprint). Fill in `MONGO_URI`, `CLIENT_URL` and `CORS_ORIGINS`, then add an email provider (see Environment variables).

Socket.IO needs a long-running Node process, so the API can't run on Vercel serverless functions. The recommended setup is a single Render service where the API also serves the built client (`SERVE_CLIENT=true`): one URL, first-party cookies and native WebSockets. Hosting the frontend on Vercel with the API on Render is also supported: set `SERVE_CLIENT=false`, point the rewrites in `client/vercel.json` at the API, and set `VITE_SOCKET_URL` to the API origin. `server/vercel.json` and `server/api/` are legacy and not used by either setup.

## Known limitations

* Presence and socket rooms are in-memory, so run one API instance (or add the Socket.IO Redis adapter for several).
* Images live in MongoDB (GridFS). That is fine for thousands of photos; for very large volumes, move them to S3/R2 storage.
* Amounts assume 2 decimal places for every currency.
* Payment reminders are sent manually from the Finance page; no scheduled job runs them.
