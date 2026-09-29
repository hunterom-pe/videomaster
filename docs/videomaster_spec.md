# VIDEOMASTER
## Video Rental Management System
### Version 1.0

Build a complete, functional, multi-user web application called **VIDEOMASTER**, subtitled:

**Video Rental Management System**  
**Version 1.0**

VideoMaster should simulate a fully functioning independent video rental store management and point-of-sale system from approximately **1994–1999**, while using a modern web backend and modern usability conventions.

The application should feel like genuine vintage video-store software running on a beige PC behind the counter in the 1990s.

However, it must NOT reproduce the frustrating limitations of old software.

The guiding design principle is:

**1996 appearance. 2026 usability.**

The interface should be completely usable with a mouse or touchscreen. Keyboard shortcuts may exist as optional conveniences, but users must never be forced to navigate using function keys, arrow keys, tab, or keyboard commands.

---

# 1. PRODUCT CONCEPT

VideoMaster is a fictional video rental store management system.

Each registered user can create and operate their own independent fictional video store.

Users should be able to:

- Create a store
- Configure store information
- Configure rental prices and policies
- Add movies to inventory
- Search an external movie database to quickly populate movie information
- Add multiple physical copies of a movie
- Register customers
- Rent movies to customers
- Return movies
- Calculate late fees
- Sell candy, popcorn, drinks, and other merchandise
- Track concession inventory
- Track individual movie copies
- Track damaged, lost, rented, and available copies
- View transaction history
- View rental history
- View customer history
- View store reports
- View overdue rentals
- Search inventory
- Manage pricing
- Manage store settings
- Simulate day-to-day operation of a 1990s video store

The system should behave like legitimate retail/rental management software rather than a game.

Any simulation or nostalgic touches should support the illusion of operating a real video store.

---

# 2. MULTI-USER / MULTI-STORE ARCHITECTURE

VideoMaster is a hosted web application.

Users should be able to create an account and log in securely.

Each user should have their own isolated store data.

Example:

User A:
- Store: Video World
- Customers
- Inventory
- Rentals
- Prices
- Transactions
- Concessions

User B:
- Store: Galaxy Video
- Completely separate customers, inventory, settings, rentals, and transaction history

No user should ever be able to access another user's private store-management data.

Design the architecture so multiple employees per store could eventually be supported, even if Version 1.0 initially uses one primary owner account.

Use proper database relationships and store IDs rather than hardcoding a single store.

---

# 3. FIRST-RUN STORE SETUP

When a user logs in for the first time and has not created a store yet, do NOT send them directly to an empty dashboard.

Display a retro setup screen:

**VIDEOMASTER STORE CONFIGURATION**

Guide the user through a clickable setup process.

Collect:

## Store Information

- Store name
- Store number
- Address
- City
- State / region
- Postal code
- Phone number
- Manager / owner name
- Optional store slogan
- Currency
- Sales tax percentage

Allow fake or fictional information.

## Store Era

Allow the user to set an optional:

**Store Year**

Example:

1995

This can influence the nostalgic appearance and may eventually be used to filter movie search results.

Do not make Store Year mandatory.

## Formats Carried

Allow toggles for:

- VHS
- DVD
- Blu-ray
- LaserDisc
- Video Games
- Other

VHS should be enabled by default because the default VideoMaster aesthetic is mid-1990s.

## Rental Categories

Allow the store to configure categories such as:

- New Release
- Catalog
- Kids
- Classics
- TV
- Foreign
- Games
- Other

Each rental category should support:

- Rental price
- Rental duration
- Late fee per day
- Maximum late fee, optional
- Replacement charge behavior
- Taxable or non-taxable

Example defaults:

NEW RELEASE
$3.99
2 DAYS

CATALOG
$1.99
5 DAYS

KIDS
$0.99
5 DAYS

LATE FEE
$1.00 / DAY

These must remain editable.

## Optional Fees

Allow configuration of:

