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
- OVERDUE is **derived on read** (unreturned and due before today, UTC) — never stored, so it can't go stale on a serverless host with no background job. `effectiveStatus()`: a GOOD customer with overdue rentals behaves as OVERDUE; manual statuses (BLOCKED/SUSPENDED/CLOSED) always win.
- OVERDUE RENTALS screen: customer (link to account), phone, title, copy, due date, days late (yellow, red `***` beyond 7 days), accrued late fee per video, customer balance (accrued fees + outstanding fees); worst first; row click opens the return screen; summary banner (videos, customers, accrued fees). Menu shows `OVERDUE: n` in red and on the button.
- Customer account: `*** ACCOUNT OVERDUE ***` banner with per-rental RETURN buttons and accrued fees; days-late column. Customer lists show effective status. Checkout requires manager override for rentals on effectively-overdue accounts (merchandise-only sales are never blocked). Title page shows an OVERDUE column and marks overdue copies.
- Verified: boundary case (due earlier today = not overdue), return clears overdue status. 57 unit tests.

**Milestone 17 — Reports**
- REPORTS index + seven printable reports (spec §23), each with `[ PRINT ]` (print CSS → black on white, header with store/period): Daily Activity (rentals, returns, merchandise units/$, rental revenue, late/damage fees, tax, total, transactions), Overdue Rentals, Inventory (titles/copies by status and format, overdue derived), Popular Rentals (ranked), Customer Activity (top customers), Merchandise Inventory (units, retail value, low/out of stock), Revenue (rental + merchandise + fees + taxes = total, by payment method).
- Date filters (UTC `YYYY-MM-DD`): single date for Daily; from/to for Popular, Customers, Revenue (default last 30 days). Invalid input falls back with a notice; reversed ranges swap.
- Verified against independent SQL: report totals equal raw sums and the identity rentals + merchandise + fees + tax = total holds.
- Main menu: all nine items live (placeholder code removed) in spec order. 61 unit tests.

**Optional fees & membership rules** (Store Settings sections 5–6; everything optional, `0` = off)
- Fees: rewind fee (VHS "not rewound" checkbox on return), damage fee (suggested when DAMAGE is chosen; editable), lost-item fee (added to the copy's replacement cost on LOST; editable), default replacement cost (prefills new copies). The rewind amount always comes from settings, never from the browser. Rewind/other fees appear on receipts, transaction detail and the Daily report.
- Membership: fee collected when a customer is added (checkbox to waive, payment method, membership-fee receipt) and on `[ RENEW MEMBERSHIP ]`; term in months (0 = never expires; renewal extends from the later of now/current expiry); max videos out per customer. Expired membership and over-limit rentals need a manager override at checkout, alongside account-status reasons (all reasons listed together, enforced on the server); merchandise-only sales are never blocked. New `MEMBERSHIP_FEE` transaction type is counted under fees in Revenue/Daily reports (reports still reconcile).
- DB CHECK constraints keep fees/limits non-negative. 71 unit tests.

## Current Work
Nothing in progress.

## Known Issues
- Reports: dates are UTC days; Popular/Customer reports count rentals *started* in the period (not only returned ones); no CSV export; reports are computed live (fine for MVP scale, may need indexes/caching for very large stores).
- Receipts: no cash-tendered/change lines (no cash-handling yet); print layout not verified on a physical/thermal printer (uses standard browser printing, ~38 char wide).
- Transaction history shows times in UTC (no store timezone yet); the list total is money collected across all types (fees on returns included).
- POS: no cash-tendered/change, no voids/refunds yet (Transaction types REFUND/FEE_WAIVER exist in the schema but are unused); a CLOSED customer cannot check out at all (use the walk-in sale for merchandise).
- Concessions: categories are a fixed list (not yet editable in Store Settings); no stock-adjustment history/audit log; items can't be deleted (deactivate instead). Selling happens in Milestone 13.
- Dates/lateness use UTC calendar days (consistent with dates shown on screen). A store timezone setting is needed so a rental made in the evening doesn't roll to the next day; add with store settings.
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
- Only VHS/other format toggles are stored; per-format pricing is not modelled yet.
- Double-submit protection for store creation is a transaction re-check, not a DB constraint.
- Category-removal path (retire vs delete when copies exist) is untested until inventory exists.
- No automated browser/E2E or DB-backed integration tests yet.
- F-key labels are decorative; no keyboard shortcuts implemented (optional per spec).
- `npm audit` reports advisories in transitive deps; not reviewed.

## Next
Milestone 18 — Polish & accessibility: full keyboard/focus pass, contrast, form labels, table semantics, responsive checks, optional keyboard shortcuts (F-keys), store timezone, password reset, sample/demo data (spec §30), Store Settings sections (fees, membership rules), title edit.

## Decisions
- Browser-based web app only (Next.js/React/HTML/CSS/TS). Never native/Electron/desktop/CLI.
- Hosting: **Netlify** (serverless) → no in-process state; login rate limiting is DB-backed (`LoginAttempt`); `DATABASE_URL` env var; `npm run build` runs `prisma generate`.
- Auth is custom on purpose: scrypt password hashes, random 32-byte session token in an httpOnly/SameSite=Lax cookie, only its SHA-256 stored in `Session`. Revisit (e.g. Better Auth) when adding password reset/e-mail.
- Authorization: never accept `storeId` from the browser; use `requireStore()`. Client-supplied child IDs (categories) are checked against the store's own rows.
- Schema has composite `(storeId, id)` FKs on store-owned children so the DB blocks cross-store references. Money = `Decimal`. Copies are rows, never a quantity column.
- Store number stored as zero-padded 4+ digit string. Tax % is `Decimal(6,3)` (0–30).
- Prisma pinned to 7.x (npm resolved an 8.0 RC; do not upgrade until stable). Generated client is gitignored (`src/generated`).
- Product spec: `docs/videomaster_spec.md` (referenced by CLAUDE.md).
