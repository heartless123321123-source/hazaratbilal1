import sqlite3
import os

# Always resolve to database/airtouch_erp.db regardless of the current
# working directory the script is launched from.
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'database', 'airtouch_erp.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # SQLite enforces foreign keys per-connection, not per-database.
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


class PurchaseError(Exception):
    """Raised when a purchase invoice cannot be safely recorded."""
    pass


# CREATE A MULTI-ITEM PURCHASE INVOICE (header + details + ledger, atomically)
def create_purchase_invoice(supplier_id, invoice_num, purchase_date, lines, user_id):
    """
    Records one full purchase invoice in a single database transaction:
      1. one row in purchase_headers
      2. one row in purchase_details per line item
      3. one PURCHASE entry in inventory_transactions per line item
      4. items.available_stock bumped for every line item
      5. one audit_logs row per line item

    Everything happens on the SAME connection so it either all commits
    together or all rolls back together -- a bad line item can never leave
    a half-written invoice (header with no details, or stock updated
    without a matching ledger row).

    lines: list of dicts -> [{'item_id': int, 'qty': int, 'unit_cost': float}, ...]

    Raises PurchaseError if:
      - lines is empty
      - the invoice_num has already been used
      - supplier_id doesn't exist
      - any item_id doesn't exist
      - any qty <= 0 or unit_cost < 0

    Returns the new purchase_id on success.
    """
    if not lines:
        raise PurchaseError("A purchase invoice needs at least one item line.")

    conn = get_db()
    try:
        cursor = conn.cursor()

        supplier = cursor.execute(
            "SELECT supplier_id FROM suppliers WHERE supplier_id = ?", (supplier_id,)
        ).fetchone()
        if supplier is None:
            raise PurchaseError(f"Supplier ID {supplier_id} does not exist.")

        dupe = cursor.execute(
            "SELECT purchase_id FROM purchase_headers WHERE invoice_num = ?", (invoice_num,)
        ).fetchone()
        if dupe is not None:
            raise PurchaseError(f"Invoice number '{invoice_num}' has already been recorded.")

        # Validate every line before writing anything.
        clean_lines = []
        grand_total = 0.0
        for line in lines:
            item_id = line.get('item_id')
            qty = line.get('qty')
            unit_cost = line.get('unit_cost')

            if qty is None or qty <= 0:
                raise PurchaseError(f"Item ID {item_id}: qty must be greater than zero.")
            if unit_cost is None or unit_cost < 0:
                raise PurchaseError(f"Item ID {item_id}: unit cost cannot be negative.")

            item = cursor.execute(
                "SELECT item_id FROM items WHERE item_id = ?", (item_id,)
            ).fetchone()
            if item is None:
                raise PurchaseError(f"Item ID {item_id} does not exist.")

            total_cost = round(qty * unit_cost, 2)
            grand_total += total_cost
            clean_lines.append((item_id, qty, unit_cost, total_cost))

        # 1. Header
        cursor.execute('''
            INSERT INTO purchase_headers (invoice_num, supplier_id, purchase_date, grand_total, created_by)
            VALUES (?, ?, ?, ?, ?)
        ''', (invoice_num, supplier_id, purchase_date, round(grand_total, 2), user_id))
        purchase_id = cursor.lastrowid

        # 2. Details + ledger + stock cache + audit log, one line at a time
        for item_id, qty, unit_cost, total_cost in clean_lines:
            cursor.execute('''
                INSERT INTO purchase_details (purchase_id, item_id, qty, unit_cost, total_cost)
                VALUES (?, ?, ?, ?, ?)
            ''', (purchase_id, item_id, qty, unit_cost, total_cost))

            cursor.execute('''
                INSERT INTO inventory_transactions (item_id, transaction_type, qty, reference_id, created_by)
                VALUES (?, 'PURCHASE', ?, ?, ?)
            ''', (item_id, qty, invoice_num, user_id))

            cursor.execute('''
                UPDATE items SET available_stock = available_stock + ? WHERE item_id = ?
            ''', (qty, item_id))

            cursor.execute('''
                INSERT INTO audit_logs (user_id, action_type, details)
                VALUES (?, ?, ?)
            ''', (user_id, "INVENTORY_PURCHASE",
                  f"Item ID: {item_id}, Delta: {qty}, Ref: {invoice_num}"))

        conn.commit()
        print(f"✅ Purchase invoice '{invoice_num}' recorded — {len(clean_lines)} line(s), "
              f"grand total {grand_total:.2f}")
        return purchase_id

    except PurchaseError:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise PurchaseError(f"Purchase invoice failed (unexpected error): {e}") from e
    finally:
        conn.close()


# LIST INVOICES FOR THE PURCHASE PAGE TABLE
def list_purchase_invoices(limit=200):
    """Returns recent purchase invoices with supplier name + line totals, newest first."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        rows = cursor.execute('''
            SELECT ph.purchase_id, ph.invoice_num, ph.purchase_date, ph.grand_total,
                   s.supplier_name, COUNT(pd.detail_id) AS item_count,
                   COALESCE(SUM(pd.qty), 0) AS total_qty
            FROM purchase_headers ph
            LEFT JOIN suppliers s ON s.supplier_id = ph.supplier_id
            LEFT JOIN purchase_details pd ON pd.purchase_id = ph.purchase_id
            GROUP BY ph.purchase_id
            ORDER BY ph.purchase_id DESC
            LIMIT ?
        ''', (limit,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ONE INVOICE'S FULL DETAIL (for a "view invoice" screen)
def get_purchase_invoice(purchase_id):
    """Returns one invoice's header + its line items, or None if not found."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        header = cursor.execute('''
            SELECT ph.*, s.supplier_name
            FROM purchase_headers ph
            LEFT JOIN suppliers s ON s.supplier_id = ph.supplier_id
            WHERE ph.purchase_id = ?
        ''', (purchase_id,)).fetchone()
        if header is None:
            return None

        lines = cursor.execute('''
            SELECT pd.*, i.item_code, i.item_name
            FROM purchase_details pd
            JOIN items i ON i.item_id = pd.item_id
            WHERE pd.purchase_id = ?
        ''', (purchase_id,)).fetchall()

        result = dict(header)
        result['lines'] = [dict(l) for l in lines]
        return result
    finally:
        conn.close()


if __name__ == '__main__':
    # Quick smoke test against the seeded database.
    try:
        new_id = create_purchase_invoice(
            supplier_id=1,
            invoice_num='PUR-TEST-001',
            purchase_date='2026-07-22',
            lines=[
                {'item_id': 1, 'qty': 20, 'unit_cost': 3200},
                {'item_id': 4, 'qty': 50, 'unit_cost': 320},
            ],
            user_id=1,
        )
        print("Created purchase_id:", new_id)
        print(get_purchase_invoice(new_id))

        # Duplicate invoice_num should be rejected cleanly.
        create_purchase_invoice(1, 'PUR-TEST-001', '2026-07-22', [{'item_id': 1, 'qty': 1, 'unit_cost': 1}], 1)
    except PurchaseError as e:
        print("Expected rejection worked:", e)
