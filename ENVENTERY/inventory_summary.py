"""
Inventory Summary — Total Stock & Total Inventory Value
---------------------------------------------------------
Reads directly from database/airtouch_erp.db and calculates:
  1. Total Stock (sum of available_stock across all items)
  2. Total Inventory Value (stock x purchase_price per item, summed)

This uses the SAME formula as store_inventory.html's updateMetrics():
    totalStock = items.reduce((s,i) => s + i.stock, 0)
    invValue   = items.reduce((s,i) => s + i.stock * i.purchase, 0)
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'airtouch_erp.db')


def get_inventory_summary():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    items = cursor.execute('''
        SELECT item_code, item_name, available_stock, purchase_price, sale_price, unit
        FROM items
    ''').fetchall()

    conn.close()

    total_stock = sum(i['available_stock'] for i in items)
    total_value_purchase = sum(i['available_stock'] * i['purchase_price'] for i in items)
    total_value_sale = sum(i['available_stock'] * i['sale_price'] for i in items)

    return {
        'total_items': len(items),
        'total_stock': total_stock,
        'total_value_purchase': round(total_value_purchase, 2),  # cost-based value (same as dashboard)
        'total_value_sale': round(total_value_sale, 2),          # sale-price based value
        'items': [dict(i) for i in items],
    }


if __name__ == '__main__':
    summary = get_inventory_summary()

    print("=" * 55)
    print("📦 AIRTOUCH INVENTORY SUMMARY")
    print("=" * 55)
    for it in summary['items']:
        line_value = it['available_stock'] * it['purchase_price']
        print(f"{it['item_code']:<10} {it['item_name']:<28} "
              f"{it['available_stock']:>5} {it['unit']:<5} "
              f"Rs {it['purchase_price']:>8,.0f}  ->  Rs {line_value:>10,.0f}")

    print("-" * 55)
    print(f"Total Items          : {summary['total_items']}")
    print(f"Total Stock          : {summary['total_stock']:,} Pcs")
    print(f"Total Value (cost)   : PKR {summary['total_value_purchase']:,.0f}")
    print(f"Total Value (sale)   : PKR {summary['total_value_sale']:,.0f}")
    print("=" * 55)