- Rewind fee
- Membership fee
- Replacement fee
- Damage fee
- Lost-item fee

Do not force these features.

---

# 4. VISUAL DESIGN

This requirement is extremely important.

Do NOT design VideoMaster like a modern SaaS dashboard.

Avoid:

- White modern dashboards
- Rounded cards everywhere
- Large colorful gradients
- Glassmorphism
- Material Design
- Floating action buttons
- Oversized hero sections
- Modern startup UI
- Excessive icons
- Soft pastel colors
- Excessive animations

VideoMaster should visually resemble legitimate DOS / early Windows retail management software.

## Default Color Palette

Primary screen background:

- Deep royal blue / DOS blue

Primary text:

- White
- Light gray

Secondary / informational text:

- Cyan

Warnings:

- Yellow

Errors / overdue / blocked accounts:

- Bright red

Selections:

- Cyan or light gray highlight bar

Borders:

- ASCII-style or thin rectangular borders

## Typography

Use a highly readable monospace font.

The interface should evoke:

- VGA terminals
- DOS applications
- Early Windows point-of-sale systems
- Rental store databases

Do not use fonts that are difficult to read merely for nostalgia.

## UI Components

Buttons should look like retro controls.

Examples:

[ RENT VIDEO ]

[ RETURN VIDEO ]

[ CUSTOMER SEARCH ]

[ ADD TITLE ]

[ SAVE ]

[ CANCEL ]

Buttons can contain labels like:

[F1] RENT VIDEO

But the entire button must be clickable.

The F-key notation is decorative and optionally maps to keyboard shortcuts.

Mouse interaction is always primary.

## Clickability

Everything that logically looks interactive must actually be clickable.

Examples:

- Menu choices
- Movie rows
- Customer names
- Buttons
- Inventory copies
- Transaction rows
- Reports
- Categories
- Settings
- Search results

Do not require users to memorize keyboard commands.

---

# 5. MAIN MENU

After login and store setup, display a main terminal-style screen.

Example:

VIDEOMASTER
VIDEO RENTAL MANAGEMENT SYSTEM
VERSION 1.0

STORE: VIDEO WORLD #0147

------------------------------------------------

[ RENT VIDEO ]

[ RETURN VIDEO ]

[ CUSTOMERS ]

[ MOVIE INVENTORY ]

[ CONCESSIONS ]

[ OVERDUE RENTALS ]

[ TRANSACTIONS ]

[ REPORTS ]

[ STORE SETTINGS ]

------------------------------------------------

Optional status information:

AVAILABLE COPIES: 2,412

VIDEOS OUT: 143

OVERDUE: 27

CUSTOMERS: 1,482

TODAY'S RENTALS: 86

TODAY'S SALES: $642.92

Every menu option must be clickable.

---

# 6. MOVIE DATABASE INTEGRATION

Integrate a public movie metadata service such as **TMDB**.

Users should be able to select:

MOVIE INVENTORY

then:

ADD TITLE

A search box appears.

Example:

SEARCH MOVIES:

Terminator 2

Return matching movie results with:

- Title
- Year
- Poster thumbnail, optional
- Director
- Runtime
- Genres
- Rating
- Cast, optional
- Plot summary
- External movie database ID

Example:

1. TERMINATOR 2: JUDGMENT DAY — 1991

2. TERMINATOR 2: 3-D — 1996

Clicking a result should open the Add Inventory screen.

Avoid duplicate metadata downloads by storing the external database ID locally.

Movie metadata should be stored in VideoMaster's own database once added.

The store should continue functioning even if the external metadata service is temporarily unavailable.

---

# 7. ADDING MOVIES TO INVENTORY

After selecting a movie, show:

ADD TITLE TO INVENTORY

TITLE:
TERMINATOR 2: JUDGMENT DAY

YEAR:
1991

FORMAT:
VHS

CATEGORY:
NEW RELEASE

RENTAL PRICE:
$3.99

RENTAL PERIOD:
2 DAYS

