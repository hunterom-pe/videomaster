# VideoMaster — Video Rental Management System

**Version 1.0 · "1996 appearance. 2026 usability."**

VideoMaster is a multi-user, multi-store web application that simulates the counter software of an independent video rental store from roughly 1994–1999: a blue DOS-style screen, square gray buttons, monospace type, `[ BRACKETED ]` controls — but with modern usability. Everything is clickable with a mouse or a finger, every screen works on a phone, and keyboard shortcuts are optional.

It is a real, working point-of-sale and inventory system (rentals, returns, late fees, merchandise, memberships, receipts, reports). Payments are **simulated**; no real payment processing is included.

```
╔════════════════════════════════════════════════════════════════╗
║                         VIDEOMASTER                            ║
║              VIDEO RENTAL MANAGEMENT SYSTEM                    ║
║                         VERSION 1.0                            ║
╠════════════════════════════════════════════════════════════════╣
║ STORE: VIDEO WORLD #0147                                       ║
║                                                                ║
║ [F1] RENT VIDEO         [F2] RETURN VIDEO                      ║
║ [F3] CUSTOMERS          [F4] MOVIE INVENTORY                   ║
║ [F5] CONCESSIONS        [F7] OVERDUE RENTALS                   ║
║ [F8] TRANSACTIONS       [F6] REPORTS                           ║
║ [F9] STORE SETTINGS                                            ║
╠════════════════════════════════════════════════════════════════╣
║ VIDEOS OUT: 28     OVERDUE: 5     CUSTOMERS: 22                ║
║ SYSTEM READY                                                   ║
╚════════════════════════════════════════════════════════════════╝
```

> This is a browser-based web app (Next.js / React / TypeScript, HTML and CSS). It is not a native, Electron, desktop, terminal or command-line application.

---

## Table of contents

