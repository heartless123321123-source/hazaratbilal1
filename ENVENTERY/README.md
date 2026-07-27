# Air Touch Enterprise ERP

Internet/ISP inventory + installation management system. Requires Python 3
(standard library only, no pip installs needed for the backend).

## Project structure

```
airtouch_erp/
├── database/
│   ├── init_db.py       -> creates airtouch_erp.db with all 15 tables
│   ├── seed_data.py     -> fills it with sample cities, items, customers, opening stock
│   └── airtouch_erp.db  -> created after you run init_db.py (not included)
├── backend/
│   ├── inventory_transactions.py  -> the ledger engine (see below)
│   ├── purchase_transactions.py   -> multi-item purchase invoice engine (see below)
│   └── dispatch_transactions.py   -> multi-item dispatch (stock-out) engine (see below)
└── frontend/
    ├── dashboard.html         -> main ERP dashboard (open directly in a browser)
    ├── store_inventory.html   -> Store Stock page (Inventory > Store Stock), linked from the dashboard's sidebar
    ├── purchase.html          -> Purchase page (Inventory > Purchase), linked from Store Stock's sidebar
    ├── dispatch.html          -> Dispatch page (Inventory > Dispatch), linked from the same sidebar
    └── ledger.html            -> Ledger page (Inventory > Ledger), linked from the same sidebar
```

## Getting started

```bash
cd database
python3 init_db.py      # creates the database and all 15 tables
python3 seed_data.py     # adds sample cities/items/customers + opening stock
```

Then open `frontend/dashboard.html` directly in your browser. Clicking
"Inventory" in the sidebar takes you to `store_inventory.html`, the detailed
Store Stock page. Both pages currently run on their own in-memory sample
data (no backend server yet) so you can see and click through the UI
immediately — search, add/edit/delete items, dark mode, exports, etc. all
work standalone.

## The database (17 tables)

`cities → categories → suppliers → employees → users → items → customers
→ item_serials → purchase_headers/purchase_details → dispatches
→ item_returns → stock_adjustments → inventory_transactions → audit_logs
→ installations/installation_details`

Everything that moves stock (a purchase, a dispatch, an installation, a
return, a manual adjustment) is meant to go **through the ledger**
(`inventory_transactions`), not by editing `items.available_stock` directly.
The cache column on `items` is kept in sync by the ledger functions and can
always be recalculated from the ledger if it ever drifts.

## Backend: `inventory_transactions.py`

Two functions:

- **`execute_inventory_transaction(item_id, trans_type, qty, reference_id, user_id)`**
  Records one ledger entry, updates the `items.available_stock` cache, and
  writes an audit log row — all in a single transaction. `trans_type` is one
  of `PURCHASE`, `RETURN`, `DISPATCH`, `INSTALLATION`, `ADJUSTMENT`.
  Raises `InventoryTransactionError` (instead of failing silently) if:
  - the item doesn't exist
  - the transaction type is unrecognized
  - the movement would push stock below zero

- **`verify_and_reconcile_item_stock(item_id)`**
  Recomputes `available_stock` from the full ledger history and re-syncs the
  cache — useful for a periodic integrity check or an admin "recalculate
  stock" button.

Both open a fresh connection with `PRAGMA foreign_keys = ON` every time —
SQLite requires this per-connection, so don't drop it if you add new
functions that talk to the database.

## Backend: `purchase_transactions.py`

Wires up `purchase_headers` / `purchase_details` (multi-item invoices), which
previously had no helper functions. Three functions:

- **`create_purchase_invoice(supplier_id, invoice_num, purchase_date, lines, user_id)`**
  Records one full invoice — header row, one `purchase_details` row per line,
  one `PURCHASE` ledger entry per line, the `items.available_stock` bump, and
  the audit log — all on a single connection/transaction, so a bad line item
  (unknown item_id, qty ≤ 0, negative cost) rolls back the *whole* invoice
  instead of leaving a header with missing details. Duplicate `invoice_num`
  and unknown `supplier_id` are rejected up front. `lines` is a list of
  `{'item_id', 'qty', 'unit_cost'}` dicts. Raises `PurchaseError`.
- **`list_purchase_invoices(limit=200)`** — recent invoices with supplier
  name, line count, and total qty, newest first (for the Purchase page table).
- **`get_purchase_invoice(purchase_id)`** — one invoice's header + its full
  line items (for a "view invoice" screen).

## Frontend: `purchase.html`