QUANTITY TO ADD:
10

[ ADD TO STORE ]

[ CANCEL ]

The user must be able to override automatically populated fields.

---

# 8. INDIVIDUAL PHYSICAL COPIES

This is a critical architectural requirement.

Do NOT store only:

Terminator 2
Quantity = 10

Instead:

Create one Movie/Title record.

Then create 10 individual Inventory Copy records.

Example:

TITLE:

TERMINATOR 2: JUDGMENT DAY

COPIES:

T2-0001
AVAILABLE

T2-0002
AVAILABLE

T2-0003
RENTED

T2-0004
AVAILABLE

T2-0005
DAMAGED

...

Each copy should have:

- Unique copy ID
- Movie/title ID
- Store ID
- Format
- Acquisition date
- Status
- Condition
- Rental category
- Replacement cost
- Optional barcode
- Optional notes

Statuses should include:

AVAILABLE

RENTED

OVERDUE

LOST

DAMAGED

REPAIR

RETIRED

The title page should summarize:

10 TOTAL

7 AVAILABLE

2 RENTED

1 DAMAGED

---

# 9. ADD MORE COPIES

Existing titles should have:

[ ADD COPIES ]

Example:

CURRENT COPIES:
10

ADDITIONAL COPIES:
5

[ ADD ]

This creates five additional individual inventory records.

Do not create a duplicate movie title.

---

# 10. FORMATS

The same movie may exist in multiple formats.

Example:

TERMINATOR 2

VHS
10 TOTAL
7 AVAILABLE

DVD
4 TOTAL
4 AVAILABLE

BLU-RAY
2 TOTAL
1 AVAILABLE

The system should support separate rental pricing and categories by format if the store chooses.

---

# 11. CUSTOMER MANAGEMENT

Customers should have their own membership records.

Fields:

- Customer ID
- Membership number
- First name
- Last name
- Phone
- Email, optional
- Address
- City
- State
- Postal code
- Date joined
- Date of birth, optional
- Account status
- Notes
- Outstanding fees
- Rental history
- Purchase history
- Active rentals

Account statuses:

GOOD

OVERDUE

BLOCKED

SUSPENDED

CLOSED

Allow configurable warnings.

Example:

CUSTOMER HAS 2 OVERDUE RENTALS

OUTSTANDING BALANCE: $8.00

MANAGER OVERRIDE REQUIRED

The user should be able to click the warning and see details.

---

# 12. CUSTOMER SEARCH

Search customers by:

- First name
- Last name
- Phone
- Membership number
- Customer ID

Search should be forgiving and fast.

Results should appear in a simple retro list/table.

Clicking a customer opens their account.

---

# 13. CHECKOUT / RENTAL POS

Create a genuine point-of-sale checkout workflow.

Start with:

RENT VIDEO

Select or search for a customer.

Then display:

CUSTOMER CHECKOUT

CUSTOMER:
SARAH CONNOR

ACCOUNT:
GOOD

------------------------------------------------

ITEM
PRICE
DUE

TERMINATOR 2 — VHS
$3.99
OCT 01

ALIEN — VHS
$1.99
OCT 04

SOUR PATCH KIDS
$1.49

LARGE POPCORN
$2.49

------------------------------------------------

RENTALS
$5.98

MERCHANDISE
$3.98

TAX
$0.84

TOTAL
$10.80

------------------------------------------------

[ ADD RENTAL ]

[ ADD SALE ITEM ]

[ REMOVE ITEM ]

[ TAKE PAYMENT ]

[ CANCEL ]

Everything must work by clicking.

---

# 14. ADDING RENTALS DURING CHECKOUT

Clicking:

ADD RENTAL

should allow:

- Movie title search
- Copy selection
- Barcode/manual inventory number entry

If multiple copies exist, automatically choose an available copy unless the employee explicitly chooses another one.

Once added:

- Attach the copy to the customer
- Create rental transaction record
- Calculate due date
- Set inventory copy status to RENTED

---

