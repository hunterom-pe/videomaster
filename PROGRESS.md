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

## Current Work
Nothing in progress.

## Known Issues
- No password reset yet (spec §32) — needs an e-mail provider.
- Setup is one scrolling form, not a multi-step wizard.
- Only VHS/other format toggles are stored; per-format pricing is not modelled yet.
- Double-submit protection for store creation is a transaction re-check, not a DB constraint.
- Category-removal path (retire vs delete when copies exist) is untested until inventory exists.
- No automated browser/E2E or DB-backed integration tests yet.
- F-key labels are decorative; no keyboard shortcuts implemented (optional per spec).
- `npm audit` reports advisories in transitive deps; not reviewed.

## Next
Milestone 5 — Customers (list, search, add/edit, membership numbers, account status).

## Decisions
- Browser-based web app only (Next.js/React/HTML/CSS/TS). Never native/Electron/desktop/CLI.
- Hosting: **Netlify** (serverless) → no in-process state; login rate limiting is DB-backed (`LoginAttempt`); `DATABASE_URL` env var; `npm run build` runs `prisma generate`.
- Auth is custom on purpose: scrypt password hashes, random 32-byte session token in an httpOnly/SameSite=Lax cookie, only its SHA-256 stored in `Session`. Revisit (e.g. Better Auth) when adding password reset/e-mail.
- Authorization: never accept `storeId` from the browser; use `requireStore()`. Client-supplied child IDs (categories) are checked against the store's own rows.
- Schema has composite `(storeId, id)` FKs on store-owned children so the DB blocks cross-store references. Money = `Decimal`. Copies are rows, never a quantity column.
- Store number stored as zero-padded 4+ digit string. Tax % is `Decimal(6,3)` (0–30).
- Prisma pinned to 7.x (npm resolved an 8.0 RC; do not upgrade until stable). Generated client is gitignored (`src/generated`).
- Product spec: `docs/videomaster_spec.md` (referenced by CLAUDE.md).
