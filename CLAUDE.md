# VideoMaster — Claude Code Project Instructions

## Project

**VideoMaster**  
**Video Rental Management System**  
**Version 1.0**

VideoMaster is a multi-user web application that simulates a fully functional independent video rental store management and point-of-sale system from approximately 1994–1999.

The complete product specification is located in:

`docs/videomaster_spec.md`

Read `docs/videomaster_spec.md` before making significant architectural, database, or UI decisions.

Treat that document as the source of truth for product behavior.

---

# Core Product Philosophy

The guiding principle is:

**1996 appearance. 2026 usability.**

VideoMaster should look like genuine 1990s video-store management software running on a beige PC and CRT monitor.

It should NOT behave like frustrating 1990s software.

Everything that logically appears interactive must be clickable with a mouse or touchscreen.

Keyboard shortcuts may exist as optional conveniences, but keyboard navigation must never be required.

---

# Non-Negotiable UI Rules

Do NOT turn VideoMaster into a modern SaaS dashboard.

Avoid:

- Modern dashboard cards
- Rounded cards everywhere
- Glassmorphism
- Gradients
- Floating action buttons
- Giant modern headers
- Excessive icons
- Pastel startup aesthetics
- Material Design styling
- Tailwind-style generic SaaS appearance
- Cyberpunk styling
- Synthwave styling
- Arcade-game styling

The target visual style is:

- Mid-1990s retail database software
- Deep royal blue background
- White/light-gray monospace text
- Cyan secondary text
- Yellow warnings
- Red errors and overdue alerts
- Square rectangular controls
- Dense information layout
- Thin or ASCII-inspired borders
- Retro dialog boxes
- Minimal animation

The software should take itself seriously.

The charm comes from looking like authentic business software from 1996.

---

# Interaction Rules

Every primary workflow must work with mouse/touch input.

Clickable elements include:

- Main menu options
- Movie rows
- Customer rows
- Inventory copies
- Buttons
- Reports
- Transaction rows
- Search results
- Settings
- Concession items

Function-key labels such as:

`[F1] RENT VIDEO`

may be shown for authenticity.

However, clicking the button must always perform the action.

Optional keyboard shortcuts may trigger the same actions.

Never require the user to memorize keyboard commands.

---

# Core Architecture

VideoMaster is a multi-user, multi-store application.

Each user's store data must remain isolated.

The architecture must support:

- Users
- Stores
- Store settings
- Rental categories
- Customers
- Movie titles
- Individual inventory copies
- Rentals
- Rental items
- Transactions
- Transaction items
- Payments
- Fees
- Concession inventory

Every store-owned record must securely resolve to the proper store.

Never rely on a client-provided `storeId` alone for authorization.

Verify ownership/server-side authorization for every protected operation.

---

# Movie Inventory Rule

This is critical.

Movies and physical copies are different entities.

Example:

`Terminator 2: Judgment Day`

is one MovieTitle record.

If the user adds quantity 10, VideoMaster creates:

10 individual InventoryCopy records.

Do NOT merely store:

`quantity = 10`

Each individual copy must be capable of having its own:

- Status
- Format
- Barcode
- Condition
- Rental history
- Notes
- Replacement cost

Example statuses:

- AVAILABLE
- RENTED
- OVERDUE
- LOST
- DAMAGED
- REPAIR
- RETIRED

---

# Movie Metadata

Use TMDB or an equivalent movie metadata API.

External metadata is used to help populate movie information.

Store necessary movie metadata locally once a movie is added to a store.

The store-management application should remain usable when the external movie API is temporarily unavailable.

Never expose external API secrets in client-side code.

Use environment variables and server-side API calls.

---

# Rentals

A rental must connect:

Customer  
→ Rental  
→ Physical Inventory Copy

Checkout must update the selected copy from:

AVAILABLE

to:

RENTED

Returning it normally sets it back to:

AVAILABLE

unless it is marked:

- DAMAGED
- LOST
- REPAIR
- RETIRED

Due dates and late fees must come from configurable store policies.

