# VideoMaster — Progress

## Completed
**Milestone 1 — Foundation & first run**
- Next.js 16 (App Router) + TypeScript + PostgreSQL + Prisma 7 (`pg` driver adapter).
- Auth: sign up, log on, log off, protected routes (`proxy.ts` optimistic gate + DB-verified session in the data layer).
- Multi-store model: `User` → `StoreMember` (role) → `Store`; store always resolved server-side from the session.
- First-run store setup (store info, store year, formats, rental categories) → main menu.
- Store Settings screen (edits everything from setup, incl. adding/removing categories).
- Main menu with all nine items; unbuilt ones are disabled and labelled "NOT YET INSTALLED".
- Retro UI (DOS-blue, monospace, square bevelled buttons, double-line frame); real inputs/selects/checkboxes.
- Validation shared client/server (zod): no negative prices/tax/late fees, durations 1–90 whole days, etc.
- Tests: 14 unit tests (validation, password hashing). Manual end-to-end pass of the full
  signup → setup → menu → settings edit → log off → log on flow, plus two-account isolation check.

**Milestone 5 — Customers**
- Customers list with forgiving multi-term search (first/last name, phone incl. digits-only, membership #, ID), 25/page pagination, clickable rows.
- Add / view / edit customer; account status (GOOD/OVERDUE/BLOCKED/SUSPENDED/CLOSED) with warning banners; outstanding fees display.
- Per-store atomic membership numbers (`Store.nextMembershipNumber`, 6-digit zero-padded).
- All customer reads/writes scoped by the session's store; other stores' IDs 404. Verified with two accounts.
- Main menu CUSTOMERS is live. 19 unit tests total.

**Milestones 6–8 — Movie search, inventory, individual copies**
- TMDB search (server-side only; accepts `TMDB_READ_ACCESS_TOKEN` or `TMDB_API_KEY`), 6s timeout, graceful "unavailable / not configured" state with manual-entry fallback. Optional store-year filter (with SHOW ALL YEARS toggle).
- Add title from TMDB (prefills director, runtime, genres, cast, MPAA rating, plot, poster) or manually; all fields editable. Metadata is stored locally; poster is the only thing loaded from TMDB at view time.
- Adding N copies creates N `InventoryCopy` rows (`VHS-000001` style IDs from a per-store counter). Re-adding an existing movie adds copies to the existing title — never a duplicate.
- Title page: per-format totals/available/rented/damaged/lost, per-copy list, ADD COPIES. Copy page: status, condition, category, barcode (unique per store), replacement cost, notes; RETIRED copies excluded from totals; status locked while RENTED/OVERDUE.
- Inventory search: title, year, director, actor, genre, copy ID, barcode + format/category/availability filters, paginated.
- 30 unit tests total. Verified end-to-end against live TMDB.

## Current Work
Nothing in progress.

## Known Issues
- Title metadata cannot be edited after adding (only copies); spec's title [ EDIT ] / [ RETIRE COPY ] buttons: retire is done via copy status, title edit is not built.
- Rental price/period come from the rental category; no per-copy or per-format price override yet.
- Inventory reports/rental counts on the title page await rentals (RENT button is disabled).
- Cross-store isolation for inventory was verified by code path (all queries scoped by session store), not re-tested in the browser with two stores.
- Customers: no delete (use status CLOSED); rental/purchase history and configurable warnings await rentals; no duplicate-customer detection.
- `Customer.phoneDigits` is maintained by the create/update actions only — any future import path must set it too.
- No password reset yet (spec §32) — needs an e-mail provider.
- Setup is one scrolling form, not a multi-step wizard.
- Only VHS/other format toggles are stored; per-format pricing is not modelled yet.
- Double-submit protection for store creation is a transaction re-check, not a DB constraint.
- Category-removal path (retire vs delete when copies exist) is untested until inventory exists.
- No automated browser/E2E or DB-backed integration tests yet.
- F-key labels are decorative; no keyboard shortcuts implemented (optional per spec).
- `npm audit` reports advisories in transitive deps; not reviewed.

## Next
Milestone 9 — Rental checkout (customer → rental → physical copy, due dates from category policy).

## Decisions
- Browser-based web app only (Next.js/React/HTML/CSS/TS). Never native/Electron/desktop/CLI.
- Hosting: **Netlify** (serverless) → no in-process state; login rate limiting is DB-backed (`LoginAttempt`); `DATABASE_URL` env var; `npm run build` runs `prisma generate`.
- Auth is custom on purpose: scrypt password hashes, random 32-byte session token in an httpOnly/SameSite=Lax cookie, only its SHA-256 stored in `Session`. Revisit (e.g. Better Auth) when adding password reset/e-mail.
- Authorization: never accept `storeId` from the browser; use `requireStore()`. Client-supplied child IDs (categories) are checked against the store's own rows.
- Schema has composite `(storeId, id)` FKs on store-owned children so the DB blocks cross-store references. Money = `Decimal`. Copies are rows, never a quantity column.
- Store number stored as zero-padded 4+ digit string. Tax % is `Decimal(6,3)` (0–30).
- Prisma pinned to 7.x (npm resolved an 8.0 RC; do not upgrade until stable). Generated client is gitignored (`src/generated`).
- Product spec: `docs/videomaster_spec.md` (referenced by CLAUDE.md).
