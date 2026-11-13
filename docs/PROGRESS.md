# BachelorMate: audit & progress report

_Last updated: 2026-11-13_

## 1. Audit of the original codebase

**Stack found:** React 19 + Vite + React Router (client, plain CSS, Firebase Google login) · Express 5 + Mongoose 8 + JWT (server, deployed to Vercel serverless). About 5.5k lines; a "family" model with memberships, meals, guest meals, payments and expenses, plus a monthly summary.

| Feature | Status found | Notes |
| --- | --- | --- |
| Register / login (email) | Partial | No validation, no rate limiting, a 7-day JWT stored in localStorage |
| Google login | **Broken / critical security bug** | `POST /api/auth/google` trusted the `email`/`uid` sent by the client, so anyone could sign in as any user |
| Password reset, email verification, change password, profile, avatar | Not implemented | |
| Families (homes), join by code / invite | Partial | One-step join, no invitation lifecycle, no approval UX, no rules |
| Roles | Partial | admin/manager/member flags only; checks scattered and duplicated across controllers |
| Meals / guest meals | Partial | Booleans per meal (no weights, no configuration), no periods, no locking, no meal-off |
| Payments / expenses / summary | Partial | Float money; the summary was computed on the fly with no ledger, no reversals and no history |
| Requests (meal-off, departure…), chat, friends, notifications, announcements, grocery, calendar, reports, activity log, themes | Not implemented | |
| Build | Client built; **15 ESLint errors**; client hard-coded the production API URL | |
| Security | CORS `origin: true` with credentials; no Helmet, rate limiting or input validation; `process.exit` on DB error in serverless; `.gitignore` had an inline comment that silently broke the `.env.*` rule | |

Decision: keep the stack, but rebuild the server into modular routes, services and middleware, and the client into a design-system-driven SPA. The old family collections are left untouched and a non-destructive migration script is provided.

## 2. Milestone status

| # | Milestone | Status |
| --- | --- | --- |
| 1 | Audit, architecture repair, auth & account management | ✅ Done |
| 2 | Multi-home, creation, joining, invitations, onboarding | ✅ Done |
| 3 | RBAC, member management, home settings | ✅ Done |
| 4 | Meals, meal-off, guest meals | ✅ Done |
| 5 | Finance: ledger, payments, expenses | ✅ Done |
| 6 | Home chat, friends, friend chat | ✅ Done |
| 7 | Notifications, announcements, grocery, calendar | ✅ Done |
| 8 | Reports, analytics, activity log | ✅ Done |
| 9 | UI/UX redesign, themes, responsive | ✅ Done |
| 10 | Security, testing, docs | ✅ Done (see limitations) |

## 3. What was verified, and how

**Automated:** `npm --prefix server test` runs 46/46 passing tests against a real MongoDB replica set (in memory). See the README for the list of flows covered.

**Manual, in the browser** (local stack via `npm run dev:local` + Vite):
* Registration through the UI → Homes page
* The onboarding wizard (home, rules, meals, invite code and link) → dashboard
* Three additional users joining by code → approved in **Members → Pending** → roles assigned through the row menu
* A meal period created; the daily list filled from defaults; counters and guest edits saved
* A grocery expense paid by a member (meal pool) and a utility bill split equally (৳1,000.01 → exact shares); a payment recorded through the modal; finance overview balances reconciled
* The meal period closed (rate ৳109.09, charges summing to exactly ৳1,200.00), reopened by the Admin (all charges reversed)
* Home chat: a message sent from the UI, a reply from a second user delivered **live over Socket.IO**, the read receipt ("Seen") updated live, presence shown
* A meal-off request reviewed and approved from **Requests → To review**, with the member notified
* All 29 routes rendered at **375 px**: no crashes, no horizontal overflow, bottom nav shown
* Appearance (light, emerald accent, warm preset) saved to the account and restored after a full reload

**Bugs found and fixed during QA:** Activity page crash (invalid `timeStyle` date option); added error boundaries so one page can't blank the app; meal-off requests for days in a closed period are now rejected at submission (previously they could never be approved); a misleading "Paid in" column renamed "Credits"; Mongoose Map serialisation in the member list.

**Not verified (needs credentials or infrastructure):** real SMTP delivery, Google sign-in (needs a Firebase project), multi-instance deployments.

## 4. Remaining limitations / next steps

* Socket presence and rooms are in-memory → add `@socket.io/redis-adapter` before running more than one API instance.
* Uploads are stored on local disk → swap in S3/R2 storage for stateless hosting.
* Two decimal places are assumed for every currency.
* Payment reminders are manual (a button); a cron job could automate monthly reminders.
* The legacy migration doesn't convert the old fixed `billConfig` (rent/wifi/…) into expenses.
