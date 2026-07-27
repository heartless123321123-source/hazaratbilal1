import sqlite3
import os

# Always resolve to database/airtouch_erp.db regardless of the current
# working directory the script is launched from.
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'database', 'airtouch_erp.db')

VALID_TRANSACTION_TYPES = {
    'PURCHASE': 1,       # Inflow
    'RETURN': 1,         # Inflow
    'DISPATCH': -1,      # Outflow
    'INSTALLATION': -1,  # Outflow
    'ADJUSTMENT': 0,      # Sign comes from the caller (+found / -lost)
}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # SQLite enforces foreign keys per-connection, not per-database.
    # Every new connection MUST re-enable this or REFERENCES constraints
    # are silently ignored, letting orphaned rows slip in.
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


class InventoryTransactionError(Exception):
    """Raised when an inventory transaction cannot be safely completed."""
    pass


# CENTRAL TRANSACTION EXECUTION & STOCK CACHE AUTO-SYNC
def execute_inventory_transaction(item_id, trans_type, qty, reference_id, user_id):
    """
    Records a movement in the inventory ledger and keeps items.available_stock
    in sync. Raises InventoryTransactionError instead of failing silently, so
    a bad item_id or unknown transaction type can never corrupt the ledger.
    """
    if trans_type not in VALID_TRANSACTION_TYPES:
        raise InventoryTransactionError(
            f"Unknown transaction_type '{trans_type}'. "
            f"Expected one of: {', '.join(VALID_TRANSACTION_TYPES)}"
        )

    # Determine inflow (+) or outflow (-)
    if trans_type in ('DISPATCH', 'INSTALLATION'):
        delta_qty = -abs(qty)
    elif trans_type in ('PURCHASE', 'RETURN'):
        delta_qty = abs(qty)
    else:  # ADJUSTMENT — caller controls the sign (+found / -lost)
        delta_qty = qty

    conn = get_db()
    try:
        cursor = conn.cursor()

        # Validate the item actually exists before touching the ledger.
        # Without this check, a bad item_id (e.g. from a typo or a stale
        # reference) still gets a ledger row and an audit log entry,
        # while the stock UPDATE silently affects zero rows.
        item = cursor.execute(
            "SELECT item_id, available_stock FROM items WHERE item_id = ?",
            (item_id,)
        ).fetchone()
        if item is None:
            raise InventoryTransactionError(f"Item ID {item_id} does not exist.")

        # Guard against adjustments/dispatches driving stock negative.
        if item['available_stock'] + delta_qty < 0:
            raise InventoryTransactionError(
                f"Transaction would drive Item ID {item_id} stock negative "
                f"(current: {item['available_stock']}, delta: {delta_qty})."
            )

        # 1. Record entry in the central inventory ledger
        cursor.execute('''
            INSERT INTO inventory_transactions (item_id, transaction_type, qty, reference_id, created_by)
            VALUES (?, ?, ?, ?, ?)
        ''', (item_id, trans_type, delta_qty, reference_id, user_id))

        # 2. Update the available_stock cache on the master item row
        cursor.execute('''
            UPDATE items
            SET available_stock = available_stock + ?
            WHERE item_id = ?
        ''', (delta_qty, item_id))

        # 3. Log in the system audit trail
        cursor.execute('''
            INSERT INTO audit_logs (user_id, action_type, details)
            VALUES (?, ?, ?)
        ''', (user_id, f"INVENTORY_{trans_type}", f"Item ID: {item_id}, Delta: {delta_qty}, Ref: {reference_id}"))

        conn.commit()
        print(f"✅ Transaction successful. Item ID {item_id} stock updated by {delta_qty} Pcs.")
        return True

    except InventoryTransactionError as e:
        conn.rollback()
        print(f"❌ Transaction rejected: {e}")
        raise

    except Exception as e:
        conn.rollback()
        print(f"❌ Transaction failed (unexpected error): {e}")
        raise

    finally:
        conn.close()


# REAL-TIME STOCK RECALCULATION & AUDIT CHECKER
def verify_and_reconcile_item_stock(item_id):
    """
    Ensures stock accuracy by recalculating available_stock from the ledger
    and syncing it back onto the items cache. Raises InventoryTransactionError
    if the item doesn't exist, instead of silently writing NULL/0 stock.
    """
    conn = get_db()
    try:
        cursor = conn.cursor()

        exists = cursor.execute(
            "SELECT 1 FROM items WHERE item_id = ?", (item_id,)
        ).fetchone()
        if exists is None:
            raise InventoryTransactionError(f"Item ID {item_id} does not exist.")

        ledger_sum = cursor.execute(
            "SELECT SUM(qty) FROM inventory_transactions WHERE item_id = ?",
            (item_id,)
        ).fetchone()[0] or 0

        cursor.execute(
            "UPDATE items SET available_stock = ? WHERE item_id = ?",
            (ledger_sum, item_id)
        )
        conn.commit()
        return ledger_sum

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


if __name__ == '__main__':
    # Quick smoke test showing the fix: a bad item_id is now rejected
    # instead of corrupting the ledger.
    try:
        execute_inventory_transaction(999, 'DISPATCH', 5, 'DSP-TEST', 1)
    except InventoryTransactionError as e:
        print("Expected rejection worked:", e)
