"""
Populates airtouch_erp.db with sample data so the dashboard and backend
have something real to show while you build. Safe to re-run - uses
INSERT OR IGNORE for master data and only adds ledger transactions once.
"""
import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), 'airtouch_erp.db')

# allow importing the backend module when run from anywhere
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from inventory_transactions import execute_inventory_transaction, InventoryTransactionError  # noqa: E402


def seed():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    print("🌱 Seeding master data...")

    cur.executemany(
        "INSERT OR IGNORE INTO cities (city_code, city_name) VALUES (?, ?)",
        [
            ('BTK', 'Bahria Town'), ('DHR', 'Dhamial'), ('TOK', 'Tokar'),
            ('BDN', 'Bandi'), ('CKD', 'Chakwal Road'), ('OCH', 'Ochali'),
            ('SKT', 'Saket'), ('THA', 'Thanda Pani'), ('ALD', 'Aldrich Colony'),
            ('TLS', 'Talwara'), ('MTA', 'Mattani'), ('SWT', 'Swat'),
            ('TMG', 'Tarnama'), ('KKL', 'Kakul'), ('CHARBAGH', 'Charbagh'),
            ('KOT', 'Kot'), ('SHM', 'Shamozai'), ('GHL', 'Ghalanai'),
        ]
    )

    cur.executemany(
        "INSERT OR IGNORE INTO categories (category_name, code_prefix) VALUES (?, ?)",
        [('Modem', 'ONU'), ('Router', 'RTR'), ('Cable', 'CAB'), ('Adapter', 'ADP')]
    )

    cur.executemany(
        "INSERT OR IGNORE INTO suppliers (supplier_name, contact_person, phone, address) VALUES (?, ?, ?, ?)",
        [
            ('FiberHome Vendor', 'Waqas Anjum', '0300-1112233', 'Hafeez Center, Lahore'),
            ('Huawei Direct', 'Sana Iqbal', '0321-4455667', 'I.I. Chundrigar Road, Karachi'),
            ('Local Vendor', 'Kashif Bhatti', '0333-7788990', 'Saddar, Rawalpindi'),
        ]
    )

    cur.executemany(
        "INSERT OR IGNORE INTO employees (emp_code, full_name, department, joining_date, phone) VALUES (?, ?, ?, ?, ?)",
        [
            ('EMP-001', 'Bilal Ahmed', 'Admin', '2023-01-10', '0300-0000001'),
            ('EMP-002', 'Ali Raza', 'Technical', '2023-03-15', '0300-0000002'),
            ('EMP-003', 'Asad Khan', 'Store', '2023-06-01', '0300-0000003'),
        ]
    )

    cur.executemany(
        "INSERT OR IGNORE INTO users (username, password_hash, role, employee_id) VALUES (?, ?, ?, ?)",
        [
            ('bilal', 'CHANGE_ME_HASH', 'Admin', 1),
            ('ali', 'CHANGE_ME_HASH', 'Field_Tech', 2),
            ('asad', 'CHANGE_ME_HASH', 'Staff', 3),
        ]
    )

    cur.executemany(
        "INSERT OR IGNORE INTO items (item_code, item_name, category_id, available_stock, min_stock_limit, purchase_price, sale_price) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            ('ONU-0001', 'ZTE GPON ONU Modem', 1, 0, 10, 3200, 3500),
            ('ONU-0002', 'FiberHome 10 Module', 1, 0, 10, 2900, 3200),
            ('RTR-0007', 'TP-Link Dual Band Router', 2, 0, 5, 4600, 5200),
            ('CAB-0125', 'Fiber Drop Cable (100m)', 3, 0, 5, 1800, 2100),
            ('ADP-0042', '12V Power Adapter', 4, 0, 10, 320, 400),
        ]
    )

    cur.executemany(
        "INSERT OR IGNORE INTO customers (customer_id, customer_name, phone, address, city_code, package_name, monthly_fee, connection_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ('MGL607', 'Ahmed Raza', '0301-1234567', 'Street 4, Bahria Town', 'BTK', '20 Mbps Home', 2500, 'Active'),
            ('DHR825', 'Sana Malik', '0302-2345678', 'Block C, Thanda Pani', 'THA', '10 Mbps Home', 1800, 'Active'),
            ('ALD112', 'Usman Tariq', '0303-3456789', 'Sector 5, Aldrich Colony', 'ALD', '50 Mbps Business', 4500, 'Pending'),
        ]
    )

    conn.commit()
    conn.close()
    print("✅ Master data seeded (cities, categories, suppliers, employees, users, items, customers).")

    print("🌱 Seeding opening stock via the inventory ledger...")
    opening_stock = [
        (1, 100, 'INV-OPEN-001'),  # ONU-0001
        (2, 40,  'INV-OPEN-002'),  # ONU-0002
        (3, 25,  'INV-OPEN-003'),  # RTR-0007
        (4, 15,  'INV-OPEN-004'),  # CAB-0125
        (5, 60,  'INV-OPEN-005'),  # ADP-0042
    ]
    for item_id, qty, ref in opening_stock:
        try:
            execute_inventory_transaction(item_id, 'PURCHASE', qty, ref, user_id=1)
        except InventoryTransactionError as e:
            print(f"   (skipped) {ref}: {e}")

    print("🎉 Seed complete. Database is ready to use.")


if __name__ == '__main__':
    seed()
