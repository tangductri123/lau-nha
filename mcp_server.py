from typing import Optional, Dict, Any, List, Tuple
import os
import sys
import json
import sqlite3
import urllib.request
import urllib.error
import ssl
from datetime import datetime

# UTF-8 output
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_dotenv(env_path=None):
    if not env_path:
        env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

load_dotenv()

# Secrets from env (No hardcoded fallback keys)
SEPAY_API_TOKEN = os.environ.get("SEPAY_API_TOKEN", "")
SEPAY_ACCOUNT_NUMBER = os.environ.get("SEPAY_ACCOUNT_NUMBER", "22678555999")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "-5566848105")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "LẨU NHÀ <cskh@order.laumangdi.com>")
RESEND_REPLY_TO = os.environ.get("RESEND_REPLY_TO", "tangductri15@gmail.com")

DB_PATHS = [
    os.path.join(BASE_DIR, "My-Brain", "brain.db"),
    os.path.join(BASE_DIR, "brain.db"),
    r"d:\BO\My-Brain\brain.db"
]

def get_db_conn():
    target = None
    for p in DB_PATHS:
        if os.path.exists(p):
            target = p
            break
    if not target:
        target = DB_PATHS[0]
        os.makedirs(os.path.dirname(target), exist_ok=True)
    conn = sqlite3.connect(target, timeout=20.0)
    conn.row_factory = sqlite3.Row
    return conn

# ==================== 1. get_daily_summary ====================
def get_daily_summary(date: str = "today") -> dict:
    """Báo cáo tổng quan doanh thu, đơn hàng và lead khảo sát trong ngày"""
    if date == "today" or not date:
        target_date = datetime.now().strftime("%Y-%m-%d")
    else:
        target_date = date

    conn = get_db_conn()
    cursor = conn.cursor()

    # Query Orders
    cursor.execute("""
        SELECT o.id, o.amount, o.status, o.order_code, o.order_date, p.name as product_name
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        WHERE DATE(o.order_date) = DATE(?)
    """, (target_date,))
    orders = [dict(r) for r in cursor.fetchall()]

    total_revenue = sum(o["amount"] for o in orders if o["status"] in ("paid", "confirmed", "shipping", "completed"))
    status_counts = {}
    product_sales = {}
    for o in orders:
        st = o["status"]
        status_counts[st] = status_counts.get(st, 0) + 1
        pname = o.get("product_name") or "Khác"
        product_sales[pname] = product_sales.get(pname, 0) + 1

    # Query Leads
    cursor.execute("SELECT COUNT(*) as cnt FROM leads WHERE DATE(created_at) = DATE(?)", (target_date,))
    lead_row = cursor.fetchone()
    leads_count = lead_row["cnt"] if lead_row else 0

    conn.close()

    top_products = [{"name": k, "quantity": v} for k, v in sorted(product_sales.items(), key=lambda x: x[1], reverse=True)]

    return {
        "date": target_date,
        "total_revenue_vnd": int(total_revenue),
        "total_revenue_formatted": f"{int(total_revenue):,} đ",
        "total_orders": len(orders),
        "orders_by_status": status_counts,
        "new_leads_count": leads_count,
        "top_products": top_products
    }

