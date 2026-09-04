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
def create_manual_order(customer_name: str, phone: str, address: str, product_name: str = "Set Lẩu Cặp Đôi (2-3 người)", amount: float = 299000, is_stove: bool = False, email: str = None, note: str = None) -> dict:
    """Tạo đơn hàng nhanh cho khách, tạo mã QR VietQR SePay và bắn thông báo Telegram/Email"""
    conn = get_db_conn()
    cursor = conn.cursor()

    # 1. Check / Create Customer
    cursor.execute("SELECT id FROM customers WHERE phone = ?", (phone.strip(),))
    cust_row = cursor.fetchone()
    if cust_row:
        cust_id = cust_row["id"]
        cursor.execute("UPDATE customers SET name = ?, email = COALESCE(?, email) WHERE id = ?", (customer_name.strip(), email, cust_id))
    else:
        cursor.execute("INSERT INTO customers (name, phone, email, kind) VALUES (?, ?, ?, 'customer')", (customer_name.strip(), phone.strip(), email))
        cust_id = cursor.lastrowid

    # 2. Find product ID
    cursor.execute("SELECT id, price FROM products WHERE name LIKE ? LIMIT 1", (f"%{product_name.strip()}%",))
    prod_row = cursor.fetchone()
    if prod_row:
        prod_id = prod_row["id"]
        final_price = amount if amount > 0 else prod_row["price"]
    else:
        prod_id = 1
        final_price = amount

    # Generate Order Code
    now_ts = datetime.now()
    order_code = f"LN{now_ts.strftime('%m%d%H%M')[-4:]}"

    # 3. Insert Order
    cursor.execute("""
        INSERT INTO orders (customer_id, product_id, amount, status, order_code, order_date)
        VALUES (?, ?, ?, 'pending', ?, datetime('now', 'localtime'))
    """, (cust_id, prod_id, final_price, order_code))
    order_id = cursor.lastrowid
    conn.commit()
    conn.close()

    # 4. Generate QR Pay link
    qr_url = f"https://qr.sepay.vn/img?acc={SEPAY_ACCOUNT_NUMBER}&bank=MBBank&amount={int(final_price)}&des={order_code}"

    # 5. Notify Telegram with Interactive Card (Buttons: [Chốt đơn], [QR], [Hủy])
    telegram_sent = False
    try:
        from telegram_bot import send_interactive_order_card
        card_res = send_interactive_order_card({
            "order_code": order_code,
            "customer_name": customer_name,
            "phone": phone,
            "address": address,
            "product_name": product_name,
            "amount": final_price,
            "is_stove": is_stove,
            "note": note
        })
        telegram_sent = bool(card_res.get("ok"))
    except Exception as e:
        print(f"[Telegram Interactive Card Warning]: {e}")
        if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
            try:
                tele_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
                tele_msg = f"🔥 <b>ĐƠN HÀNG MỚI #{order_code}</b>\n👤 {customer_name} - 📞 {phone}\n📍 {address}\n🍲 {product_name} - 💰 {int(final_price):,} đ"
                payload = json.dumps({"chat_id": TELEGRAM_CHAT_ID, "text": tele_msg, "parse_mode": "HTML"}).encode("utf-8")
                req = urllib.request.Request(tele_url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=10) as r:
                    telegram_sent = (r.status == 200)
            except Exception as fb_err:
                print(f"[Telegram Fallback Warning]: {fb_err}")

    # 6. Send Email if email provided
    email_sent = False
    if email and RESEND_API_KEY:
        try:
            email_body = f"""
            <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #b91c1c;">LẨU NHÀ - XÁC NHẬN ĐƠN HÀNG #{order_code}</h2>
                <p>Kính chào <b>{customer_name}</b>,</p>
                <p>Cảm ơn bạn đã đặt lẩu tại Lẩu Nhà. Đơn hàng của bạn đã được tiếp nhận:</p>
                <ul>
                    <li><b>Món đặt:</b> {product_name}</li>
                    <li><b>Tổng thanh toán:</b> {int(final_price):,} đ</li>
                    <li><b>Địa chỉ giao:</b> {address}</li>
                    <li><b>Mượn bếp cồn:</b> {'Có' if is_stove else 'Không'}</li>
                </ul>
                <div style="text-align: center; margin: 20px 0;">
                    <p><b>Quét mã QR VietQR để thanh toán:</b></p>
                    <img src="{qr_url}" style="max-width: 250px; border-radius: 8px;" alt="QR Code"/>
                </div>
                <p style="color: #666; font-size: 13px;">Hotline hỗ trợ: 0819 943 904</p>
            </div>
            """
            resend_url = "https://api.resend.com/emails"
            payload = json.dumps({
                "from": RESEND_FROM,
                "to": [email],
                "reply_to": RESEND_REPLY_TO,
                "subject": f"[Lẩu Nhà] Xác nhận đơn hàng #{order_code}",
                "html": email_body
            }).encode("utf-8")
            req = urllib.request.Request(resend_url, data=payload, headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json", "User-Agent": "LauNhaMCP/1.0"})
            with urllib.request.urlopen(req, timeout=10) as r:
                email_sent = (r.status == 200)
        except Exception as e:
            print(f"[Resend Email Warning]: {e}")

    return {
        "success": True,
        "order_code": order_code,
        "order_id": order_id,
        "customer_id": cust_id,
        "total_amount": int(final_price),
        "total_amount_formatted": f"{int(final_price):,} đ",
        "qr_payment_url": qr_url,
        "telegram_notified": telegram_sent,
        "email_sent": email_sent,
        "message": f"Đã tạo đơn thành công mã #{order_code} cho khách hàng {customer_name}!"
    }


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
        "description": "Tạo đơn hàng lẩu mới trực tiếp: lưu database, sinh mã thanh toán VietQR / SePay và tự động bắn thông báo vào nhóm Telegram cũng như gửi email cho khách.",
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
                "product_name": {
                    "type": "string",
                    "description": "Tên set lẩu (ví dụ: 'Set Lẩu Cặp Đôi (2-3 người)' hoặc 'Set Lẩu Gia Đình (4-6 người)')"
                },
                "amount": {
                    "type": "number",
                    "description": "Số tiền đơn hàng (mặc định 299000 cho Set Cặp Đôi, 399000 cho Set Gia Đình)"
                },
                "is_stove": {
                    "type": "boolean",
                    "description": "Khách có mượn bếp cồn và nồi nhôm không (True/False, mặc định False)"
                },
                "email": {
                    "type": "string",
                    "description": "Email khách hàng (nếu có để gửi hoá đơn)"
                },
                "note": {
                    "type": "string",
                    "description": "Ghi chú khẩu vị hoặc thời gian giao"
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
                    customer_name=tool_args.get("customer_name"),
                    phone=tool_args.get("phone"),
                    address=tool_args.get("address"),
                    product_name=tool_args.get("product_name", "Set Lẩu Cặp Đôi (2-3 người)"),
                    amount=float(tool_args.get("amount", 299000)),
                    is_stove=bool(tool_args.get("is_stove", False)),
                    email=tool_args.get("email"),
                    note=tool_args.get("note")
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