# 15. CONCESSIONS / MERCHANDISE

VideoMaster should support retail merchandise.

Default sample categories:

CANDY

POPCORN

DRINKS

SNACKS

VIDEO ACCESSORIES

OTHER

A concession item should have:

- SKU
- Name
- Category
- Retail price
- Cost, optional
- Taxable yes/no
- Quantity on hand
- Low-stock threshold
- Active/inactive
- Barcode, optional

Example inventory:

C001
M&M PEANUT
18 ON HAND
$1.49

C002
TWIZZLERS
11
$1.29

C003
SOUR PATCH KIDS
4
$1.49

P001
MICROWAVE POPCORN
15
$2.49

S001
COKE 20OZ
9
$1.79

Show warnings:

*** C003 LOW STOCK ***

---

# 16. CONCESSION SALES

During checkout:

Click:

ADD SALE ITEM

Display clickable merchandise categories or search.

Selecting an item adds it to the current transaction.

Completing payment:

- Deduct merchandise quantity
- Create sale record
- Apply sales tax as configured

Merchandise does not create a rental record.

---

# 17. RETURNS

Return screen:

RETURN VIDEO

Allow:

- Inventory number
- Barcode
- Movie title
- Customer search

Once a rented copy is selected:

Display:

MOVIE:
THE MATRIX

COPY:
VHS-001842

CUSTOMER:
JOHN SMITH

RENTED:
09/25/1999

DUE:
09/27/1999

RETURNED:
09/30/1999

DAYS LATE:
3

LATE FEE:
$3.00

Then:

[ COMPLETE RETURN ]

[ WAIVE FEE ]

[ DAMAGE ]

[ LOST ]

Completing a normal return should set the copy back to AVAILABLE.

---

# 18. LATE FEES

Late fees should use the store's configurable policies.

Store both:

Calculated late fee

and

Actual charged late fee

This permits waived or adjusted fees while preserving transaction history.

Allow employees/users to:

- Waive fee
- Reduce fee
- Charge full amount

Record any adjustment.

---

# 19. INVENTORY SEARCH

Users must be able to search their store by:

- Movie title
- Year
- Actor
- Director
- Genre
- Format
- Category
- Copy ID
- Availability

Search results should show useful store-specific information.

Example:

THE THING
1982

VHS

6 TOTAL

4 AVAILABLE

2 OUT

Clicking the movie opens its store record.

---

# 20. INVENTORY TITLE PAGE

Each movie should have a title page showing:

Title

Year

Poster

Director

Runtime

Genre

Rating

Description

Formats

Rental category

Rental pricing

Number of copies

Available copies

Rented copies

Overdue copies

Damaged copies

Lost copies

Rental count

Individual copies

Buttons:

[ RENT ]

[ ADD COPIES ]

[ EDIT ]

[ RETIRE COPY ]

[ VIEW RENTAL HISTORY ]

---

# 21. TRANSACTION HISTORY

Maintain permanent transaction history.

Transaction types:

RENTAL

RETURN

RETAIL SALE

LATE FEE

REFUND

FEE WAIVER

DAMAGE FEE

LOST ITEM FEE

Transaction records should include:

- Transaction number
- Store
- Customer
- Date/time
- Employee/user
- Items
- Subtotal
- Tax
- Fees
- Total
- Payment method
- Notes

---

# 22. PAYMENT METHODS

Version 1.0 does NOT need real payment processing.

This is a simulated store-management system.

Payment options can include:

CASH

CREDIT CARD

DEBIT

CHECK

STORE CREDIT

OTHER

Track payment method for reporting purposes.

Do not connect Stripe or real-world payment services unless added later.

---

# 23. REPORTS

Create retro-style printable/viewable reports.

Required reports:

## Daily Activity

- Rentals
- Returns
- Merchandise sales
- Late fees
- Total revenue
- Number of transactions

## Overdue Rentals

Customer

Movie

Copy

Date rented

Due date

Days overdue