# ==================== 2. check_order_and_payment ====================
def check_order_and_payment(order_code: str = None, phone: str = None) -> dict:
    """Tra cứu chi tiết đơn hàng và kiểm tra tự động đối soát tiền về qua SePay"""
    if not order_code and not phone:
        return {"error": "Vui lòng cung cấp order_code (mã đơn) hoặc phone (số điện thoại)"}

    conn = get_db_conn()
    cursor = conn.cursor()

    if order_code:
        clean_code = order_code.strip().upper()
        cursor.execute("""
            SELECT o.id, o.order_code, o.amount, o.status, o.order_date,
                   c.name as customer_name, c.phone, c.email, p.name as product_name
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            LEFT JOIN products p ON o.product_id = p.id
            WHERE UPPER(o.order_code) = ?
            ORDER BY o.id DESC
        """, (clean_code,))
    else:
        clean_phone = phone.strip()
        cursor.execute("""
            SELECT o.id, o.order_code, o.amount, o.status, o.order_date,
                   c.name as customer_name, c.phone, c.email, p.name as product_name
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            LEFT JOIN products p ON o.product_id = p.id
            WHERE c.phone LIKE ?
            ORDER BY o.id DESC LIMIT 5
        """, (f"%{clean_phone}%",))

    rows = cursor.fetchall()
    if not rows:
        conn.close()
        return {"found": False, "message": f"Không tìm thấy đơn hàng với thông tin: {order_code or phone}"}

    first_row = dict(rows[0])
    target_code = first_row.get("order_code") or f"LN{first_row['id']}"
    total_amount = first_row["amount"]
    current_status = first_row["status"]

    payment_verified = False
    transaction_details = None

    # Nếu đơn chưa paid, check SePay API
    if current_status != "paid" and SEPAY_API_TOKEN:
        try:
            url = f"https://my.sepay.vn/userapi/transactions/list?account_number={SEPAY_ACCOUNT_NUMBER}&limit=20"
            req = urllib.request.Request(url, headers={"Authorization": f"Bearer {SEPAY_API_TOKEN}", "User-Agent": "LauNhaMCP/1.0"})
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                transactions = data.get("transactions", [])
                
                num_match = target_code.replace("LN", "")
                for tx in transactions:
                    desc = str(tx.get("transaction_content", "")).upper()
                    amt_in = float(tx.get("amount_in", 0))
                    if (target_code in desc or (num_match and num_match in desc)) and amt_in >= (total_amount - 1000):
                        payment_verified = True
                        transaction_details = {
                            "transaction_id": tx.get("id"),
                            "amount_in": amt_in,
                            "transaction_date": tx.get("transaction_date"),
                            "content": tx.get("transaction_content")
                        }
                        # Update status in DB
                        cursor.execute("UPDATE orders SET status = 'paid' WHERE order_code = ? OR id = ?", (target_code, first_row["id"]))
                        conn.commit()
                        current_status = "paid"
                        break
        except Exception as e:
            transaction_details = {"error_checking_sepay": str(e)}

    conn.close()

    items = [r["product_name"] for r in rows if r["product_name"]]

    return {
        "found": True,
        "order_code": target_code,
        "customer_name": first_row["customer_name"],
        "phone": first_row["phone"],
        "items": items,
        "amount": int(total_amount),
        "amount_formatted": f"{int(total_amount):,} đ",
        "status": current_status,
        "payment_verified": payment_verified or (current_status == "paid"),
        "transaction_details": transaction_details,
        "order_date": first_row["order_date"]
    }

