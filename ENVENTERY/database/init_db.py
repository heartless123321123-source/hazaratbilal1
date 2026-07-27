import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'airtouch_erp.db')


def init_enterprise_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Foreign Keys Enforcement & Performance Pragmas
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA journal_mode = WAL;")  # High concurrency write mode

    print("🚀 Initializing Air Touch ERP Enterprise Database Schema...")

    # 1. CITIES / REGIONAL LOCATIONS
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cities (
            city_id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_code VARCHAR(10) UNIQUE NOT NULL, -- e.g. BTK, ALD, THA
            city_name VARCHAR(50) NOT NULL
        )
    ''')

    # 2. CATEGORIES TABLE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            category_id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_name VARCHAR(50) UNIQUE NOT NULL,
            code_prefix VARCHAR(5) UNIQUE NOT NULL -- ONU, CAB, RTR, ADP
        )
    ''')

    # 3. SUPPLIERS TABLE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS suppliers (
            supplier_id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_name VARCHAR(100) NOT NULL,
            contact_person VARCHAR(50),
            phone VARCHAR(20),
            address TEXT
        )
    ''')

    # 4. EMPLOYEES TABLE (Decoupled from Logins)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
            emp_code VARCHAR(10) UNIQUE NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            department VARCHAR(50) DEFAULT 'Technical', -- Technical, Billing, Store
            joining_date DATE,
            phone VARCHAR(20),
            status VARCHAR(20) DEFAULT 'Active' -- Active / Inactive / Resigned
        )
    ''')

    # 5. USER ACCOUNTS & PERMISSIONS TABLE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL, -- Admin, Manager, Field_Tech, Staff
            employee_id INT REFERENCES employees(employee_id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 6. MASTER ITEMS INVENTORY TABLE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS items (
            item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_code VARCHAR(20) UNIQUE NOT NULL,
            item_name VARCHAR(100) NOT NULL,
            category_id INT REFERENCES categories(category_id),
            available_stock INT DEFAULT 0, -- Cache counter (recalculated from ledger)
            min_stock_limit INT DEFAULT 5,
            purchase_price DECIMAL(10,2) NOT NULL,
            sale_price DECIMAL(10,2) NOT NULL,
            unit VARCHAR(15) DEFAULT 'Pcs',
            image_path TEXT DEFAULT 'default.png',
            notes TEXT
        )
    ''')

    # 7. MASTER CUSTOMERS TABLE (GIS & Map Ready)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            customer_id VARCHAR(20) PRIMARY KEY, -- e.g. MGL607
            customer_name VARCHAR(100) NOT NULL,
            phone VARCHAR(20),
            address TEXT,
            city_code VARCHAR(10) REFERENCES cities(city_code),
            package_name VARCHAR(50) NOT NULL,
            monthly_fee DECIMAL(10,2) NOT NULL,
            latitude DECIMAL(10,8),
            longitude DECIMAL(11,8),
            connection_status VARCHAR(20) DEFAULT 'Active' -- Active, Suspended, Pending
        )
    ''')

    # 8. ITEM SERIALS TRACKING (Barcode / QR / Devices)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS item_serials (
            serial_id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INT REFERENCES items(item_id),
            serial_number VARCHAR(100) UNIQUE NOT NULL,
            status VARCHAR(20) DEFAULT 'Available', -- Available, Installed, Returned, Damaged
            customer_id VARCHAR(20) REFERENCES customers(customer_id),
            install_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 9. PURCHASES HEADER
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS purchase_headers (
            purchase_id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_num VARCHAR(50) UNIQUE NOT NULL,
            supplier_id INT REFERENCES suppliers(supplier_id),
            purchase_date DATE NOT NULL,
            grand_total DECIMAL(10,2) DEFAULT 0.00,
            created_by INT REFERENCES users(user_id)
        )
    ''')

    # 10. PURCHASES DETAILS (Multi-Item Invoices)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS purchase_details (
            detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INT REFERENCES purchase_headers(purchase_id) ON DELETE CASCADE,
            item_id INT REFERENCES items(item_id),
            qty INT NOT NULL,
            unit_cost DECIMAL(10,2) NOT NULL,
            total_cost DECIMAL(10,2) NOT NULL
        )
    ''')

    # 11. DISPATCHES TABLE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS dispatches (
            dispatch_id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_code VARCHAR(10) REFERENCES cities(city_code),
            employee_id INT REFERENCES employees(employee_id),
            item_id INT REFERENCES items(item_id),
            qty INT NOT NULL,
            dispatch_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            remarks TEXT,
            created_by INT REFERENCES users(user_id)
        )
    ''')

    # 12. RETURNS TABLE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS item_returns (
            return_id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id VARCHAR(20) REFERENCES customers(customer_id),
            item_id INT REFERENCES items(item_id),
            serial_number VARCHAR(100),
            qty INT NOT NULL,
            reason VARCHAR(100), -- Faulty, Uninstalled, Package Cancelled
            returned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by INT REFERENCES users(user_id)
        )
    ''')

    # 13. STOCK ADJUSTMENT TABLE (Audit & Losses)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS stock_adjustments (
            adj_id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INT REFERENCES items(item_id),
            adjusted_qty INT NOT NULL, -- e.g., -2 (Lost) or +1 (Found)
            reason VARCHAR(100) NOT NULL, -- Damaged, Miscount, Theft
            adjusted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by INT REFERENCES users(user_id)
        )
    ''')

    # 14. INVENTORY TRANSACTIONS (CENTRAL AUDITABLE LEDGER)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory_transactions (
            transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INT REFERENCES items(item_id),
            transaction_type VARCHAR(20) NOT NULL, -- PURCHASE, DISPATCH, INSTALLATION, RETURN, ADJUSTMENT
            qty INT NOT NULL, -- + Positive (Inflow) or - Negative (Outflow)
            reference_id VARCHAR(50), -- e.g., Inv-102, Dispatch-44, Install-99
            created_by INT REFERENCES users(user_id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 15. SYSTEM AUDIT LOGS
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INT REFERENCES users(user_id),
            action_type VARCHAR(50) NOT NULL,
            details TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 16. INSTALLATIONS HEADER (a customer connection install: package fee +
    # whatever free/extra material was used on-site)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS installations (
            installation_id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id VARCHAR(20) REFERENCES customers(customer_id),
            employee_id INT REFERENCES employees(employee_id),
            install_date DATE NOT NULL,
            installation_fee DECIMAL(10,2) DEFAULT 0.00,   -- one-time connection charge, e.g. 5000
            extra_charge_total DECIMAL(10,2) DEFAULT 0.00, -- billed for material used beyond the free allowance
            grand_total DECIMAL(10,2) DEFAULT 0.00,        -- installation_fee + extra_charge_total
            remarks TEXT,
            created_by INT REFERENCES users(user_id)
        )
    ''')

    # 17. INSTALLATION DETAILS (material used per install: how much was free
    # vs. how much gets billed as extra)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS installation_details (
            detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
            installation_id INT REFERENCES installations(installation_id) ON DELETE CASCADE,
            item_id INT REFERENCES items(item_id),
            qty INT NOT NULL,             -- total qty used on-site
            free_qty INT DEFAULT 0,       -- qty covered free by the package
            extra_qty INT DEFAULT 0,      -- qty billed extra = max(0, qty - free_qty)
            unit_price DECIMAL(10,2) DEFAULT 0.00, -- price used to bill the extra qty
            extra_charge DECIMAL(10,2) DEFAULT 0.00 -- extra_qty * unit_price
        )
    ''')

    conn.commit()
    conn.close()
    print("✅ Complete Enterprise Database Schema built successfully with 17 Core Tables!")
    print(f"   Database file: {DB_PATH}")


if __name__ == '__main__':
    init_enterprise_db()
