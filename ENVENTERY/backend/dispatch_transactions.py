import sqlite3
import os
from datetime import datetime

# Always resolve to database/airtouch_erp.db regardless of the current
# working directory the script is launched from.
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'database', 'airtouch_erp.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # SQLite enforces foreign keys per-connection, not per-database.
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


class DispatchError(Exception):
    """Raised when a dispatch cannot be safely recorded."""
    pass


# CREATE A (POSSIBLY MULTI-ITEM) DISPATCH TO A CITY/EMPLOYEE, ATOMICALLY
def create_dispatch(city_code, employee_id, lines, remarks, user_id, dispatch_date=None):
    """
    Records one dispatch trip -- one or more items sent to a city with a
    field employee -- in a single database transaction:
      1. one row in `dispatches` per line item (the table has no header,
         so each item movement is its own row; they share city/employee/
         date/remarks so the frontend can still group them as one trip)
      2. one DISPATCH entry in inventory_transactions per line, referencing
         that row's own dispatch_id (e.g. "DSP-14")
      3. items.available_stock decremented for every line
      4. one audit_logs row per line

    Everything happens on the SAME connection so it either all commits
    together or all rolls back together -- a bad line item can never leave
    some items dispatched and others not.

    lines: list of dicts -> [{'item_id': int, 'qty': int}, ...]

    Raises DispatchError if:
      - lines is empty
      - city_code doesn't exist
      - employee_id doesn't exist
      - any item_id doesn't exist or qty <= 0
      - the dispatch would drive any item's stock negative (checked on the
        combined quantity per item across all lines, so sending the same
        item twice in one trip is still validated correctly)

    Returns the list of new dispatch_ids (one per line, in order).
    """
    if not lines:
        raise DispatchError("A dispatch needs at least one item line.")

    dispatch_date = dispatch_date or datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    conn = get_db()
    try:
        cursor = conn.cursor()

        city = cursor.execute(
            "SELECT city_code FROM cities WHERE city_code = ?", (city_code,)
        ).fetchone()
        if city is None:
            raise DispatchError(f"City code '{city_code}' does not exist.")

        employee = cursor.execute(
            "SELECT employee_id FROM employees WHERE employee_id = ?", (employee_id,)
        ).fetchone()
        if employee is None:
            raise DispatchError(f"Employee ID {employee_id} does not exist.")

        # Validate every line, and pre-check combined stock per item so a
        # trip dispatching the same item across two lines is still caught
        # correctly (checking each line against the live cache in
        # isolation would let that slip through).
        needed_by_item = {}
        clean_lines = []
        for line in lines:
            item_id = line.get('item_id')
            qty = line.get('qty')

            if qty is None or qty <= 0:
                raise DispatchError(f"Item ID {item_id}: qty must be greater than zero.")

            item = cursor.execute(
                "SELECT item_id, available_stock FROM items WHERE item_id = ?", (item_id,)
            ).fetchone()
            if item is None:
                raise DispatchError(f"Item ID {item_id} does not exist.")

            needed_by_item[item_id] = needed_by_item.get(item_id, 0) + qty
            clean_lines.append((item_id, qty))

        for item_id, needed_qty in needed_by_item.items():
            available = cursor.execute(
                "SELECT available_stock FROM items WHERE item_id = ?", (item_id,)
            ).fetchone()['available_stock']
            if available - needed_qty < 0:
                raise DispatchError(
                    f"Item ID {item_id}: dispatch needs {needed_qty} but only "
                    f"{available} in stock."
                )

        # Write each line: dispatches row -> ledger entry -> stock -> audit log
        new_ids = []
        for item_id, qty in clean_lines:
            cursor.execute('''
                INSERT INTO dispatches (city_code, employee_id, item_id, qty, dispatch_date, remarks, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (city_code, employee_id, item_id, qty, dispatch_date, remarks, user_id))
            dispatch_id = cursor.lastrowid
            new_ids.append(dispatch_id)
            reference_id = f"DSP-{dispatch_id}"

            cursor.execute('''
                INSERT INTO inventory_transactions (item_id, transaction_type, qty, reference_id, created_by)
                VALUES (?, 'DISPATCH', ?, ?, ?)
            ''', (item_id, qty, reference_id, user_id))

            cursor.execute('''
                UPDATE items SET available_stock = available_stock - ? WHERE item_id = ?
            ''', (qty, item_id))

            cursor.execute('''
                INSERT INTO audit_logs (user_id, action_type, details)
                VALUES (?, ?, ?)
            ''', (user_id, "INVENTORY_DISPATCH",
                  f"Item ID: {item_id}, Delta: -{qty}, Ref: {reference_id}, City: {city_code}"))

        conn.commit()
        print(f"✅ Dispatch to {city_code} recorded — {len(clean_lines)} line(s), "
              f"dispatch_ids {new_ids}")
        return new_ids

    except DispatchError:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise DispatchError(f"Dispatch failed (unexpected error): {e}") from e
    finally:
        conn.close()


# LIST DISPATCHES FOR THE DISPATCH PAGE TABLE
def list_dispatches(limit=200):
    """Returns recent dispatch rows with city/employee/item names, newest first."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        rows = cursor.execute('''
            SELECT d.dispatch_id, d.city_code, c.city_name, d.employee_id, e.full_name AS employee_name,
                   d.item_id, i.item_code, i.item_name, d.qty, d.dispatch_date, d.remarks
            FROM dispatches d
            LEFT JOIN cities c ON c.city_code = d.city_code
            LEFT JOIN employees e ON e.employee_id = d.employee_id
            LEFT JOIN items i ON i.item_id = d.item_id
            ORDER BY d.dispatch_id DESC
            LIMIT ?
        ''', (limit,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# REVERSE A SINGLE DISPATCH ROW (e.g. mis-keyed entry) BY PUTTING STOCK BACK
def reverse_dispatch(dispatch_id, user_id):
    """
    Reverses one dispatch row: adds its qty back to items.available_stock via
    a RETURN ledger entry (the dispatch row itself is left in place as a
    historical record, same as a voided invoice rather than a deleted one).
    Raises DispatchError if the dispatch_id doesn't exist.
    """
    conn = get_db()
    try:
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT dispatch_id, item_id, qty FROM dispatches WHERE dispatch_id = ?", (dispatch_id,)
        ).fetchone()
        if row is None:
            raise DispatchError(f"Dispatch ID {dispatch_id} does not exist.")

        reference_id = f"DSP-{dispatch_id}-REV"
        cursor.execute('''
            INSERT INTO inventory_transactions (item_id, transaction_type, qty, reference_id, created_by)
            VALUES (?, 'RETURN', ?, ?, ?)
        ''', (row['item_id'], row['qty'], reference_id, user_id))

        cursor.execute('''
            UPDATE items SET available_stock = available_stock + ? WHERE item_id = ?
        ''', (row['qty'], row['item_id']))

        cursor.execute('''
            INSERT INTO audit_logs (user_id, action_type, details)
            VALUES (?, ?, ?)
        ''', (user_id, "INVENTORY_DISPATCH_REVERSED",
              f"Item ID: {row['item_id']}, Delta: +{row['qty']}, Ref: {reference_id}"))

        conn.commit()
        return True
    except DispatchError:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise DispatchError(f"Dispatch reversal failed (unexpected error): {e}") from e
    finally:
        conn.close()


if __name__ == '__main__':
    # Quick smoke test against the seeded database.
    try:
        ids = create_dispatch(
            city_code='BTK',
            employee_id=2,
            lines=[{'item_id': 1, 'qty': 10}, {'item_id': 4, 'qty': 5}],
            remarks='Field kit for BTK installs',
            user_id=1,
        )
        print("Created dispatch_ids:", ids)
        print(list_dispatches(5))

        # Over-dispatching (more than available stock) should be rejected cleanly.
        create_dispatch('BTK', 2, [{'item_id': 4, 'qty': 999999}], 'oops', 1)
    except DispatchError as e:
        print("Expected rejection worked:", e)