---

# Concessions

Concession items are retail products, not rental inventory.

Examples:

- Candy
- Popcorn
- Soda
- Snacks

Completing a concession sale reduces its quantity on hand.

It does not create a rental record.

A transaction may contain both:

- Rental items
- Retail merchandise

---

# Payment Processing

Version 1.0 uses simulated payment methods only.

Examples:

- CASH
- CREDIT CARD
- DEBIT
- CHECK
- STORE CREDIT
- OTHER

Do NOT integrate real payment processing unless explicitly requested later.

---

# Preferred Technical Direction

Unless an existing project structure requires otherwise, prefer:

- Next.js
- TypeScript
- React
- PostgreSQL
- Prisma or equivalent ORM
- Secure modern authentication
- TMDB integration
- Server-side authorization

Avoid unnecessary microservices.

Prefer a maintainable monolithic application.

---

# Code Quality

Use:

- Strict TypeScript where practical
- Clear component boundaries
- Reusable domain logic
- Server-side validation
- Sensible naming
- Small focused functions
- Database constraints where appropriate
- Transactions for operations that modify several related records

Do not create abstraction layers without a concrete need.

Do not overengineer the MVP.

---

# Validation

Validate all user-controlled data.

Important examples:

- Prices cannot be negative
- Quantities cannot be negative
- Tax rates must be valid
- Rental durations must be sensible
- Inventory copies must belong to the current store
- Customers must belong to the current store
- Rental copies must currently be available
- Merchandise quantities must not silently become negative

Display useful retro-styled validation messages to the user.

---

# Database Changes

When changing the database:

1. Update the schema.
2. Create/apply the appropriate migration.
3. Update seed/demo data where necessary.
4. Update affected server logic.
5. Run type checking.
6. Test the affected workflow.

Do not make destructive schema changes casually.

---

# Testing Expectations

Before considering a milestone complete:

- Run the project.
- Run linting if configured.
- Run TypeScript checks.
- Run relevant tests.
- Fix build errors.
- Fix obvious runtime errors.
- Verify the primary workflow manually or with automated testing where practical.

Do not knowingly leave the application in a broken build state.

---

# Git Workflow

Use Git throughout development.

Create a commit after each meaningful completed milestone.

Use descriptive commit messages.

Examples:

`feat: add first-run store setup`

`feat: add customer management`

`feat: integrate TMDB movie search`

`feat: add individual rental inventory copies`

`feat: implement rental checkout`

`fix: prevent rental of unavailable copies`

Before major risky changes, ensure the current working version is committed.

Do not rewrite Git history unless explicitly requested.

---

# Progress Tracking

Maintain:

`PROGRESS.md`

Update it after each meaningful milestone.

It should include:

## Completed

Features that are working.

## Current Work

What is actively being implemented.

## Known Issues

Known bugs or unfinished behavior.

## Next

The next logical milestone.

## Decisions

Important architecture or product decisions that future sessions should preserve.

Keep this file concise and current.

---

# Product Scope Discipline

Do not attempt to build the entire product in one enormous pass.

Work in milestones.

Complete and verify each milestone before expanding into the next major feature.

The recommended order is:

1. Project foundation
2. Authentication
3. Store setup
4. Main menu
5. Customers
6. Movie metadata search
7. Movie inventory
8. Individual physical copies
9. Rental checkout
10. Returns
11. Late fees
12. Concessions
13. Combined POS transactions
14. Transaction history
15. Receipts
16. Overdue management
17. Reports
18. Polish and accessibility

---

# Preserve Existing Working Features

When implementing later features:

- Do not unnecessarily redesign completed screens.
- Do not replace working architecture without a concrete reason.
- Do not silently remove functionality.
- Do not significantly alter the retro UI direction.

Prefer incremental modification over unnecessary rewrites.

---

# Product Decision Rule

When uncertain between:

A more authentic 1990s appearance

and

A more usable interaction

preserve the retro appearance while choosing the more usable interaction.

Again:

**1996 appearance. 2026 usability.**
