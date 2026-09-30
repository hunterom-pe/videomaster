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

**Milestone 9 — Rental checkout**
- RENT VIDEO: pick customer → checkout screen (customer + account status, cart, rentals/tax/total, due dates) → retro CONFIRM RENTAL dialog → TRANSACTION COMPLETE screen.
- Add rentals by title search (auto-picks first available copy, or pick a specific copy) or by exact copy ID / barcode.
- Server re-verifies everything (client sends only copy IDs + payment method): store ownership, customer status, price/due date from the copy's rental category, tax (integer cents, half-up, per-category taxable flag). Copies are claimed with a conditional `AVAILABLE → RENTED` update inside one DB transaction, so two clerks can't rent the same copy; failures roll back cleanly.
- Customer status rules: CLOSED = no rentals; BLOCKED/SUSPENDED/OVERDUE = manager override (owner/manager role only) with an explicit checkbox.
- New `Transaction` (per-store numbering, type/payment method/subtotal/tax/total) and `Rental.price`. Active rentals now show on the customer account. Simulated payment methods only.
- 34 unit tests. Verified in browser incl. override refusal and a simulated race.

**Milestones 10–11 — Returns and late fees**
- RETURN VIDEO: list of everything currently out (oldest due first, days-late highlighted); search by copy ID, barcode, title, customer name/member #/phone. Click a row → return screen (movie, copy, customer, rented, due, returned, days late, late fee).
- Late fee = whole calendar days past due × the category's per-day fee, capped by the category's optional max. Both the calculated and the actually charged fee are stored (`Rental.calculatedLateFee` / `chargedLateFee`); fee can be reduced or waived, never raised above policy.
- Outcomes: normal return → copy AVAILABLE; [ DAMAGE ] → copy DAMAGED (+ optional damage fee); [ LOST ] → copy LOST, replacement cost charged (from copy's replacement cost, editable), no late fee. Confirm dialog, then a RETURN transaction (per-store numbering, notes record waivers/reductions) and a completion screen.
- Concurrency-safe: guarded close (`returnedAt IS NULL`), all writes in one DB transaction; already-returned rentals show a notice.
- 41 unit tests. Verified in browser: 3-days-late reduced fee, lost item, on-time return.

**Milestone 12 — Concessions (merchandise inventory)**
- CONCESSIONS screen: searchable/filterable catalog (name, SKU, barcode; category; show-inactive), paginated. Add / edit item: SKU (auto `C001`/`P001`/`D001`… numbered per category letter, or manual; fixed after creation), name, category, retail price, optional cost, taxable, quantity on hand, low-stock threshold, active, optional barcode.
- Low-stock warnings: `*** C003 TWIZZLERS: LOW STOCK (4 ON HAND) ***` banner on the concessions screen (whole active catalog) plus a line on the main menu; OUT OF STOCK highlighted.
- Receive stock via atomic increment. Negative price/quantity blocked in the UI, the server, and by DB CHECK constraints (`quantityOnHand >= 0`, `retailPrice >= 0`).
- 47 unit tests.

**Milestone 13 — Combined POS transactions**
- Checkout now takes rentals AND merchandise in one transaction: ADD RENTAL (customer checkouts) + ADD SALE ITEM (clickable category buttons `[ CANDY ]`, `[ POPCORN ]`… or search by name/SKU/barcode; `[ - ]`/`[ + ]` quantity buttons). Totals: RENTALS / MERCHANDISE / TAX / TOTAL. Walk-in merchandise-only sales at `/sale` (no customer; type RETAIL_SALE) from `[ SELL MERCHANDISE ]` on Concessions and `[ SELL MERCHANDISE ONLY ]` on the customer picker.
- Server-authoritative: prices/tax/due dates from the DB; merchandise stock is decremented atomically with a conditional update (`quantityOnHand >= qty`), so stock can never go negative even with two clerks; any failure (unavailable copy, insufficient stock) rolls back the whole transaction, including rental claims. Verified with simulated races.
- New `TransactionItem` (snapshot of SKU/name/price/qty/taxable per merchandise line). One tax computation over all taxable lines, rounded half-up.
- Acceptance scenario verified: T2 10 total / 9 available / 1 rented; Sour Patch Kids 9 on hand; Sarah's active rental; sample receipt math ($7.47 + $0.64 = $8.11).
- 50 unit tests.

**Milestone 14 — Transaction history**
- TRANSACTIONS screen: newest-first list with filters (transaction # / customer name / member # / "walk-in", type, payment method, from/to date), pagination, and a count + total-collected summary for the filtered set. Rows are clickable.
- Transaction detail: type, date/time, customer link, employee (user who rang it), payment, notes, rentals (with current status), returned items (outcome, calculated vs charged late fee, other fees), merchandise lines, subtotal/tax/total.
- Store-scoped queries; junk filter values are ignored. 53 unit tests.

**Milestone 15 — Receipts**
- Retro receipt screen (`/receipt/[id]`): store header (name/number/address/phone/slogan), date (MM/DD/YYYY), transaction #, customer, line items (rentals, merchandise with qty, returned items with late/damage/lost fees and WAIVED/REDUCED labels), subtotal/tax/total, payment method, per-title DUE dates and "PLEASE REWIND" for rentals, "THANK YOU!".
- Shown automatically after every checkout and return (replaces the old completion screens; `/rent/done/*` and `/return/done/*` redirect to it). `[ PRINT ]` uses the browser's print dialog; print CSS hides the app chrome and prints black-on-white. `[ RECEIPT ]` on any transaction detail reprints it (marked `** REPRINT **`).
- 54 unit tests.

**Milestone 16 — Overdue management**
- OVERDUE is **derived on read** (unreturned and due before today, in the store's time zone) — never stored, so it can't go stale on a serverless host with no background job. `effectiveStatus()`: a GOOD customer with overdue rentals behaves as OVERDUE; manual statuses (BLOCKED/SUSPENDED/CLOSED) always win.
- OVERDUE RENTALS screen: customer (link to account), phone, title, copy, due date, days late (yellow, red `***` beyond 7 days), accrued late fee per video, customer balance (accrued fees + outstanding fees); worst first; row click opens the return screen; summary banner (videos, customers, accrued fees). Menu shows `OVERDUE: n` in red and on the button.
- Customer account: `*** ACCOUNT OVERDUE ***` banner with per-rental RETURN buttons and accrued fees; days-late column. Customer lists show effective status. Checkout requires manager override for rentals on effectively-overdue accounts (merchandise-only sales are never blocked). Title page shows an OVERDUE column and marks overdue copies.
- Verified: boundary case (due earlier today = not overdue), return clears overdue status. 57 unit tests.

**Milestone 17 — Reports**
- REPORTS index + seven printable reports (spec §23), each with `[ PRINT ]` (print CSS → black on white, header with store/period): Daily Activity (rentals, returns, merchandise units/$, rental revenue, late/damage fees, tax, total, transactions), Overdue Rentals, Inventory (titles/copies by status and format, overdue derived), Popular Rentals (ranked), Customer Activity (top customers), Merchandise Inventory (units, retail value, low/out of stock), Revenue (rental + merchandise + fees + taxes = total, by payment method).
- Date filters (store-local `YYYY-MM-DD`): single date for Daily; from/to for Popular, Customers, Revenue (default last 30 days). Invalid input falls back with a notice; reversed ranges swap.
- Verified against independent SQL: report totals equal raw sums and the identity rentals + merchandise + fees + tax = total holds.
- Main menu: all nine items live (placeholder code removed) in spec order. 61 unit tests.

**Optional fees & membership rules** (Store Settings sections 5–6; everything optional, `0` = off)
- Fees: rewind fee (VHS "not rewound" checkbox on return), damage fee (suggested when DAMAGE is chosen; editable), lost-item fee (added to the copy's replacement cost on LOST; editable), default replacement cost (prefills new copies). The rewind amount always comes from settings, never from the browser. Rewind/other fees appear on receipts, transaction detail and the Daily report.
- Membership: fee collected when a customer is added (checkbox to waive, payment method, membership-fee receipt) and on `[ RENEW MEMBERSHIP ]`; term in months (0 = never expires; renewal extends from the later of now/current expiry); max videos out per customer. Expired membership and over-limit rentals need a manager override at checkout, alongside account-status reasons (all reasons listed together, enforced on the server); merchandise-only sales are never blocked. New `MEMBERSHIP_FEE` transaction type is counted under fees in Revenue/Daily reports (reports still reconcile).
- DB CHECK constraints keep fees/limits non-negative. 71 unit tests.

**Store time zone** (Store Settings → Store Information)
- IANA zone per store (`StoreSettings.timezone`, default `America/Phoenix`; first-run setup pre-selects the browser's zone). Curated list includes **Arizona (Phoenix, MST, no daylight saving)**, Hawaii, all US/Canadian zones, London/Paris/Sydney, UTC.
- Everything date-related now uses the store's calendar day: due dates and receipt dates, days late / late fees, OVERDUE (derived), report and transaction-history date filters and ranges, transaction times (shown with the zone abbreviation, e.g. MST), membership expiry dates. New `lib/tz.ts` handles daylight-saving transitions (unit-tested for Phoenix and New York spring-forward/fall-back).
- Fixes the earlier UTC limitation (an 8pm Arizona rental no longer rolls to "tomorrow"). Verified live: a rental due 8pm today (Arizona) is on time; one due 10pm yesterday is 1 day late; switching the store to Eastern changes both correctly. 83 unit tests.

**Sample demo store** (spec §30)
- First-run setup has `LOAD SAMPLE STORE DATA?`; Store Settings has `[ LOAD SAMPLE STORE DATA ]` (only into an EMPTY store — refused otherwise) and an owner-only, typed-confirmation `[ CLEAR ALL STORE DATA ]` (keeps settings/categories/formats; resets counters) so the demo can be removed and real data started.
- Contents: 28 classic movies with real TMDB metadata + posters (fetched once by `scripts/fetch-sample-titles.mjs` into `src/lib/sample-titles.json`, so loading works offline), 22 fictional customers (555-01xx phones; one suspended, one lapsed membership when a term is set), 16 merchandise items (with low-stock and out-of-stock examples), VHS copies (plus DVD copies when DVD is enabled), and 3 weeks of deterministic history: ~90 rental transactions, ~130 return transactions (on-time, late, waived/reduced fees, one lost, a few damaged, rewind fees if configured) and walk-in sales — including 3+ currently overdue videos and activity today. All in the store's own time zone.
- Verified by SQL invariants and an automated database test (`npm run test:db`, uses the spare `videomaster_test` DB; runs the generator in Arizona, Hawaii and New York zones): no double-rented copies, nothing rented after lost/damaged, contiguous transaction numbers, every transaction adds up, rentals + merchandise + fees + tax = total, no negative stock, overdue measured in store-local days, clear + reload works.

**Polish step 1 — Accessibility**
- Audited all 28 screens with the axe engine (loaded into a live page): findings were red-on-blue contrast (4.26:1), missing landmarks, no heading on receipts. Now **0 violations on every screen**; red raised to `#ff7070` (4.98:1), disabled buttons made legible (and struck through, not colour-only).
- Landmarks (`header`/`main`/`footer`), "SKIP TO MAIN CONTENT" link, unique per-page titles via Next metadata (`CUSTOMERS — VIDEOMASTER`), sr-only h1 on receipts.
- Confirmation dialogs are now real modals (`RetroDialog`): overlay, focus moves in (starting on `[ NO ]` so a stray Enter/scanner can't confirm), Tab trapped, Escape cancels, focus restored. Previously they rendered below the fold.
- Form errors are linked to their fields (`aria-describedby`); live regions for checkout search results and totals; whole-row link focus ring; error/warning colours never the only signal (text/labels always present).
- Verified with axe re-run, and dialog keyboard behaviour via dispatched key events (the browser pane can't send real keys while hidden).

**Polish step 2 — Phone-width / responsive**
- Measured all screens in 375px frames (and key screens at 320px): sideways page scroll, overflowing elements outside scroll containers, and tap targets under 32px. Found two overflows (customer account, revenue report — long label/value rows); fixed globally: label/value grids shrink and wrap, and stack (label above value) under 520px; tighter padding on phones. Now zero overflow on every screen at 375px and on key screens at 320px; no undersized tap targets (buttons ≥34px tall). Wide tables scroll inside their own container (as the spec requires) instead of scrolling the page.
- Not verified visually (browser pane could not render screenshots in this environment) — measurements only.

**Polish step 3 — System settings & function keys**
- New Store Settings section *System Settings*: `ENABLE FUNCTION-KEY SHORTCUTS (F1-F9)` and a custom receipt closing message (default `THANK YOU!`, ≤40 chars).
- F-key numbering now follows the spec (F1 rent, F2 return, F3 customers, F4 inventory, F5 concessions, F6 reports, F7 overdue, F8 transactions, F9 settings); labels on the menu use one shared map (`lib/function-keys.ts`). Shortcuts are **off by default** (they are browser keys) and, when on, never intercept modified keys (Ctrl/Alt/Cmd/Shift), F10-F12, or anything while a dialog is open. Clicking always works.
- Verified: OFF does nothing; ON navigates F1/F3/F6/F9; Ctrl+F5 and F12 left alone; F3 ignored with a dialog open; custom message on the receipt. 87 unit tests.

**Polish step 4 — Settings organised by the spec's sections + inventory settings**
- Store Settings now follows spec §25 with a jump index: Store Information, Tax Settings, Store Year, Formats Carried, Rental Pricing/Categories & Late Fees, Optional Fees, Inventory Settings, Membership Rules, System Settings (+ Sample Data on setup).
- **Per-format pricing** (spec §10): each carried format can have a *default rental category*; choosing a format when adding copies preselects it (and shows that category's price). To price DVDs differently, create e.g. "DVD NEW RELEASE" and make it DVD's default. Server checks the id belongs to the store's own kept categories (never trusts the browser); FK is `ON DELETE SET NULL`.
- Inventory settings: default replacement cost (moved here) and default low-stock threshold (prefills new merchandise). DB CHECK keeps the threshold non-negative. 88 unit tests.

**Polish step 5 — Editable concession categories**
- Merchandise categories are now a per-store table (`ConcessionCategory`: name, SKU letter, order, active) editable in Store Settings → *Concession Categories* (and in first-run setup, prefilled with the six defaults). Replaces the fixed enum; hand-written data migration preserved every existing item (verified before/after, database backed up first, Prisma reports zero schema drift).
- Removing a category deletes it if unused, otherwise **retires** it (items keep it and show `NAME (RETIRED)` when edited); adding a retired name brings it back. Names unique per store (case-insensitive), 1–20 categories, SKU letter A–Z. Server verifies every category id against the store; new items get SKUs from their category's letter (C001, F001…).
- Sale-screen category buttons, concessions filters/lists, forms, reports and the sample-data generator all use the store's categories.
- Bug found and fixed during verification: blank-form constants exported from client component files were being *spread* by a server page (arrived empty) and broke saving new merchandise — introduced in step 4. Defaults now live in `lib/form-defaults.ts` (a plain module) with a regression test. 92 unit tests + 6 DB tests.

**Polish step 6 — Detailed README**
- README rewritten: overview, feature list, prerequisites/quick start (incl. Homebrew Postgres), configuration table, screens/routes table, workflows, sample demo store, keyboard shortcuts, business rules, architecture, data model, security model, project structure, scripts, testing/quality, Netlify deployment, development gotchas (restart after schema changes, hand-written migrations, second dev server, Prisma pin, Next 16 differences, client-module constants), design principles, known limitations, credits (TMDB attribution).

**Supabase-ready connection handling**
- `lib/db-config.ts` (unit-tested): for Supabase hosts (or `DB_SSL=no-verify`) strips `sslmode` from the URL and connects with encrypted-but-unverified TLS (Node rejects the pooler's certificate chain, and `sslmode=` in a URL overrides an explicit `ssl` option); caps the pool (`DB_POOL_MAX`, default 5) for serverless. Local/other hosts are unchanged. Docs say to use Supabase's **Session pooler** string for both `DATABASE_URL` and `MIGRATE_DATABASE_URL` (the direct connection is IPv6-only on the free plan; Netlify builds are IPv4).
- Not yet exercised against a real Supabase project.

**First Netlify deploy: secrets-scanning failure**
- Netlify failed the first build on *secrets scanning* (`DATABASE_URL`, `MIGRATE_DATABASE_URL`, `TMDB_API_KEY` values "detected"). Investigated: no real secret is committed (checked files + full git history), and a local production build with canary values shows none of them in any build output, the generated client, or the build log. Treated as a false positive and set `SECRETS_SCAN_OMIT_KEYS` for exactly those variables in `netlify.toml` (other secrets remain scanned). If it recurs, the Netlify log lists the exact file/line for each detection — check those before widening the omit list.

**Netlify runtime error after a redeploy ("This page couldn't load")**
- Likely cause: Supabase's **session-mode** pooler caps clients (~15); each Netlify function instance holds up to 5 and old instances keep theirs across a redeploy, so the pool is exhausted. Fix (config, no code change): runtime `DATABASE_URL` → **transaction-mode** pooler (port 6543; `@prisma/adapter-pg` does not use named prepared statements unless `statementNameGenerator` is set, so this is compatible), keep `MIGRATE_DATABASE_URL` on session mode (5432), set `DB_POOL_MAX=3`. Docs updated. Not yet confirmed from Netlify function logs.

**Link previews (iMessage/Slack/etc.) and icons**
- Open Graph + Twitter-card metadata in the root layout (title, description, site name) with a retro 1200×630 preview image (`opengraph-image.png`, `twitter-image.png` with alt text), plus a new favicon and Apple touch icon replacing the Next.js defaults. Absolute URLs via `metadataBase` (`SITE_URL` → Netlify `URL` → the videomaster-rms address). Images are generated by `scripts/generate-brand-images.py` (icons must be RGBA — an RGB .ico crashed Next's image decoder during testing).
- Verified in dev and in a production build: all tags present, image 200/`image/png` (50 KB), URLs resolve to the Netlify address, `SITE_URL` override works. iMessage caches previews per URL, so an already-sent link may keep the old (blank) preview.

**Feature 1 — Refunds and voids**
- Owner/manager only (re-checked server-side). Void (RENTAL / RETAIL_SALE, nothing returned or refunded): rentals deleted, copies back to AVAILABLE, stock restocked, transaction kept marked VOID with reason/user/snapshot and excluded from all totals. Refund: negative REFUND transaction linked to the original (`refundOfId`); merchandise lines by quantity (`TransactionItem.refundedQty`, optional restock), rental charges (`Rental.refundedAt`, money only), whole fee/membership payment (`Transaction.refundedAt`); proportional tax, the final refund returns the exact remaining tax. Concurrency-safe guarded updates.
- Reports/revenue show a REFUNDS row and net tax; history list shows VOID and excludes voids from the net total; receipts support REFUND and VOID. Logic in `lib/transaction-ops.ts` + `lib/refunds.ts`; unit tests + DB integration tests (`npm run test:db` now runs every `*.int.test.ts`).

## Current Work
Nothing in progress.

## Known Issues
- Reports: Popular/Customer reports count rentals *started* in the period (not only returned ones); no CSV export; reports are computed live (fine for MVP scale, may need indexes/caching for very large stores).
- Receipts: no cash-tendered/change lines (no cash-handling yet); print layout not verified on a physical/thermal printer (uses standard browser printing, ~38 char wide).
- The transaction-history list total is money collected across all types (fees on returns/memberships included).
- POS: no cash-tendered/change, no voids/refunds yet (Transaction types REFUND/FEE_WAIVER exist in the schema but are unused); a CLOSED customer cannot check out at all (use the walk-in sale for merchandise).
- Concessions: categories are a fixed list (not yet editable in Store Settings); no stock-adjustment history/audit log; items can't be deleted (deactivate instead). Selling happens in Milestone 13.
- Late fees are paid at return time only; no unpaid-balance tracking (`Customer.outstandingFees` is never changed yet), no rewind/membership/damage fee policy settings (damage/lost fees are entered manually).
- `InventoryCopy.status = OVERDUE` and stored `Customer.status = OVERDUE` are not written by the system (derived instead); manually choosing OVERDUE on a customer only has a display effect.
- Dev tip: after any Prisma schema change, restart `npm run dev` (Next caches the generated client). `NEXT_DIST_DIR` allows a second dev server for testing.
- Checkout: no cash-tendered/change calculation yet; no rental limits per customer; outstanding fees warn but don't block. Due date = rental time + N days (a timestamp; day-boundary rules to be decided with late fees).
- Rentals stay RENTED until returns exist (M10); OVERDUE status is not computed yet (M11/M16).
- Title metadata cannot be edited after adding (only copies); spec's title [ EDIT ] / [ RETIRE COPY ] buttons: retire is done via copy status, title edit is not built.
- Rental price/period come from the rental category; no per-copy or per-format price override yet.
- Inventory reports/rental counts on the title page await rentals (RENT button is disabled).
- Cross-store isolation for inventory was verified by code path (all queries scoped by session store), not re-tested in the browser with two stores.
- Customers: no delete (use status CLOSED); rental/purchase history and configurable warnings await rentals; no duplicate-customer detection.
- `Customer.phoneDigits` is maintained by the create/update actions only — any future import path must set it too.
- No password reset yet (spec §32) — needs an e-mail provider.
- Setup is one scrolling form, not a multi-step wizard.
- Per-format pricing is not modelled yet (price comes from the rental category).
- Double-submit protection for store creation is a transaction re-check, not a DB constraint.
- Category-removal path (retire vs delete when copies exist) is untested until inventory exists.
- No automated browser/E2E or DB-backed integration tests yet.
- F-key labels are decorative; no keyboard shortcuts implemented (optional per spec).
- `npm audit` reports advisories in transitive deps; not reviewed.

## Next
Queued by the owner (one at a time, push each): 2 cash tendered/change, 3 unpaid-balance tracking, 4 customer history, 5 rent again / return all, 6 membership cards with barcodes, 7 dark/phosphor-green theme toggle, 8 sound effects. Also requested: a one-click DEMO MODE on the login screen (pre-filled store).

(Earlier plan:) Polish & accessibility pass: keyboard/focus review, contrast, labels/table semantics, phone-width check, optional F-key shortcuts. Remaining optional spec items: concession categories editable in settings, inventory/system settings sections, per-format pricing overrides.

Deliberately dropped by the owner: password reset (small local project), editing a title's metadata after adding it.

## Decisions
- Browser-based web app only (Next.js/React/HTML/CSS/TS). Never native/Electron/desktop/CLI.
- Hosting: **Netlify** (serverless) → no in-process state; login rate limiting is DB-backed (`LoginAttempt`); `DATABASE_URL` env var; `npm run build` runs `prisma generate`.
- Auth is custom on purpose: scrypt password hashes, random 32-byte session token in an httpOnly/SameSite=Lax cookie, only its SHA-256 stored in `Session`. Revisit (e.g. Better Auth) when adding password reset/e-mail.
- Authorization: never accept `storeId` from the browser; use `requireStore()`. Client-supplied child IDs (categories) are checked against the store's own rows.
- Schema has composite `(storeId, id)` FKs on store-owned children so the DB blocks cross-store references. Money = `Decimal`. Copies are rows, never a quantity column.
- Store number stored as zero-padded 4+ digit string. Tax % is `Decimal(6,3)` (0–30).
- Prisma pinned to 7.x (npm resolved an 8.0 RC; do not upgrade until stable). Generated client is gitignored (`src/generated`).
- Product spec: `docs/videomaster_spec.md` (referenced by CLAUDE.md).