The Purchase page (Inventory ▸ Purchase in the sidebar, linked from Store
Stock). Multi-item invoice entry — pick a supplier, add as many item lines
as needed, grand total computes live — plus an invoices table, a
view-invoice modal, Excel export, and delete-with-stock-reversal. Like
`store_inventory.html`, it currently runs on its own in-memory mock data
shaped exactly like `purchase_headers`/`purchase_details`/`items`, so
swapping the mock arrays for `fetch()` calls into `purchase_transactions.py`
(once there's a web server) is a drop-in change.

## Backend: `dispatch_transactions.py`

Wires up the `dispatches` table (sending stock out to a city/field
employee). Unlike purchases, this table has no header/detail split — each
item movement is its own row — so a "trip" with several items becomes
several `dispatches` rows sharing the same city/employee/date/remarks.
Four functions:

- **`create_dispatch(city_code, employee_id, lines, remarks, user_id, dispatch_date=None)`**
  Writes one `dispatches` row + one `DISPATCH` ledger entry + one
  `available_stock` decrement + one audit log row **per line item**, all on
  a single connection, so a bad line rolls back the whole trip. Validates
  the city and employee exist, every line has a real item_id and qty > 0,
  and — importantly — checks *combined* quantity per item across all lines
  against live stock before writing anything, so dispatching the same item
  twice in one trip can't slip past a negative-stock check done line by
  line. Raises `DispatchError`.
- **`list_dispatches(limit=200)`** — recent dispatch rows with city, employee,
  and item names joined in, newest first.
- **`reverse_dispatch(dispatch_id, user_id)`** — puts one row's qty back via
  a `RETURN` ledger entry (the original dispatch row stays as history,
  same as voiding rather than deleting an invoice).

## Frontend: `dispatch.html`

The Dispatch page (Inventory ▸ Dispatch, linked from Store Stock and
Purchase). Pick a city + field employee, add one or more item lines, save —
each line becomes its own row (grouped visually under one Ref #, e.g.
`DSP-1004`, the same way `create_dispatch()` groups them server-side). Also
has a dispatch table, a view-trip modal, Excel export, and a per-line
reverse action that returns stock. Same in-memory mock-data pattern as the
other two pages, shaped to match `dispatches`/`cities`/`employees`/`items`
so it's a drop-in swap to `fetch()` calls once there's a web server.

## Frontend: `ledger.html`

The Ledger page (Inventory ▸ Ledger, linked from Store Stock, Purchase, and
Dispatch). Read-only view straight over `inventory_transactions` — every row
is one signed ledger entry (item, `transaction_type`, qty delta, reference,
recorded-by, date). Search plus type/item filters, a running per-item
"Balance After" column recomputed by walking the ledger chronologically
(the same logic `verify_and_reconcile_item_stock()` uses on the backend), a
side panel showing each item's current recalculated balance, a view-entry
modal, Excel export, and print. Same in-memory mock-data pattern as the
other pages — shaped to match `inventory_transactions`/`items`/`users`, so
it's a drop-in swap to a `fetch()` call (e.g. `GET /ledger`) once there's a
web server.

## Backend: `installation_transactions.py`

Wires up two new tables, `installations` / `installation_details`, for
customer-facing connection installs — as opposed to `dispatches`, which just
moves stock from the store to a field employee. A connection fee (e.g. Rs
5000) covers a free material allowance (say 1 modem, 50m wire, 2 patch
cords); anything used beyond that allowance on-site is billed to the
customer as an extra charge. Four functions:

- **`create_installation(customer_id, employee_id, install_date,
  installation_fee, lines, user_id, remarks=None)`** — records one install:
  header row, one `installation_details` row per material line (splitting
  `qty` into `free_qty` + auto-computed `extra_qty`/`extra_charge`), one
  `INSTALLATION` ledger entry per line, the `items.available_stock`
  decrement, and the audit log — all on one connection, so a bad line
  rolls back the whole install. Combined qty per item is checked against
  live stock before writing anything (same guard as `create_dispatch`).
  `lines` is a list of `{'item_id', 'qty', 'free_qty', 'unit_price'}` dicts.
  Raises `InstallationError`.
- **`list_installations(limit=200)`** — recent installs with customer/
  employee names, fee, extra charge, and grand total (for the Installation
  List page).
- **`get_installation(installation_id)`** — one install's header + full
  line items (for a "view installation" screen).
- **`return_installation_material(installation_id, item_id, qty, reason,
  user_id)`** — the "Returned Material" flow (e.g. a disconnect, a faulty
  swap, unused leftover cable): writes an `item_returns` row tagged to the
  installation, a `RETURN` ledger entry, and bumps `items.available_stock`
  back up. Rejects returning more than was actually used (minus whatever
  was already returned) on that installation.
- **`list_installation_returns(limit=200)`** — recent returned-material rows
  (for the Returned Material page table).

## Frontend: `installation.html`

The Installation page (Installation ▸ New Installation / Installation List
/ Returned Material in the sidebar, linked from every other Inventory page
and from the dashboard). One page, three tabs:

- **New Installation** — pick a customer + installer, set the one-time
  connection fee, add material lines (qty used / free qty / unit price),
  with extra qty and extra charge computed live per line and a running
  Fee + Extra + Grand Total summary.
- **Installation List** — every install with fee/extra/grand-total columns,
  search, a view-installation modal, and Excel export.
- **Returned Material** — pick an installation, pick one of its used items,
  return some or all of it back to stock with a reason; a history table
  below shows everything returned so far.

Same in-memory mock-data pattern as the other pages, shaped to match
`installations`/`installation_details`/`item_returns`, so it's a drop-in
swap to `fetch()` calls once there's a web server.

## What's next (not built yet)

- No web server / API layer yet — the dashboard, Purchase, Dispatch,
  Ledger, and Installation pages are standalone with mock data. To make it
  live, you'll want a small Flask/FastAPI layer exposing endpoints like
  `GET /items`, `POST /purchases`, `POST /dispatches`, `GET /ledger`,
  `POST /installations` that call into `inventory_transactions.py` /
  `purchase_transactions.py` / `dispatch_transactions.py` /
  `installation_transactions.py`, and swap the mock arrays for `fetch()` calls.
- No authentication/login flow — `users.password_hash` exists in the schema
  but nothing hashes or checks passwords yet.
- `item_serials` (per-device serial tracking) is in the schema but has no
  helper functions yet — it would pair well with `installation_details` for
  tracking exactly which serial-numbered modem went to which customer.
