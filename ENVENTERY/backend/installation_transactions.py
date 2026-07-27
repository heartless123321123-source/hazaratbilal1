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


class InstallationError(Exception):
    """Raised when an installation (or a material return against one) cannot be safely recorded."""
    pass


# CREATE A NEW CUSTOMER INSTALLATION (package fee + free/extra material), ATOMICALLY
def create_installation(customer_id, employee_id, install_date, installation_fee, lines, user_id, remarks=None):
    """
    Records one customer connection install in a single database transaction:
      1. one row in `installations` (customer, employee, date, package fee,
         extra-material total, grand total)
      2. one row in `installation_details` per item used on-site, splitting
         qty into free_qty (covered by the package) and extra_qty (billed
         to the customer at unit_price)
      3. one INSTALLATION entry in inventory_transactions per line, so the
         ledger reflects every piece of stock that left the store
      4. items.available_stock decremented for every line
      5. one audit_logs row per line, noting any extra charge

    Everything happens on the SAME connection so it either all commits
    together or all rolls back together.

    lines: list of dicts ->
        [{'item_id': int, 'qty': int, 'free_qty': int, 'unit_price': float}, ...]
      - qty is the total amount of that item used on-site
      - free_qty is however much of it the package/allowance covers (e.g. a
        5000 Rs connection might include 1 modem, 50m wire, 2 patch cords free)
      - extra_qty = max(0, qty - free_qty) is billed at unit_price
        (extra_charge = extra_qty * unit_price)

    Raises InstallationError if:
      - lines is empty
      - customer_id or employee_id doesn't exist
      - any item_id doesn't exist, qty <= 0, free_qty < 0, or unit_price < 0
      - the combined qty needed for any item (across all lines) exceeds
        live available_stock

    Returns the new installation_id.
    """
    if not lines:
        raise InstallationError("An installation needs at least one item line.")

    conn = get_db()
    try:
        cursor = conn.cursor()

        customer = cursor.execute(
            "SELECT customer_id FROM customers WHERE customer_id = ?", (customer_id,)
        ).fetchone()
        if customer is None:
            raise InstallationError(f"Customer '{customer_id}' does not exist.")

        employee = cursor.execute(
            "SELECT employee_id FROM employees WHERE employee_id = ?", (employee_id,)
        ).fetchone()
        if employee is None:
            raise InstallationError(f"Employee ID {employee_id} does not exist.")

        # Validate every line, and pre-check combined stock per item so an
        # install using the same item across two lines is still caught
        # correctly (checking each line in isolation could let it slip through).
        needed_by_item = {}
        clean_lines = []
        extra_charge_total = 0.0
        for line in lines:
            item_id = line.get('item_id')
            qty = line.get('qty')
            free_qty = line.get('free_qty', 0) or 0
            unit_price = line.get('unit_price', 0) or 0

            if qty is None or qty <= 0:
                raise InstallationError(f"Item ID {item_id}: qty must be greater than zero.")
            if free_qty < 0:
                raise InstallationError(f"Item ID {item_id}: free_qty cannot be negative.")
            if unit_price < 0:
                raise InstallationError(f"Item ID {item_id}: unit_price cannot be negative.")

            item = cursor.execute(
                "SELECT item_id FROM items WHERE item_id = ?", (item_id,)
            ).fetchone()
            if item is None:
                raise InstallationError(f"Item ID {item_id} does not exist.")

            extra_qty = max(0, qty - free_qty)
            extra_charge = round(extra_qty * unit_price, 2)
            extra_charge_total += extra_charge

            needed_by_item[item_id] = needed_by_item.get(item_id, 0) + qty
            clean_lines.append((item_id, qty, free_qty, extra_qty, unit_price, extra_charge))

        for item_id, needed_qty in needed_by_item.items():
            available = cursor.execute(
                "SELECT available_stock FROM items WHERE item_id = ?", (item_id,)
            ).fetchone()['available_stock']
            if available - needed_qty < 0:
                raise InstallationError(
                    f"Item ID {item_id}: installation needs {needed_qty} but only "
                    f"{available} in stock."
                )

        extra_charge_total = round(extra_charge_total, 2)
        grand_total = round((installation_fee or 0) + extra_charge_total, 2)

        # 1. Header
        cursor.execute('''
            INSERT INTO installations
                (customer_id, employee_id, install_date, installation_fee, extra_charge_total, grand_total, remarks, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (customer_id, employee_id, install_date, installation_fee or 0, extra_charge_total, grand_total, remarks, user_id))
        installation_id = cursor.lastrowid
        reference_id = f"INST-{installation_id}"

        # 2. Details + ledger + stock cache + audit log, one line at a time
        for item_id, qty, free_qty, extra_qty, unit_price, extra_charge in clean_lines:
            cursor.execute('''
                INSERT INTO installation_details
                    (installation_id, item_id, qty, free_qty, extra_qty, unit_price, extra_charge)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (installation_id, item_id, qty, free_qty, extra_qty, unit_price, extra_charge))

            cursor.execute('''
                INSERT INTO inventory_transactions (item_id, transaction_type, qty, reference_id, created_by)
                VALUES (?, 'INSTALLATION', ?, ?, ?)
            ''', (item_id, -abs(qty), reference_id, user_id))

            cursor.execute('''
                UPDATE items SET available_stock = available_stock - ? WHERE item_id = ?
            ''', (qty, item_id))

            cursor.execute('''
                INSERT INTO audit_logs (user_id, action_type, details)
                VALUES (?, ?, ?)
            ''', (user_id, "INVENTORY_INSTALLATION",
                  f"Item ID: {item_id}, Delta: -{qty}, Ref: {reference_id}, Customer: {customer_id}, "
                  f"Free: {free_qty}, Extra: {extra_qty}, ExtraCharge: {extra_charge:.2f}"))

        conn.commit()
        print(f"✅ Installation for {customer_id} recorded — {len(clean_lines)} line(s), "
              f"fee {installation_fee}, extra {extra_charge_total}, grand total {grand_total}")
        return installation_id

    except InstallationError:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise InstallationError(f"Installation failed (unexpected error): {e}") from e
    finally:
        conn.close()