Current late fee

## Inventory

Total titles

Total copies

Available

Rented

Overdue

Damaged

Lost

## Popular Rentals

Rank titles by number of completed rentals.

## Customer Activity

Top customers by rental count.

## Merchandise Inventory

Current quantity

Low stock

Out of stock

## Revenue

Rental revenue

Merchandise revenue

Fees

Taxes

Total

Allow date filters.

---

# 24. OVERDUE SCREEN

Create a dedicated:

OVERDUE RENTALS

screen.

Display:

CUSTOMER

PHONE

TITLE

COPY

DUE DATE

DAYS LATE

BALANCE

Rows should be clickable.

Clicking an overdue rental opens the customer's account or rental record.

Use red/yellow retro warning colors.

---

# 25. STORE SETTINGS

Settings should include:

STORE INFORMATION

RENTAL PRICING

RENTAL CATEGORIES

LATE FEES

TAX SETTINGS

FORMATS

CONCESSION CATEGORIES

STORE YEAR

INVENTORY SETTINGS

MEMBERSHIP RULES

SYSTEM SETTINGS

Allow all configuration to remain editable after initial setup.

---

# 26. RECEIPTS

Generate an on-screen retro receipt after checkout.

Example:

VIDEO WORLD #0147
123 MAIN STREET
PHOENIX, AZ

09/29/1996
TRANSACTION #004182

--------------------------------

TERMINATOR 2 VHS
RENTAL
$3.99

ALIEN VHS
RENTAL
$1.99

SOUR PATCH KIDS
$1.49

--------------------------------

SUBTOTAL
$7.47

TAX
$0.64

TOTAL
$8.11

CASH
$10.00

CHANGE
$1.89

--------------------------------

TERMINATOR 2 DUE:
10/01/1996

ALIEN DUE:
10/04/1996

PLEASE REWIND

THANK YOU!

Allow:

[ PRINT ]

[ CLOSE ]

Use normal browser printing for Version 1.0.

---

# 27. BARCODE SUPPORT

Design barcode fields so future physical barcode scanner support is easy.

Most barcode scanners behave like keyboards, so barcode fields should support rapid text entry followed by Enter.

However, barcode scanning must be optional.

Every barcode-driven task must also be achievable by clicking/searching.

---

# 28. OPTIONAL KEYBOARD SHORTCUTS

Keyboard shortcuts are allowed.

Examples:

F1 Rent

F2 Return

F3 Customers

F4 Inventory

F5 Concessions

F6 Reports

But keyboard navigation is NEVER required.

Do not intercept browser shortcuts irresponsibly.

Buttons remain fully clickable.

---

# 29. STORE YEAR MODE

If a user chooses a Store Year, allow an optional setting:

ONLY SHOW MOVIES RELEASED ON OR BEFORE STORE YEAR

Example:

Store Year:
1996

Movie search can optionally exclude movies released after December 31, 1996.

Allow this filtering to be turned off.

Do not prevent users from manually adding later movies.

---

# 30. SAMPLE / DEMO DATA

Allow the user to optionally initialize a store with demo data.

Example:

LOAD SAMPLE STORE DATA?

YES

NO

Demo data may include:

- Fictional customers
- Sample concessions
- Sample rental history
- Sample inventory

Do not require sample data.

Avoid copyrighted logos or real-world customer information.

---

# 31. DATABASE MODEL

Design a normalized relational database.

At minimum, use entities similar to:

Users

Stores

StoreSettings

RentalCategories

MovieTitles

InventoryCopies

Customers

Rentals

RentalItems

Transactions

TransactionItems

ConcessionItems

Payments

Fees

StoreFormats

Reports may be calculated dynamically.

Every store-owned record must include or resolve safely to the correct store ID.

Use proper foreign keys and relationships.

---

# 32. AUTHENTICATION

Implement:

Sign up

Login

Logout

Password reset

Protected store routes

Secure session management

Never expose credentials.

Never place secrets or movie database API credentials directly in frontend source code.

