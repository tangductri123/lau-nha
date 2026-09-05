import os
import sys
import json
import sqlite3
import argparse
from datetime import datetime

# UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

DB_PATHS = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "My-Brain", "brain.db"),
    "/app/My-Brain/brain.db",
    "/opt/my-website/My-Brain/brain.db",
    r"d:\BO\My-Brain\brain.db",
    r"d:\BO\Work\lau-nha\My-Brain\brain.db"
]

def get_valid_db_path():
    for p in DB_PATHS:
        if os.path.exists(p):
            return p
    return DB_PATHS[0]

def sync_sql(query, params=()):
    for p in DB_PATHS:
        if os.path.exists(p):
            try:
                conn = sqlite3.connect(p, timeout=10.0)
                conn.execute(query, params)
                conn.commit()
                conn.close()
            except Exception:
                pass

def get_business_signals(signal_type="all", mark_as_read=True, stock_threshold=5):
    db_path = get_valid_db_path()
    if not os.path.exists(db_path):
        return {
            "has_signals": False,
            "total_signals": 0,
            "signals": [],
            "error": f"Database not found at {db_path}"
        }

    conn = sqlite3.connect(db_path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    signals = []
    order_ids_to_mark = []

    # 1. ĐƠN HÀNG MỚI (new_orders)
    if signal_type in ("all", "new_orders", "orders"):
        order_query = """
            SELECT 
                o.id,
                COALESCE(o.order_code, '') AS order_code,
                o.customer_id,
                COALESCE(c.name, 'Khách hàng') AS customer_name,
                COALESCE(c.phone, '') AS customer_phone,
                COALESCE(o.address, '') AS delivery_address,
                COALESCE(p.name, 'Sản phẩm') AS product_name,
                COALESCE(o.amount, 0) AS amount,
                COALESCE(o.total_collection, 0) AS total_collection,
                COALESCE(o.note, '') AS note,
                COALESCE(o.raw_items_json, '') AS raw_items_json,
                o.order_date,
                o.status,
                COALESCE(o.notified, 0) AS notified
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN products p ON o.product_id = p.id
            WHERE o.status = 'pending' AND (o.notified = 0 OR o.notified IS NULL)
            ORDER BY o.id ASC
        """
        try:
            cur.execute(order_query)
            order_rows = cur.fetchall()

            grouped_orders = {}
            for row in order_rows:
                r = dict(row)
                order_ids_to_mark.append(r["id"])
                code = r["order_code"].strip() if r["order_code"] else f"LN{r['id']:04d}"
                group_key = code.upper()

                if group_key not in grouped_orders:
                    grouped_orders[group_key] = {
                        "type": "new_orders",
                        "order_code": code,
                        "order_ids": [r["id"]],
                        "customer_name": r["customer_name"],
                        "customer_phone": r["customer_phone"],
                        "delivery_address": r["delivery_address"],
                        "total_amount": float(r["total_collection"] if r["total_collection"] > 0 else r["amount"]),
                        "notes": r["note"],
                        "order_date": r["order_date"],
                        "items": [r["product_name"]],
                        "raw_items_json": r["raw_items_json"]
                    }
                else:
                    grouped_orders[group_key]["order_ids"].append(r["id"])
                    grouped_orders[group_key]["items"].append(r["product_name"])
                    if r["total_collection"] > grouped_orders[group_key]["total_amount"]:
                        grouped_orders[group_key]["total_amount"] = float(r["total_collection"])
                    elif r["amount"] > 0 and r["total_collection"] == 0:
                        grouped_orders[group_key]["total_amount"] += float(r["amount"])

            for grp in grouped_orders.values():
                if grp["raw_items_json"]:
                    try:
                        raw_items = json.loads(grp["raw_items_json"])
                        items_summary = ", ".join([f"{it.get('name', 'Món')} x{it.get('qty', 1)}" for it in raw_items])
                    except Exception:
                        items_summary = ", ".join(grp["items"])
                else:
                    items_summary = ", ".join(grp["items"])

                signals.append({
                    "type": "new_orders",
                    "order_code": grp["order_code"],
                    "customer_name": grp["customer_name"],
                    "customer_phone": grp["customer_phone"],
                    "delivery_address": grp["delivery_address"] or "Chưa cập nhật địa chỉ",
                    "total_amount": f"{grp['total_amount']:,.0f}",
                    "notes": grp["notes"] or "Không có ghi chú",
                    "items_summary": items_summary,
                    "order_date": grp["order_date"]
                })
        except Exception as e:
            print(f"[Error order_query]: {e}", file=sys.stderr)

    # 2. CẢNH BÁO TỒN KHO THẤP (low_stock)
    if signal_type in ("all", "low_stock", "inventory"):
        stock_query = """
            SELECT id, name, type, price, stock
            FROM products
            WHERE type = 'physical' AND stock IS NOT NULL AND stock <= ?
            ORDER BY stock ASC
        """
        try:
            cur.execute(stock_query, (stock_threshold,))
            stock_rows = cur.fetchall()
            for r in stock_rows:
                signals.append({
                    "type": "low_stock",
                    "product_id": r["id"],
                    "name": r["name"],
                    "sku": f"SP{r['id']:03d}",
                    "stock_quantity": r["stock"],
                    "unit": "phần / set",
                    "threshold": stock_threshold
                })
        except Exception as e:
            print(f"[Error stock_query]: {e}", file=sys.stderr)

    # 3. KHÁCH HÀNG TIỀM NĂNG / LEADS (new_leads)
    if signal_type in ("all", "new_leads", "leads"):
        lead_query = """
            SELECT id, name, phone, email, main_concern, interested_in_service, notes, created_at
            FROM leads
            ORDER BY id DESC
            LIMIT 3
        """
        try:
            cur.execute(lead_query)
            lead_rows = cur.fetchall()
            for r in lead_rows:
                interest = r["interested_in_service"] or r["main_concern"] or "Khảo sát / Ưu đãi 50k"
                signals.append({
                    "type": "new_leads",
                    "lead_id": r["id"],
                    "name": r["name"],
                    "phone": r["phone"] or "Không để lại SĐT",
                    "email": r["email"] or "",
                    "interest": interest,
                    "notes": r["notes"] or "Đăng ký nhận ưu đãi khảo sát",
                    "source": "Website Lẩu Nhà",
                    "created_at": r["created_at"]
                })
        except Exception as e:
            print(f"[Error lead_query]: {e}", file=sys.stderr)

    # 4. ĐÁNH DẤU ĐÃ THÔNG BÁO NẾU mark_as_read = True
    if mark_as_read and order_ids_to_mark:
        placeholders = ",".join("?" * len(order_ids_to_mark))
        update_query = f"UPDATE orders SET notified = 1 WHERE id IN ({placeholders})"
        try:
            cur.execute(update_query, order_ids_to_mark)
            conn.commit()
            sync_sql(update_query, order_ids_to_mark)
        except Exception as e:
            print(f"[Error update notified]: {e}", file=sys.stderr)

    conn.close()

    return {
        "has_signals": len(signals) > 0,
        "total_signals": len(signals),
        "signals": signals
    }

def main():
    parser = argparse.ArgumentParser(description="Quét tín hiệu kinh doanh chủ động cho Heartbeat Agent")
    parser.add_argument("--signal-type", type=str, default="all", choices=["all", "new_orders", "low_stock", "new_leads"], help="Loại tín hiệu cần quét")
    parser.add_argument("--mark-as-read", action="store_true", help="Đánh dấu các đơn đã quét là đã thông báo (notified = 1)")
    parser.add_argument("--stock-threshold", type=int, default=5, help="Ngưỡng cảnh báo tồn kho thấp")
    parser.add_argument("--pretty", action="store_true", help="Format JSON đẹp dễ đọc")

    args = parser.parse_args()

    result = get_business_signals(
        signal_type=args.signal_type,
        mark_as_read=args.mark_as_read,
        stock_threshold=args.stock_threshold
    )

    if args.pretty:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