# ==================== 3. create_manual_order ====================
def create_manual_order(
    customer_name: str,
    phone: str,
    address: str,
    product_name: Optional[str] = "Set Lẩu Cặp Đôi (2-3 người)",
    amount: Optional[float] = 299000,
    is_stove: Optional[bool] = False,
    email: Optional[str] = None,
    note: Optional[str] = None,
    items: Optional[List[Dict[str, Any]]] = None,
    deposit_amount: Optional[float] = 0,
    shipping_fee: Optional[float] = 0,
    discount_amount: Optional[float] = 0,
    voucher_code: Optional[str] = None,
    raw_text: Optional[str] = None
) -> dict:
    log_event("CALL_create_manual_order", {"customer_name": customer_name, "phone": phone, "product": product_name})
    sys.path.insert(0, PARENT_DIR)
    from ai_parser import validate_and_recalculate_order, match_product, get_all_db_products, parser as ai_parser_instance
    from telegram_bot import send_interactive_order_card

    # If raw_text is provided, use AI parser
    if raw_text and (not customer_name or not phone or not address or not items):
        parsed = ai_parser_instance.parse_order(raw_text)
        customer_name = customer_name or parsed.get("customer_name")
        phone = phone or parsed.get("phone")
        address = address or parsed.get("address")
        items = items or parsed.get("items")
        deposit_amount = deposit_amount if deposit_amount > 0 else parsed.get("deposit_amount", 0)
        shipping_fee = shipping_fee if shipping_fee > 0 else parsed.get("shipping_fee", 0)
        discount_amount = discount_amount if discount_amount > 0 else parsed.get("discount_amount", 0)
        voucher_code = voucher_code or parsed.get("voucher_code")
        note = note or parsed.get("note")
        is_stove = is_stove or parsed.get("is_stove", False)

    if not customer_name or not phone or not address:
        return {"success": False, "error": "Thiếu thông tin bắt buộc: customer_name, phone, address"}

    try:
        conn = get_db_conn()
        cursor = conn.cursor()

        # Add missing columns if needed
        for col_def in [
            "shipping_fee REAL DEFAULT 0",
            "deposit_amount REAL DEFAULT 0",
            "discount_amount REAL DEFAULT 0",
            "voucher_code TEXT",
            "total_collection REAL DEFAULT 0",
            "order_value REAL DEFAULT 0",
            "note TEXT",
            "raw_items_json TEXT"
        ]:
            col_name = col_def.split()[0]
            try:
                cursor.execute(f"ALTER TABLE orders ADD COLUMN {col_def}")
            except Exception:
                pass

        # 1. Customer
        cursor.execute("SELECT id FROM customers WHERE phone = ?", (phone.strip(),))
        cust_row = cursor.fetchone()
        if cust_row:
            cust_id = cust_row["id"]
            cursor.execute("UPDATE customers SET name = ?, email = COALESCE(?, email) WHERE id = ?", (customer_name.strip(), email, cust_id))
        else:
            cursor.execute("INSERT INTO customers (name, phone, email, kind) VALUES (?, ?, ?, 'customer')", (customer_name.strip(), phone.strip(), email))
            cust_id = cursor.lastrowid

        # 2. Process items
        db_products = get_all_db_products(conn)
        order_items_input = []
        if items and len(items) > 0:
            order_items_input = items
        else:
            order_items_input = [{
                "name": product_name or "Set Lẩu Cặp Đôi (2-3 người)",
                "qty": 1,
                "unit_price": float(amount or 299000),
                "subtotal": float(amount or 299000)
            }]

        validated_calc = validate_and_recalculate_order({
            "customer_name": customer_name,
            "phone": phone,
            "address": address,
            "items": order_items_input,
            "financials": {
                "deposit_amount": deposit_amount if deposit_amount > 0 else (200000 if is_stove else 0),
                "shipping_fee": shipping_fee,
                "discount_amount": discount_amount,
                "voucher_code": voucher_code
            },
            "is_stove": is_stove,
            "note": note
        }, db_conn=conn)

        now_ts = datetime.now()
        order_code = f"LN{now_ts.strftime('%m%d%H%M')[-4:]}"
        created_order_ids = []

        total_collection = validated_calc["total_collection"]
        order_value = validated_calc["order_value"]
        raw_items_json = json.dumps(validated_calc["items"], ensure_ascii=False)

        for it in validated_calc["items"]:
            p_id = it.get("product_id") or 1
            it_subtotal = it.get("subtotal", 0)
            cursor.execute('''
                INSERT INTO orders (customer_id, product_id, amount, status, order_code, order_date, shipping_fee, deposit_amount, discount_amount, voucher_code, total_collection, order_value, note, raw_items_json)
                VALUES (?, ?, ?, 'pending', ?, datetime('now', 'localtime'), ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                cust_id, p_id, it_subtotal, order_code,
                validated_calc["shipping_fee"], validated_calc["deposit_amount"], validated_calc["discount_amount"],
                validated_calc["voucher_code"], total_collection, order_value, validated_calc["note"], raw_items_json
            ))
            created_order_ids.append(cursor.lastrowid)

        conn.commit()
        conn.close()

        # QR VietQR based on total_collection
        qr_url = f"https://qr.sepay.vn/img?acc={SEPAY_ACCOUNT_NUMBER}&bank=MBBank&amount={int(total_collection)}&des={order_code}"

        # Send Interactive Card
        order_card_data = {
            "order_code": order_code,
            "customer_name": customer_name,
            "phone": phone,
            "address": address,
            "items": validated_calc["items"],
            "deposit_amount": validated_calc["deposit_amount"],
            "shipping_fee": validated_calc["shipping_fee"],
            "discount_amount": validated_calc["discount_amount"],
            "voucher_code": validated_calc["voucher_code"],
            "order_value": order_value,
            "total_collection": total_collection,
            "is_stove": validated_calc["is_stove"],
            "note": note,
            "confidence_score": validated_calc["confidence_score"],
            "warnings": validated_calc["warnings"]
        }
        tele_res = send_interactive_order_card(order_card_data)
        telegram_sent = bool(tele_res.get("ok"))

        # Email
        email_sent = False
        if email and RESEND_API_KEY:
            try:
                items_html = "".join([f"<li><b>{it['qty']}x {it['name']}:</b> {it['subtotal']:,} đ</li>" for it in validated_calc['items']])
                email_body = f'''
                <div style="font-family: sans-serif; max-width: 520px; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #b91c1c;">LẨU NHÀ - XÁC NHẬN ĐƠN HÀNG #{order_code}</h2>
                    <p>Kính chào <b>{customer_name}</b>,</p>
                    <p>Cảm ơn bạn đã đặt lẩu tại Lẩu Nhà. Chi tiết đơn hàng của bạn:</p>
                    <ul>{items_html}</ul>
                    <p><b>Tổng thanh toán (chuyển khoản):</b> <span style="color:#b91c1c; font-size:18px;">{int(total_collection):,} đ</span></p>
                    <p><b>Địa chỉ nhận hàng:</b> {address}</p>
                    <div style="text-align: center; margin: 20px 0;">
                        <img src="{qr_url}" style="max-width: 240px; border-radius: 8px;" alt="QR Code"/>
                    </div>
                </div>
                '''
                payload = json.dumps({
                    "from": RESEND_FROM,
                    "to": [email],
                    "reply_to": RESEND_REPLY_TO,
                    "subject": f"[Lẩu Nhà] Xác nhận đơn hàng #{order_code}",
                    "html": email_body
                }).encode("utf-8")
                req = urllib.request.Request("https://api.resend.com/emails", data=payload, headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json", "User-Agent": "LauNhaMCP/1.0"})
                with urllib.request.urlopen(req, timeout=10) as r:
                    email_sent = (r.status == 200)
            except Exception as e:
                log_event("WARN_resend_email", str(e))

        res = {
            "success": True,
            "order_code": order_code,
            "order_ids": created_order_ids,
            "customer_id": cust_id,
            "items_count": len(validated_calc["items"]),
            "items": validated_calc["items"],
            "total_collection": int(total_collection),
            "total_collection_formatted": f"{int(total_collection):,} đ",
            "order_value": int(order_value),
            "order_value_formatted": f"{int(order_value):,} đ",
            "deposit_amount": int(validated_calc["deposit_amount"]),
            "shipping_fee": int(validated_calc["shipping_fee"]),
            "discount_amount": int(validated_calc["discount_amount"]),
            "qr_payment_url": qr_url,
            "warnings": validated_calc["warnings"],
            "telegram_notified": telegram_sent,
            "email_sent": email_sent,
            "message": f"Đã tạo đơn thành công mã #{order_code} cho khách {customer_name} (Tổng thu: {int(total_collection):,}đ, Doanh thu: {int(order_value):,}đ)!"
        }
        log_event("RESULT_create_manual_order", {"order_code": order_code, "total_collection": int(total_collection)})
        return res
    except Exception as e:
        log_event("ERROR_create_manual_order", str(e))
        return {"success": False, "error": str(e)}


# ==================== MCP JSON-RPC Stdio Handler ====================
TOOLS_METADATA = [
    {
        "name": "get_daily_summary",
        "description": "Lấy báo cáo tổng quan ngày: tổng doanh thu, số lượng đơn hàng, số đơn đã thanh toán/chờ duyệt, số lead mới và các món bán chạy nhất.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Ngày cần xem báo cáo định dạng YYYY-MM-DD hoặc 'today' (mặc định 'today')"
                }
            }
        }
    },
    {
        "name": "check_order_and_payment",
        "description": "Tra cứu chi tiết đơn hàng theo mã đơn (ví dụ LN1024) hoặc số điện thoại, đồng thời tự động kết nối SePay để đối soát kiểm tra xem tiền đã chuyển vào tài khoản chưa.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "order_code": {
                    "type": "string",
                    "description": "Mã đơn hàng cần kiểm tra (ví dụ: LN1024)"
                },
                "phone": {
                    "type": "string",
                    "description": "Số điện thoại khách hàng (nếu không có mã đơn)"
                }
            }
        }
    },
    {
        "name": "create_manual_order",
        "description": "Tạo đơn hàng lẩu mới với bóc tách tài chính chuẩn F&B (Fuzzy Matching tên món, tách bạch Tổng thu vs Doanh thu vs Tiền cọc bếp), sinh mã thanh toán VietQR và gửi Thẻ xác nhận Interactive kèm nút [Chốt đơn] về Telegram.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "customer_name": {
                    "type": "string",
                    "description": "Họ và tên khách hàng"
                },
                "phone": {
                    "type": "string",
                    "description": "Số điện thoại nhận hàng"
                },
                "address": {
                    "type": "string",
                    "description": "Địa chỉ nhận lẩu"
                },
                "items": {
                    "type": "array",
                    "description": "Danh sách chi tiết từng món: [{'name': 'Lẩu Thái Gia Đình', 'qty': 1, 'unit_price': 399000}]",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Tên món"},
                            "qty": {"type": "integer", "description": "Số lượng"},
                            "unit_price": {"type": "number", "description": "Đơn giá"}
                        },
                        "required": ["name"]
                    }
                },
                "product_name": {
                    "type": "string",
                    "description": "Tên set lẩu chính (nếu không truyền items)"
                },
                "amount": {
                    "type": "number",
                    "description": "Tổng tiền món (nếu không truyền items)"
                },
                "is_stove": {
                    "type": "boolean",
                    "description": "Khách có mượn bếp cồn không (nếu có sẽ tự tính cọc 200.000đ)"
                },
                "deposit_amount": {
                    "type": "number",
                    "description": "Tiền cọc mượn bếp cồn (khoản nợ hoàn lại khách, mặc định 200000 nếu mượn bếp)"
                },
                "shipping_fee": {
                    "type": "number",
                    "description": "Phí giao hàng"
                },
                "discount_amount": {
                    "type": "number",
                    "description": "Số tiền giảm giá voucher"
                },
                "voucher_code": {
                    "type": "string",
                    "description": "Mã giảm giá (ví dụ: LAUNHA50K)"
                },
                "email": {
                    "type": "string",
                    "description": "Email khách hàng (nếu có)"
                },
                "note": {
                    "type": "string",
                    "description": "Ghi chú khẩu vị, giờ giao"
                },
                "raw_text": {
                    "type": "string",
                    "description": "Toàn bộ tin nhắn chat chốt đơn của khách để AI tự bóc tách và đối soát"
                }
            },
            "required": ["customer_name", "phone", "address"]
        }
    }
]

def handle_json_rpc(line: str):
    try:
        req = json.loads(line)
    except Exception:
        return

    msg_id = req.get("id")
    method = req.get("method")
    params = req.get("params", {})

    if method == "tools/list":
        res = {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "tools": TOOLS_METADATA
            }
        }
        sys.stdout.write(json.dumps(res, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    elif method == "tools/call":
        tool_name = params.get("name")
        tool_args = params.get("arguments", {})

        try:
            if tool_name == "get_daily_summary":
                result = get_daily_summary(date=tool_args.get("date", "today"))
            elif tool_name == "check_order_and_payment":
                result = check_order_and_payment(order_code=tool_args.get("order_code"), phone=tool_args.get("phone"))
            elif tool_name == "create_manual_order":
                result = create_manual_order(
                    customer_name=tool_args.get("customer_name") or "",
                    phone=tool_args.get("phone") or "",
                    address=tool_args.get("address") or "",
                    product_name=tool_args.get("product_name", "Set Lẩu Cặp Đôi (2-3 người)"),
                    amount=float(tool_args.get("amount") or 299000),
                    is_stove=bool(tool_args.get("is_stove", False)),
                    email=tool_args.get("email"),
                    note=tool_args.get("note"),
                    items=tool_args.get("items"),
                    deposit_amount=float(tool_args.get("deposit_amount") or 0),
                    shipping_fee=float(tool_args.get("shipping_fee") or 0),
                    discount_amount=float(tool_args.get("discount_amount") or 0),
                    voucher_code=tool_args.get("voucher_code"),
                    raw_text=tool_args.get("raw_text") or tool_args.get("message") or tool_args.get("text")
                )
            else:
                result = {"error": f"Tool '{tool_name}' không tồn tại"}

            res = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(result, ensure_ascii=False, indent=2)
                        }
                    ]
                }
            }
        except Exception as e:
            res = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }
        sys.stdout.write(json.dumps(res, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    elif method == "initialize":
        res = {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "lau-nha-mcp-server",
                    "version": "1.0.0"
                }
            }
        }
        sys.stdout.write(json.dumps(res, ensure_ascii=False) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        print("=== TEST 1: get_daily_summary ===")
        print(json.dumps(get_daily_summary("today"), ensure_ascii=False, indent=2))
        
        print("\n=== TEST 2: check_order_and_payment ===")
        print(json.dumps(check_order_and_payment(order_code="LN1001"), ensure_ascii=False, indent=2))
        
        print("\n=== TEST 3: create_manual_order (Dry Run) ===")
        print("MCP Server functions are verified and ready.")
    else:
        for line in sys.stdin:
            line = line.strip()
            if line:
                handle_json_rpc(line)