Use environment variables.

---

# 33. RESPONSIVE BEHAVIOR

Desktop is the primary target because VideoMaster should resemble store-counter software.

However, the application should remain functional on tablets and phones.

On small screens:

- Stack tables where necessary
- Allow horizontal scrolling for dense terminal tables
- Preserve click/touch controls
- Maintain readable typography

Do not redesign mobile mode into a completely unrelated modern UI.

Keep the VideoMaster identity consistent.

---

# 34. RETRO AUTHENTICITY DETAILS

Use subtle details to strengthen the atmosphere.

Examples:

SYSTEM READY

DATABASE ONLINE

STORE #0147

COPY AVAILABLE

CUSTOMER ACCOUNT GOOD

*** ACCOUNT OVERDUE ***

PROCESSING RETURN...

TRANSACTION COMPLETE

LOW INVENTORY

MANAGER OVERRIDE

Avoid excessive fake loading delays.

The application should feel retro without deliberately wasting the user's time.

---

# 35. DIALOGS

Confirmation dialogs should resemble old software.

Example:

--------------------------------
CONFIRM RENTAL
--------------------------------

CUSTOMER:
SARAH CONNOR

ITEMS:
3

TOTAL:
$8.42

COMPLETE TRANSACTION?

[ YES ]

[ NO ]

Avoid modern rounded modal styling.

---

# 36. ERROR HANDLING

Use useful retro-styled messages.

Example:

*** NO AVAILABLE COPIES ***

All copies of this title are currently rented.

[ OK ]

Or:

*** CUSTOMER ACCOUNT BLOCKED ***

Outstanding balance:
$12.00

[ VIEW ACCOUNT ]

[ CANCEL ]

Errors should explain how to resolve the issue.

---

# 37. PERFORMANCE

The application should remain responsive with stores containing:

- Thousands of movie titles
- Tens of thousands of copies
- Thousands of customers
- Large rental histories

Use pagination or efficient queries as needed.

Do not render enormous lists all at once.

---

# 38. ACCESSIBILITY

Despite the retro visual appearance:

- Maintain strong contrast
- Use proper HTML buttons
- Use form labels
- Support keyboard focus
- Use accessible tables
- Make click targets large enough
- Do not rely on color alone for important states

The nostalgic design should not make the application difficult to use.

---

# 39. SECURITY

Follow normal modern web-security practices.

Include:

- Authentication protection
- Authorization checks
- Multi-tenant store isolation
- Input validation
- API validation
- Parameterized database queries / ORM safety
- Rate limiting where appropriate
- Protected secrets
- Secure password storage

Never trust a store ID supplied directly by the browser without verifying ownership.

---

# 40. TECHNICAL APPROACH

Use a modern, maintainable web stack.

A suitable architecture would be:

Frontend:
- React
- Next.js or equivalent

Backend:
- Next.js server actions/API routes or another clean backend framework

Database:
- PostgreSQL

ORM:
- Prisma or equivalent

Authentication:
- Secure modern authentication library/service

Movie metadata:
- TMDB API or equivalent

Hosting:
- Architecture should be deployable to common cloud hosting.

Do not overengineer with microservices.

A single well-structured application is sufficient.

---

# 41. IMPORTANT DESIGN RULE

Do NOT interpret "retro" as:

pixel-art video game

arcade machine

synthwave

cyberpunk

neon 1980s

The target aesthetic is:

**boring, practical, serious 1990s retail database software.**

Think:

- Video rental counter
- Beige computer
- CRT monitor
- DOS database
- Early Windows POS software
- Monospaced text
- Blue screens
- Rectangular menus
- Functional information density

The fact that the software takes itself completely seriously is part of the charm.

---

# 42. DO NOT USE COPYRIGHTED VIDEO STORE BRANDING

VideoMaster should evoke independent 1990s video rental stores but should not reproduce:

- Blockbuster logos
- Blockbuster branding
- Blockbuster trademarks
- Exact proprietary UI
- Other copyrighted store logos