1. [Features](#features)
2. [Quick start](#quick-start)
3. [Configuration](#configuration)
4. [Using VideoMaster](#using-videomaster)
5. [Business rules](#business-rules)
6. [Architecture](#architecture)
7. [Data model](#data-model)
8. [Security](#security)
9. [Project structure](#project-structure)
10. [Scripts](#scripts)
11. [Testing and quality](#testing-and-quality)
12. [Deploying (Netlify)](#deploying-netlify)
13. [Development notes and gotchas](#development-notes-and-gotchas)
14. [Design principles](#design-principles)
15. [Known limitations](#known-limitations)
16. [Project documents](#project-documents)
17. [Credits](#credits)

---

## Features

**Accounts and stores**
- Sign up, log on, log off, protected routes. Each account owns its own isolated store; multiple stores can exist side by side and never see each other's data.
- First-run setup wizard (one clickable form) collects store info, tax, time zone, formats and rental categories, and can optionally load a full **sample demo store**.
- Store Settings, organised by the spec's sections with a jump index: store information, tax, store year, formats carried (with a default rental category per format), rental pricing/categories/late fees, optional fees, concession categories, inventory settings, membership rules, system settings.

**Customers**
- Membership numbers (per-store, atomic), search by name / phone (digits-only works) / membership number, account status (GOOD, OVERDUE, BLOCKED, SUSPENDED, CLOSED), notes, outstanding fees, active rentals, membership fee and renewal, expiry warnings.

**Movie inventory**
- Movie search against **TMDB** (server-side) to prefill title, year, director, runtime, genres, cast, MPAA rating, plot and poster — or add a title by hand. Optional "only movies on or before the store year" filter. Metadata is stored locally, so the store keeps working if TMDB is down.
- **Titles and physical copies are separate.** Adding "10 VHS copies" creates one title and ten individual copy records (`VHS-000001` …), each with its own status, condition, barcode, notes and replacement cost. Re-adding a movie adds copies to the existing title (never a duplicate).
- Statuses: AVAILABLE, RENTED, OVERDUE (derived), LOST, DAMAGED, REPAIR, RETIRED. Inventory search by title, year, actor, director, genre, copy ID, barcode, format, category and availability.

**Rentals, returns and point of sale**
- Checkout by customer with title search, exact copy ID / barcode entry (scanner-friendly), or picking a specific copy. Optional merchandise lines in the same transaction. Retro confirmation dialog, then a printable receipt.
- Returns by copy ID, barcode, title or customer; late fees from store policy (calculated **and** charged amounts stored); waive/reduce fees; mark a copy DAMAGED or LOST; optional rewind fee.
- Walk-in merchandise sales (no customer), with quantities and low-stock protection.
- Rental limits and expired memberships need a manager override; closed accounts cannot rent.

**Merchandise (concessions)**
- Items with SKU, category, retail price, optional cost, taxable flag, quantity on hand, low-stock threshold, barcode, active flag. Editable categories. Low-stock and out-of-stock warnings everywhere they matter. Stock can never go negative (enforced in code **and** by a database constraint).

**Money and records**
- Transactions (rentals, returns, retail sales, membership fees) with per-store numbering, payment method, tax and notes; filterable history and a detail page.
- **Account balances:** at a return the clerk can collect only part of the fees and put the rest on the customer's account (`AMOUNT PAID NOW`). The balance shows on the customer account and checkout screens, requires a manager override to rent, and can be paid down (cash/change supported) or waived by a manager from `Customer → PAY OR WAIVE BALANCE`. Payments and waivers are their own transactions with receipts; a `CUSTOMER BALANCES` report lists who owes what. Revenue is counted when money is collected.
- **Cash tendered and change:** on every payment screen (rentals/sales, return fees, membership) choosing CASH shows a *cash tendered* box with quick-amount buttons and a live CHANGE DUE (or SHORT BY). Blank means exact cash; the server re-checks that the amount covers the total. Receipts and transaction detail show CASH TENDERED and CHANGE.
- **Demo mode:** a `[ TRY DEMO MODE ]` button on the log-on screen creates a private throwaway account with a fully stocked sample store (videos, customers, rentals, overdue items, sales) and signs in. Every click gets its own store; demo accounts are deleted after 24 hours, and demo starts are rate limited per IP.
- **Voids and refunds** (owner/manager only): *void* cancels an open rental or sale as if it never happened (copies back on the shelf, stock restocked, kept in history marked VOID, excluded from totals); *refund* returns money for chosen merchandise lines (with optional restock), rental charges or a fee/membership payment, with proportional tax, as a negative REFUND transaction linked to the original.
- Retro on-screen **receipts** with `[ PRINT ]` (browser print, black-on-white stylesheet) and reprint from any transaction.
- Seven printable **reports**: Daily Activity, Overdue Rentals, Inventory, Popular Rentals, Customer Activity, Merchandise Inventory, Revenue — with date filters. Totals reconcile to the cent.

**Polish**
- Per-store **time zone** (Arizona = `America/Phoenix`, no daylight saving, is a first-class choice); all "days" are store-local calendar days.
- Optional **F1–F9 keyboard shortcuts** (off by default).
- Accessibility: 0 axe violations across all screens, skip link, landmarks, modal dialogs with focus management, linked form errors, ≥4.5:1 contrast. Responsive down to a 320 px phone.

---

## Quick start

### Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 20.9+** | Developed on Node 25; Netlify builds on Node 22. |
| **npm** | Ships with Node. |
| **PostgreSQL 14+** | Developed on PostgreSQL 17. A local install or any hosted Postgres works. |
| **TMDB API key** *(optional)* | Free from [themoviedb.org](https://www.themoviedb.org/) (Settings → API). Without it, titles can still be added by hand. |

On macOS with Homebrew:

```bash
brew install postgresql@17
brew services start postgresql@17
createdb videomaster
```

### Install and run

```bash
git clone https://github.com/hunterom-pe/videomaster.git
cd videomaster

cp .env.example .env            # then edit .env (see Configuration)
npm install                     # also runs `prisma generate`
npx prisma migrate deploy       # creates all tables
npm run dev                     # http://localhost:3000
```

Open <http://localhost:3000>, click **CREATE ACCOUNT**, then complete **store configuration**. On that screen you can tick **LOAD SAMPLE STORE DATA?** to start with a fully populated demo store (see [Sample demo store](#sample-demo-store)).

### After pulling changes or editing the schema

```bash
npx prisma migrate deploy       # apply any new migrations
# then STOP and RESTART `npm run dev`
```

A running dev server keeps the old database client in memory. If you skip the restart you will see *"This page couldn't load"* or errors like `Unknown argument …` in the terminal. `npm run dev` regenerates the client on start.

---

## Configuration

Copy `.env.example` to `.env`. `.env` is git-ignored and never committed.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string used by the running app, e.g. `postgresql://you@localhost:5432/videomaster`. On Supabase use the Shared Pooler in **Transaction mode** (port 6543). |
| `MIGRATE_DATABASE_URL` | No | Connection used only by the Prisma CLI for migrations. Falls back to `DATABASE_URL`. |
| `SITE_URL` | No | Public site URL for link previews (defaults to Netlify's `URL`, then the videomaster-rms Netlify address). Set it if you add a custom domain. |
| `DB_POOL_MAX` | No | Max database connections per server instance (1–20, default 5). |
| `DB_SSL` | No | `no-verify` = encrypt but skip certificate-chain verification (automatic for Supabase hosts). |
| `TMDB_READ_ACCESS_TOKEN` | No* | TMDB "API Read Access Token" (sent as a bearer header). |
| `TMDB_API_KEY` | No* | TMDB v3 API key (used only if no token is set). |

\* Provide **either** TMDB credential to enable movie search. Both are read on the server only and are never sent to the browser.

---

## Using VideoMaster

### First run

1. **Create an account** (e-mail + password of 10+ characters).
2. **Store configuration** — name, number, address, phone, manager, optional slogan, currency, **time zone**, sales tax %, optional store year, formats carried (VHS is on by default), and your rental categories (defaults: NEW RELEASE $3.99 / 2 days, CATALOG $1.99 / 5 days, KIDS $0.99 / 5 days, each with a $1.00/day late fee). Everything stays editable later.
3. You land on the **main menu**. Every item is a button; the F-key labels are decorative unless you turn shortcuts on.

### Screens

| Route | What it does |
|---|---|
| `/menu` | Main menu with live counts (videos out, overdue, customers) and low-inventory warnings. |
| `/customers`, `/customers/new`, `/customers/[id]`, `…/edit`, `…/renew` | Search, add, view, edit customers; renew membership. |
| `/inventory`, `/inventory/add`, `/inventory/new`, `/inventory/[id]`, `/inventory/[id]/copy/[copyId]` | Inventory search; TMDB movie search; add title; title page with per-format status counts and individual copies; edit a single copy. |
| `/rent`, `/rent/[customerId]` | Pick a customer, then checkout (rentals + merchandise). |
| `/sale` | Walk-in merchandise sale (no customer). |
| `/return`, `/return/[rentalId]` | Everything currently out (oldest due first) with search; return screen with fees. |
| `/overdue` | Overdue rentals with days late, accrued fee and customer balance; rows open the return screen. |
| `/concessions`, `/concessions/new`, `/concessions/[id]` | Merchandise catalog, stock receiving, low-stock warnings. |
| `/transactions`, `/transactions/[id]` | History with filters; transaction detail. |
| `/receipt/[id]` | Retro receipt (shown after every checkout/return; reprint from history). |
| `/reports`, `/reports/[slug]` | The seven printable reports. |
| `/settings` | Store settings, sample data, and (owner-only) clearing store data. |
| `/login`, `/signup`, `/setup` | Authentication and first-run setup. |

### Typical workflows

**Rent a video** — `RENT VIDEO` → click the customer → search a title (or type a copy ID/barcode) → `[ ADD … ]` → optionally add merchandise from the category buttons → `[ TAKE PAYMENT ]` → confirm → receipt with due dates.

**Return a video** — `RETURN VIDEO` → click the row (or search by copy ID, barcode, title, customer) → review days late and the late fee → optionally `[ WAIVE FEE ]`, `[ DAMAGE ]` or `[ LOST ]` → `[ COMPLETE RETURN ]` → confirm.

**Add a movie** — `MOVIE INVENTORY` → `[ ADD TITLE ]` → search TMDB → click a result → choose format, rental category and quantity → `[ ADD TO STORE ]`.

**Sell candy** — `CONCESSIONS` → `[ SELL MERCHANDISE ]` (or add items inside a customer's checkout).

### Sample demo store

Available on first-run setup, or later from **Store Settings → Sample store data** (only into an *empty* store, so it can never mix with real data). It creates:

- 28 classic movies with real TMDB metadata and posters (saved in `src/lib/sample-titles.json`, so loading works offline),
- 22 fictional customers (555-01xx phone numbers),
- 16 merchandise items, including low-stock and out-of-stock examples,
- VHS copies (plus DVD copies if DVD is enabled),
- three weeks of deterministic history: on-time and late returns, waived/reduced fees, a lost tape, a few damaged tapes, currently-out and **overdue** videos, and activity today — all in the store's own time zone.

To start over, use the owner-only **CLEAR ALL STORE DATA** button (type `CLEAR` to confirm). It deletes customers, inventory, merchandise, rentals and transactions but keeps your settings.

### Keyboard shortcuts (optional)

Off by default, because F1–F9 are browser keys. Enable in **Store Settings → System settings**. Then:

| Key | Screen | Key | Screen |
|---|---|---|---|
| F1 | Rent video | F6 | Reports |
| F2 | Return video | F7 | Overdue rentals |
| F3 | Customers | F8 | Transactions |
| F4 | Movie inventory | F9 | Store settings |
| F5 | Concessions | | |

Shortcuts never touch modified keys (Ctrl/Alt/Cmd/Shift + key), F10–F12, or anything while a dialog is open. Everything also works by clicking.

### Printing

`[ PRINT ]` uses the browser's print dialog. The print stylesheet hides the application chrome and prints receipts and reports black-on-white (receipts are ~38 characters wide).

---

## Business rules

- **Copies, not quantities.** A title is one record; every physical tape is its own `InventoryCopy`.
- **Rental price and period** come from the copy's rental category (per-format pricing = give a format its own category and make it that format's default in Settings). Prices are read from the database at checkout — never trusted from the browser.
- **Tax** is one calculation over all taxable lines (rentals and taxable merchandise), rounded half-up to the cent. Money is handled in integer cents throughout.
- **Late fee** = whole store-local calendar days past the due date × the category's per-day fee, capped by the category's optional maximum. The **calculated** and **charged** fee are both stored. A fee may be reduced or waived, never raised above policy. A lost item owes no late fee (it owes the replacement cost plus any lost-item fee).
- **Overdue is derived, never stored.** A rental is overdue when it is unreturned and due before today (store-local). A GOOD customer with overdue rentals behaves as OVERDUE; BLOCKED / SUSPENDED / CLOSED set by hand always win. (No background job exists to keep a stored flag fresh on a serverless host, so it is computed on read.)
- **Manager override** (owner/manager only, explicit checkbox, enforced on the server) is required to rent when: the account is not GOOD, the membership is expired, or the customer would exceed the store's maximum videos out. All reasons are shown together. CLOSED accounts cannot rent at all. Merchandise-only sales are never blocked.
- **Membership.** Optional fee (collected when a customer is added, waivable, or on renewal), optional term in months (0 = never expires), optional maximum videos out. Renewal extends from the later of today and the current expiry.
- **Optional fees** (all default to 0 = off): rewind fee (VHS "not rewound" checkbox at return), damage fee (suggested when DAMAGE is chosen), lost-item fee (added to replacement cost), default replacement cost for new copies.
- **Stock.** Selling decrements atomically with a conditional update (`quantityOnHand >= quantity`); a shortfall rolls back the entire transaction, including any rentals in the same cart.
- **Concurrency.** Copies are claimed with a conditional `AVAILABLE → RENTED` update inside one database transaction, so two clerks cannot rent the same tape; a rental can only be returned once.
- **Merchandise categories** are per-store and editable. Removing one that has items *retires* it instead of deleting it; re-adding the name reactivates it.

---

## Architecture

A single, maintainable monolith — no microservices.

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router), **React 19**, **TypeScript** (strict) |
| Data | **PostgreSQL** with **Prisma 7** using the `pg` driver adapter (no engine binary) |
| Mutations | **Server Actions** (`src/actions`), each re-checking authentication and store ownership |
| Reads | Server Components querying through Prisma; small client components only where interactivity is needed |
| Validation | **Zod** schemas in `src/lib/validation.ts`, shared by the browser (instant feedback) and the server (authoritative) |
| Auth | Custom sessions: **scrypt** password hashing, random 32-byte session token in an `httpOnly`, `SameSite=Lax` cookie; only its SHA-256 is stored in the database |
| Styling | One hand-written stylesheet (`src/app/globals.css`) — no CSS framework |
| Movie data | **TMDB** via server-side calls with a 6-second timeout and graceful fallback |
| Tests | **Vitest** (unit + database integration) and the **axe** accessibility engine for audits |
| Hosting | Designed for **Netlify** (serverless): no in-process state, DB-backed rate limiting |

**Conventions worth knowing**

- `proxy.ts` (Next 16's replacement for middleware) is only an *optimistic* cookie gate. Real authentication and authorization happen in the data layer (`lib/session.ts`, `lib/store-access.ts`) on every page and action.
- The current store is **always resolved on the server from the session's membership** (`requireStore()`); no store ID is ever accepted from the browser.
- Domain logic that must be shared or tested lives in small pure modules: `pricing.ts` (money/tax), `late-fees.ts`, `membership.ts`, `tz.ts`, `function-keys.ts`, `report-range.ts`.
- Blank-form defaults live in `lib/form-defaults.ts` (a plain module) because constants exported from `"use client"` files cannot be read on the server.

### Time zones

Each store has an IANA time zone (`StoreSettings.timezone`). "Today", due dates, lateness, overdue, receipts, transaction times and every report/filter range use the store's local calendar day. `lib/tz.ts` handles daylight-saving transitions; **Arizona (`America/Phoenix`) is UTC-7 all year** and is covered by tests alongside New York's spring-forward/fall-back days.

---

## Data model

Defined in `prisma/schema.prisma` (15 migrations under `prisma/migrations`). Every store-owned table carries `storeId`, and child tables use **composite `(storeId, id)` foreign keys**, so the database itself refuses cross-store references.

| Entity | Purpose |
|---|---|
| `User`, `Session`, `LoginAttempt` | Accounts, hashed session tokens, failed-login log for rate limiting |
| `Store`, `StoreMember` | A store and who can access it (`OWNER` / `MANAGER` / `EMPLOYEE`; v1.0 UI uses one owner). Holds per-store counters for membership, copy and transaction numbers |
| `StoreSettings` | Currency, time zone, tax, store year, fees, membership rules, system settings |
| `StoreFormat` | Formats carried (VHS, DVD, Blu-ray, LaserDisc, video games, other) and each format's default rental category |
| `RentalCategory` | Price, duration, late fee/day, optional max late fee, taxable, replacement behaviour |
| `Customer` | Member record, status, notes, fees, membership dates |
| `MovieTitle` | Title metadata (TMDB id, poster path, director, cast…) |
| `InventoryCopy` | One row per physical copy: format, status, condition, barcode, category, replacement cost |
| `Rental` | Customer ↔ copy, price, due date, return date and outcome, calculated vs charged late fee, other/rewind fees |
| `Transaction`, `TransactionItem` | Financial records (`RENTAL`, `RETURN`, `RETAIL_SALE`, `MEMBERSHIP_FEE`, …) and merchandise lines (name/price snapshots) |
| `ConcessionCategory`, `ConcessionItem` | Editable merchandise categories and items |

Database `CHECK` constraints back up the code: stock ≥ 0, retail price ≥ 0, fees and membership settings ≥ 0, transaction-item quantity > 0.

---

## Security

- **Authentication** — scrypt-hashed passwords; session tokens are random and only their hash is stored; cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production; sessions last 30 days.
- **Rate limiting** — failed sign-ins are logged in the database (so it works across serverless instances): 8 failures per 15 minutes per e-mail and per IP.
- **Multi-tenant isolation** — the store is derived from the session, every query is filtered by it, updates include the store in their `WHERE` clause, and composite foreign keys prevent cross-store links. Another store's record IDs simply return "not found".
- **Authorization** — server actions re-verify the user and role. Employees cannot change settings or override restrictions; only owners can clear store data.
- **Input validation** — everything is validated server-side with Zod, including IDs supplied by the browser (categories, format defaults, poster paths, TMDB ids).
- **Secrets** — TMDB credentials and the database URL live only in server-side environment variables. Nothing secret reaches client code.
- **Payments** — simulated only; nothing is sent to any payment processor.

---

## Project structure

```
videomaster/
├── docs/videomaster_spec.md      Product specification (source of truth)
├── CLAUDE.md                     Development rules for this repository
├── PROGRESS.md                   What is done, decisions, known issues, next steps
├── prisma/
│   ├── schema.prisma             Data model
│   └── migrations/               SQL migrations (some hand-written for data preservation)
├── scripts/
│   └── fetch-sample-titles.mjs   One-time TMDB fetch that writes src/lib/sample-titles.json
├── src/
│   ├── proxy.ts                  Optimistic auth gate (Next 16 "proxy", formerly middleware)
│   ├── app/
│   │   ├── (auth)/               login, signup
│   │   ├── (app)/                every signed-in screen (menu, customers, inventory, rent, return, …)
│   │   ├── globals.css           The whole retro visual system
│   │   └── layout.tsx            Root layout and page-title template
│   ├── actions/                  Server actions: auth, store, customers, inventory, rentals, returns, concessions, sample
│   ├── components/               Client components (forms, checkout/return UIs, dialog, function keys, print button)
│   └── lib/                      Domain logic: db, session, store-access, validation, pricing, late-fees, overdue,
│                                 membership, tz, tmdb, reports, transactions, sample-store, form-defaults, …
│       └── __tests__/            Unit tests and the database integration test
├── netlify.toml                  Build command, Node version, production-only migrations
├── prisma.config.ts              Prisma CLI configuration
└── vitest.config.ts              Test configuration
```

`src/generated/` (the Prisma client) is git-ignored and rebuilt by `prisma generate`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Regenerates the Prisma client, then starts the dev server on port 3000 |
| `npm run build` | Regenerates the client and builds for production |
| `npm start` | Serves the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (the database test is skipped without a test DB) |
| `npm run test:db` | Migrates a spare `videomaster_test` database and runs the sample-store integration test (create it once with `createdb videomaster_test`; override with `TEST_DATABASE_URL`) |
| `python3 scripts/generate-brand-images.py` | Regenerates the link-preview image, app icon and favicon (`src/app/opengraph-image.png`, `twitter-image.png`, `apple-icon.png`, `favicon.ico`); needs Pillow and macOS Menlo |
| `node scripts/fetch-sample-titles.mjs` | Regenerates `src/lib/sample-titles.json` from TMDB (needs a TMDB credential in `.env`) |

---

## Testing and quality

Before every milestone: lint, type-check, unit tests, production build, and a manual/browser run of the affected workflow.

- **Unit tests (92)** cover validation rules (negative prices/tax/quantities, dates, fees, categories), money and tax rounding, late fees and the store-local calendar, overdue boundaries, membership terms, time zones (Arizona and DST), report ranges, function-key mapping and form defaults.
- **Database integration test (6)** builds the sample demo store in the Arizona, Hawaii and New York zones and asserts hard invariants: a RENTED copy has exactly one open rental; no overlapping rentals of one copy; nothing rented after being lost/damaged; contiguous transaction numbers; every transaction's total = subtotal + tax; rentals + merchandise + fees + tax = total revenue; no negative stock; overdue counted in store-local days; refusal to load into a non-empty store; clean clear-and-reload.
- **Accessibility audits** were run with the axe engine over every screen (0 violations), plus keyboard/dialog checks and 375 px / 320 px layout measurements.
- The migration path is exercised from scratch on the test database each time `test:db` runs.

---

## Deploying (Netlify + Supabase)

**1. Database (Supabase).** Create a project (choose a region near Netlify, e.g. US East) and set a database password. Open **Connect** and copy **two** strings from the **Shared Pooler** (put your password where it says `[YOUR-PASSWORD]`, brackets removed):

- **Transaction mode** (port `6543`) → the running app (`DATABASE_URL`). It is designed for serverless, where many short-lived function instances each open connections.
- **Session mode** (port `5432`) → migrations (`MIGRATE_DATABASE_URL`), which need session features.

Do *not* use the "Direct connection" (IPv6-only on the free plan; Netlify builds are IPv4). Using session mode for the running app is tempting but it allows only about 15 simultaneous clients, and a redeploy (old instances still holding connections while new ones start) can exhaust it and produce "This page couldn't load".

**2. Site.** Netlify → *Add new site → Import from Git* → choose this repository. `netlify.toml` sets the build command and Node 22.

**3. Environment variables** (Site configuration → Environment variables; scope each to **Builds** *and* **Functions**):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase Shared Pooler, **Transaction mode** string (port 6543) |
| `MIGRATE_DATABASE_URL` | Supabase Shared Pooler, **Session mode** string (port 5432) |
| `DB_POOL_MAX` | `3` (connections per function instance) |
| `TMDB_API_KEY` *(or `TMDB_READ_ACCESS_TOKEN`)* | your TMDB credential |

Optional: `DB_SSL=no-verify` (applied automatically for Supabase hosts: the connection is encrypted but the pooler's certificate chain is not verified, because Node's default trust store rejects it).

**4. Deploy.** Production builds run `npx prisma migrate deploy` before `next build`; deploy previews **do not** migrate, so they cannot touch production data. The hosted database starts empty: sign up on the live site and (optionally) load the sample store.

Nothing relies on in-process state, so the app is safe on serverless functions, and no session secret is needed (sessions are random tokens stored in the database). This path has been prepared and the connection code unit-tested, but it has not been run against Supabase or on Netlify itself.

---

## Development notes and gotchas

- **Restart after schema changes.** Run `npx prisma migrate deploy` and restart `npm run dev` (see above).
- **Creating migrations.** `prisma migrate dev` refuses non-interactive shells when it warns about data changes; in that case generate SQL with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, save it as a new `prisma/migrations/<timestamp>_<name>/migration.sql`, and apply with `prisma migrate deploy`. Data-preserving changes (for example replacing an enum with a table) are hand-written; take a `pg_dump` first.
- **Second dev server.** Next.js allows one dev server per build folder. Set `NEXT_DIST_DIR=.next-test` to run another (git-ignored, ignored by ESLint).
- **Prisma is pinned to 7.x.** `npm` may offer an 8.0 release candidate with a different CLI; do not upgrade until it is stable.
- **Next.js 16 differences.** `proxy.ts` replaces `middleware.ts`; `params`, `searchParams` and `cookies()` are async. `AGENTS.md` points contributors at the bundled Next docs in `node_modules/next/dist/docs/`.
- **Server vs client modules.** Non-component exports of `"use client"` files (constants, helpers) cannot be read or spread in Server Components — keep shared constants in `lib/`.
- **Money.** Use `lib/pricing.ts` (integer cents). Never add or compare currency as floating-point.
- **Dates.** Never format or compare dates with `toISOString()` / UTC for business logic; use `lib/tz.ts` with the store's zone.

---

## Design principles

The visual identity is deliberate and protected (see `CLAUDE.md`):

- **Do:** deep DOS-blue background, light-gray monospace text, cyan secondary text, yellow warnings, red errors/overdue, square controls, thin/double borders, dense readable layouts, retro dialogs, minimal animation.
- **Don't:** modern SaaS cards, rounded tiles, gradients, glassmorphism, floating buttons, giant headings, icon overload, Material/Tailwind looks, cyberpunk/synthwave/arcade styling.
- **Rule of thumb:** when authenticity and usability conflict, keep the retro *appearance* and choose the more usable *interaction*.
- Warnings never rely on colour alone; contrast is at least 4.5:1; every action is a real button or link.

---

## Known limitations

- Payments are simulated (there is no cash drawer or end-of-day cash count). Refunding a rental charge returns money only (a video still out is returned separately); a transaction with any refund cannot be voided.
- One store per user in the UI; the membership table supports employees/managers but there is no screen to invite them yet.
- No password reset or e-mail features (out of scope for this local project). Titles cannot be edited after adding (copies can).
- Reports are computed live (fine at store scale) and there is no CSV export.
- Print layout uses standard browser printing (not verified on a thermal receipt printer); layouts were verified by measurement, not by human review at every size.
- Not yet run on a live Netlify deployment.

---

## Project documents

- **`docs/videomaster_spec.md`** — the complete product specification.
- **`CLAUDE.md`** — persistent development rules (architecture, UI, workflow, testing, git).
- **`PROGRESS.md`** — completed milestones, decisions to preserve, known issues and what is next.

---

## Credits

Movie metadata and posters are provided by [TMDB](https://www.themoviedb.org/). *This product uses the TMDB API but is not endorsed or certified by TMDB.*

VideoMaster is an original design and does not use any real video-store branding, logos or trademarks. All sample customers are fictional. No open-source license has been specified for this repository.