# LIST INSTALLATIONS FOR THE INSTALLATION LIST PAGE TABLE
def list_installations(limit=200):
    """Returns recent installations with customer/employee names + line totals, newest first."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        rows = cursor.execute('''
            SELECT ins.installation_id, ins.customer_id, c.customer_name, c.city_code,
                   ins.employee_id, e.full_name AS employee_name, ins.install_date,
                   ins.installation_fee, ins.extra_charge_total, ins.grand_total, ins.remarks,
                   COUNT(d.detail_id) AS item_count, COALESCE(SUM(d.qty), 0) AS total_qty
            FROM installations ins
            LEFT JOIN customers c ON c.customer_id = ins.customer_id
            LEFT JOIN employees e ON e.employee_id = ins.employee_id
            LEFT JOIN installation_details d ON d.installation_id = ins.installation_id
            GROUP BY ins.installation_id
            ORDER BY ins.installation_id DESC
            LIMIT ?
        ''', (limit,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ONE INSTALLATION'S FULL DETAIL (for a "view installation" screen)
def get_installation(installation_id):
    """Returns one installation's header + its line items, or None if not found."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        header = cursor.execute('''
            SELECT ins.*, c.customer_name, c.phone, c.address, c.city_code, e.full_name AS employee_name
            FROM installations ins
            LEFT JOIN customers c ON c.customer_id = ins.customer_id
            LEFT JOIN employees e ON e.employee_id = ins.employee_id
            WHERE ins.installation_id = ?
        ''', (installation_id,)).fetchone()
        if header is None:
            return None

        lines = cursor.execute('''
            SELECT d.*, i.item_code, i.item_name
            FROM installation_details d
            JOIN items i ON i.item_id = d.item_id
            WHERE d.installation_id = ?
        ''', (installation_id,)).fetchall()

        result = dict(header)
        result['lines'] = [dict(l) for l in lines]
        return result
    finally:
        conn.close()


# RETURN MATERIAL FROM AN EXISTING INSTALLATION BACK INTO STORE STOCK
def return_installation_material(installation_id, item_id, qty, reason, user_id):
    """
    Records material coming back from a customer install (e.g. de-wired on
    a disconnect, a faulty modem swapped out, leftover cable brought back):
      1. one row in `item_returns` (customer_id pulled from the installation)
      2. one RETURN entry in inventory_transactions
      3. items.available_stock incremented
      4. one audit_logs row

    Raises InstallationError if:
      - the installation doesn't exist
      - that item was never used on this installation
      - qty <= 0 or qty exceeds (original qty used - already returned so far)
    """
    conn = get_db()
    try:
        cursor = conn.cursor()

        install = cursor.execute(
            "SELECT installation_id, customer_id FROM installations WHERE installation_id = ?",
            (installation_id,)
        ).fetchone()
        if install is None:
            raise InstallationError(f"Installation ID {installation_id} does not exist.")

        if qty is None or qty <= 0:
            raise InstallationError("Return qty must be greater than zero.")

        detail = cursor.execute('''
            SELECT qty FROM installation_details
            WHERE installation_id = ? AND item_id = ?
        ''', (installation_id, item_id)).fetchone()
        if detail is None:
            raise InstallationError(f"Item ID {item_id} was not used on installation {installation_id}.")

        already_returned = cursor.execute('''
            SELECT COALESCE(SUM(qty), 0) AS q FROM item_returns
            WHERE customer_id = ? AND item_id = ? AND reason LIKE ?
        ''', (install['customer_id'], item_id, f"%INST-{installation_id}%")).fetchone()['q']

        remaining = detail['qty'] - already_returned
        if qty > remaining:
            raise InstallationError(
                f"Item ID {item_id}: only {remaining} of {detail['qty']} used on this "
                f"installation is still returnable (already returned: {already_returned})."
            )

        tagged_reason = f"{reason} [INST-{installation_id}]" if reason else f"[INST-{installation_id}]"

        cursor.execute('''
            INSERT INTO item_returns (customer_id, item_id, qty, reason, created_by)
            VALUES (?, ?, ?, ?, ?)
        ''', (install['customer_id'], item_id, qty, tagged_reason, user_id))
        return_id = cursor.lastrowid
        reference_id = f"INST-{installation_id}-RET-{return_id}"

        cursor.execute('''
            INSERT INTO inventory_transactions (item_id, transaction_type, qty, reference_id, created_by)
            VALUES (?, 'RETURN', ?, ?, ?)
        ''', (item_id, qty, reference_id, user_id))

        cursor.execute('''
            UPDATE items SET available_stock = available_stock + ? WHERE item_id = ?
        ''', (qty, item_id))

        cursor.execute('''
            INSERT INTO audit_logs (user_id, action_type, details)
            VALUES (?, ?, ?)
        ''', (user_id, "INVENTORY_INSTALL_MATERIAL_RETURNED",
              f"Item ID: {item_id}, Delta: +{qty}, Ref: {reference_id}, Customer: {install['customer_id']}, Reason: {reason}"))

        conn.commit()
        return return_id

    except InstallationError:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise InstallationError(f"Material return failed (unexpected error): {e}") from e
    finally:
        conn.close()


# LIST RETURNED MATERIAL ROWS (for the Returned Material page table)
def list_installation_returns(limit=200):
    """Returns recent item_returns rows tied to installations, newest first."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        rows = cursor.execute('''
            SELECT r.return_id, r.customer_id, c.customer_name, r.item_id, i.item_code, i.item_name,
                   r.qty, r.reason, r.returned_date
            FROM item_returns r
            LEFT JOIN customers c ON c.customer_id = r.customer_id
            LEFT JOIN items i ON i.item_id = r.item_id
            WHERE r.reason LIKE '%[INST-%'
            ORDER BY r.return_id DESC
            LIMIT ?
        ''', (limit,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


if __name__ == '__main__':
    # Quick smoke test against the seeded database.
    try:
        install_id = create_installation(
            customer_id='MGL607',
            employee_id=2,
            install_date='2026-07-22',
            installation_fee=5000,
            lines=[
                {'item_id': 1, 'qty': 1, 'free_qty': 1, 'unit_price': 3500},   # modem, free
                {'item_id': 4, 'qty': 12, 'free_qty': 10, 'unit_price': 21},   # wire, 10 units free / 2 extra
                {'item_id': 5, 'qty': 3, 'free_qty': 2, 'unit_price': 400},    # patch/adapter, 2 free / 1 extra
            ],
            user_id=1,
            remarks='New 20 Mbps home connection',
        )
        print("Created installation_id:", install_id)
        print(get_installation(install_id))

        # Return a bit of the extra cable that wasn't actually used.
        return_id = return_installation_material(install_id, 4, 2, 'Leftover cable not used', user_id=1)
        print("Returned material, return_id:", return_id)
        print(list_installation_returns(5))

        # Over-returning beyond what was used should be rejected cleanly.
        return_installation_material(install_id, 4, 999, 'oops', user_id=1)
    except InstallationError as e:
        print("Expected rejection worked:", e)