Create an original VideoMaster identity.

---

# 43. DEFAULT HOME SCREEN MOCKUP

Use this general visual direction:

╔════════════════════════════════════════════════════════════════╗
║                         VIDEOMASTER                            ║
║              VIDEO RENTAL MANAGEMENT SYSTEM                   ║
║                         VERSION 1.0                            ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║ STORE: VIDEO WORLD #0147                                      ║
║                                                                ║
║ [ RENT VIDEO ]          [ RETURN VIDEO ]                      ║
║                                                                ║
║ [ CUSTOMERS ]           [ MOVIE INVENTORY ]                   ║
║                                                                ║
║ [ CONCESSIONS ]         [ OVERDUE RENTALS ]                   ║
║                                                                ║
║ [ TRANSACTIONS ]        [ REPORTS ]                           ║
║                                                                ║
║ [ STORE SETTINGS ]                                             ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║ VIDEOS OUT: 143     OVERDUE: 27     CUSTOMERS: 1,482          ║
║                                                                ║
║ SYSTEM READY                                                   ║
╚════════════════════════════════════════════════════════════════╝

The actual UI may use CSS borders rather than literal ASCII characters, but it should visually resemble this structure.

---

# 44. VERSION 1.0 PRIORITIES

Prioritize building a complete functioning MVP in this order:

1. Authentication
2. Store creation/setup
3. Store settings
4. Customer management
5. External movie search
6. Movie/title database
7. Individual inventory copies
8. Rental checkout
9. Returns
10. Late fees
11. Concession inventory
12. Merchandise sales
13. Transaction history
14. Overdue rental screen
15. Reports
16. Receipt printing
17. Demo/sample data
18. Optional keyboard shortcuts

Do not spend excessive development effort on animations or decorative effects before the core store-management workflows work correctly.

---

# 45. ACCEPTANCE TEST

A new user should be able to perform this exact scenario:

1. Create a VideoMaster account.

2. Log in.

3. Create a store named:

VIDEO WORLD

4. Set:

Store #0147

Tax rate

Rental prices

New Release = $3.99 / 2 days

Catalog = $1.99 / 5 days

5. Add concession products:

Sour Patch Kids

$1.49

Quantity 10

Large Popcorn

$2.49

Quantity 20

6. Search the movie database for:

TERMINATOR 2: JUDGMENT DAY

7. Select the 1991 movie.

8. Add:

10 VHS copies

Category:

NEW RELEASE

9. VideoMaster creates 10 individual inventory-copy records.

10. Create customer:

SARAH CONNOR

11. Start a rental transaction.

12. Select Sarah Connor.

13. Add one available Terminator 2 copy.

14. Add one Sour Patch Kids.

15. Display:

Rental price

Candy price

Tax

Total

Due date

16. Complete the transaction using CASH.

17. Terminator 2 should now show:

10 TOTAL

9 AVAILABLE

1 RENTED

18. Sour Patch Kids should now show:

9 ON HAND

19. Sarah Connor should show Terminator 2 under active rentals.

20. Advance logically to the return workflow.

21. Return the copy.

22. If late, calculate the appropriate late fee.

23. Complete the return.

24. Inventory should return to:

10 TOTAL

10 AVAILABLE

unless the copy is marked damaged/lost.

25. Transaction history and reports should accurately reflect everything that occurred.

If this scenario works from beginning to end, the foundational VideoMaster application is functioning correctly.

---

# 46. FINAL PRODUCT VISION

VideoMaster should feel like software discovered on an old video-store computer from 1996, except that:

- It runs in a modern browser
- It works with a mouse
- It has modern search
- It can access modern movie metadata
- Multiple users can have their own stores
- It is actually pleasant to use

The nostalgia should come from the visual design and store-management experience, not from deliberately poor usability.

The final result should make the user feel like they are sitting behind the counter of their own independent 1990s video rental store.

Build the application around that experience.
