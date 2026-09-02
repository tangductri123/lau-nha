import os
import sqlite3
import sys
import json
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from pydantic import BaseModel
from email_service import (
    init_email_tables, 
    enroll_email_sequence, 
    enroll_lead_email_sequence,
    email_sequence_cron_worker, 
    send_resend_email, 
    send_order_confirmation_email,
    send_survey_welcome_email,
    notify_telegram_lead
)

# Ensure UTF-8 output on Windows
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

DB_PATHS = [
    os.path.join(BASE_DIR, "My-Brain", "brain.db"),
    r"d:\BO\My-Brain\brain.db",
]

def get_db_path():
    for p in DB_PATHS:
        if os.path.exists(p):
            return p
    return DB_PATHS[0]

def init_db():
    for path in DB_PATHS:
        try:
            if not os.path.exists(os.path.dirname(path)):
                continue
            conn = sqlite3.connect(path, timeout=1)
            conn.execute("PRAGMA foreign_keys = ON")
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL CHECK(type IN ('physical', 'digital', 'service')),
                    price REAL NOT NULL CHECK(price >= 0),
                    description TEXT,
                    stock INTEGER CHECK(type != 'physical' OR stock IS NOT NULL),
                    created_at TEXT DEFAULT (datetime('now', 'localtime'))
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    phone TEXT,
                    zalo TEXT,
                    email TEXT,
                    kind TEXT DEFAULT 'customer',
                    registered_at TEXT DEFAULT (datetime('now', 'localtime'))
                )
            """)
            try:
                cursor.execute("ALTER TABLE customers ADD COLUMN email TEXT")
            except Exception:
                pass
            try:
                cursor.execute("ALTER TABLE customers ADD COLUMN kind TEXT DEFAULT 'customer'")
            except Exception:
                pass

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS leads (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER,
                    name TEXT NOT NULL,
                    phone TEXT,
                    email TEXT,
                    eat_with TEXT,
                    frequency TEXT,
                    main_concern TEXT,
                    interested_in_service TEXT,
                    raw_answers TEXT,
                    discount_code TEXT DEFAULT 'LAUNHA50K',
                    code_used INTEGER DEFAULT 0,
                    notes TEXT,
                    created_at TEXT DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at)")

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    amount REAL NOT NULL CHECK(amount >= 0),
                    status TEXT NOT NULL DEFAULT 'pending',
                    order_code TEXT,
                    order_date TEXT DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
                )
            """)
            try:
                cursor.execute("ALTER TABLE orders ADD COLUMN order_code TEXT")
            except Exception:
                pass
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[DB Init Path Warning] {path}: {e}")

# Auto-initialize DB on module load
try:
    init_db()
except Exception as err:
    print(f"[DB Init Warning]: {err}")

def get_conn():
    path = get_db_path()
    conn = sqlite3.connect(path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def sync_all_dbs(sql_query, params=(), exclude_path=None):
    """Thực thi câu lệnh ghi trên các file brain.db phụ để đồng bộ."""
    main_path = os.path.abspath(exclude_path or get_db_path())
    for path in DB_PATHS:
        if os.path.abspath(path) == main_path:
            continue
        if os.path.exists(os.path.dirname(path)):
            try:
                conn = sqlite3.connect(path, timeout=30.0)
                conn.execute("PRAGMA journal_mode = WAL")
                conn.execute("PRAGMA busy_timeout = 30000")
                conn.execute("PRAGMA foreign_keys = ON")
                conn.execute(sql_query, params)
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"[Sync Warning] {path}: {e}")

app = FastAPI(title="Brain DB Admin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    try:
        init_email_tables()
        asyncio.create_task(email_sequence_cron_worker())
    except Exception as e:
        print(f"[Startup Warning]: {e}")

@app.get("/health")
def health_check():
    return {"status": "ok", "time": datetime.now().isoformat()}

# ==================== PYDANTIC MODELS ====================

class ProductCreate(BaseModel):
    name: str
    type: str  # physical, digital, service
    price: float
    description: Optional[str] = None
    stock: Optional[int] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    stock: Optional[int] = None

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    zalo: Optional[str] = None
    email: Optional[str] = None
    kind: Optional[str] = "customer"

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    zalo: Optional[str] = None
    email: Optional[str] = None
    kind: Optional[str] = None

class LeadCreatePayload(BaseModel):
    name: str
    phone: str
    email: str
    eat_with: Optional[str] = None
    frequency: Optional[str] = None
    main_concern: Optional[str] = None
    interested_in_service: Optional[str] = None
    raw_answers: Optional[Dict[str, Any]] = None
    discount_code: Optional[str] = "LAUNHA50K"
    notes: Optional[str] = None

class LeadUpdatePayload(BaseModel):
    code_used: Optional[int] = None
    notes: Optional[str] = None
    discount_code: Optional[str] = None

class OrderItem(BaseModel):
    product_id: int
    quantity: Optional[int] = 1
    amount: Optional[float] = None

class OrderCreate(BaseModel):
    customer_id: int
    product_id: Optional[int] = None
    amount: Optional[float] = None
    status: Optional[str] = "pending"
    quantity: Optional[int] = 1
    order_code: Optional[str] = None
    items: Optional[List[OrderItem]] = None

class OrderUpdate(BaseModel):
    customer_id: Optional[int] = None
    product_id: Optional[int] = None
    amount: Optional[float] = None
    status: Optional[str] = None


# ==================== PRODUCTS API ====================

@app.get("/api/products")
def list_products():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM products ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/products")
def create_product(p: ProductCreate):
    if p.type not in ["physical", "digital", "service"]:
        raise HTTPException(status_code=400, detail="Loại sản phẩm phải là physical, digital, hoặc service")
    if p.price < 0:
        raise HTTPException(status_code=400, detail="Giá không thể âm")
    if p.type == "physical" and p.stock is None:
        raise HTTPException(status_code=400, detail="Sản phẩm vật lý bắt buộc phải có số lượng tồn kho")
    if p.type in ["digital", "service"]:
        p.stock = None

    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO products (name, type, price, description, stock) VALUES (?, ?, ?, ?, ?)",
        (p.name.strip(), p.type, p.price, p.description.strip() if p.description else None, p.stock),
    )
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    # Sync other databases
    sync_all_dbs(
        "INSERT OR REPLACE INTO products (id, name, type, price, description, stock) VALUES (?, ?, ?, ?, ?, ?)",
        (new_id, p.name.strip(), p.type, p.price, p.description.strip() if p.description else None, p.stock),
    )

    return {"success": True, "id": new_id, "message": "Thêm sản phẩm thành công"}

@app.put("/api/products/{product_id}")
def update_product(product_id: int, p: ProductUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")

    name = p.name.strip() if p.name is not None else existing["name"]
    p_type = p.type if p.type is not None else existing["type"]
    price = p.price if p.price is not None else existing["price"]
    desc = p.description if p.description is not None else existing["description"]
    
    if p_type not in ["physical", "digital", "service"]:
        raise HTTPException(status_code=400, detail="Loại sản phẩm không hợp lệ")

    if p_type in ["digital", "service"]:
        stock = None
    else:
        stock = p.stock if p.stock is not None else existing["stock"]
        if stock is None:
            raise HTTPException(status_code=400, detail="Sản phẩm vật lý bắt buộc có tồn kho")

    conn.execute(
        "UPDATE products SET name = ?, type = ?, price = ?, description = ?, stock = ? WHERE id = ?",
        (name, p_type, price, desc, stock, product_id)
    )
    conn.commit()
    conn.close()

    sync_all_dbs(
        "UPDATE products SET name = ?, type = ?, price = ?, description = ?, stock = ? WHERE id = ?",
        (name, p_type, price, desc, stock, product_id)
    )

    return {"success": True, "message": "Cập nhật sản phẩm thành công"}

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")

    # Kiểm tra xem có đơn hàng liên quan không
    order_count = conn.execute("SELECT COUNT(*) FROM orders WHERE product_id = ?", (product_id,)).fetchone()[0]
    if order_count > 0:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Không thể xóa vì có {order_count} đơn hàng liên quan đến sản phẩm này")

    conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()

    sync_all_dbs("DELETE FROM products WHERE id = ?", (product_id,))
    return {"success": True, "message": "Đã xóa sản phẩm"}


# ==================== VALIDATION HELPERS ====================

import re

def validate_vietnamese_phone(phone: str) -> bool:
    if not phone:
        return False
    clean = re.sub(r"[\s\-\.\(\)]", "", str(phone).strip())
    return bool(re.match(r"^(0|\+84)(3|5|7|8|9)\d{8}$", clean))

def validate_email_format(email: str) -> bool:
    if not email:
        return False
    return bool(re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", str(email).strip()))


# ==================== CUSTOMERS API ====================

@app.get("/api/customers")
def list_customers():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM customers ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/customers")
def create_customer(c: CustomerCreate):
    name = (c.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tên khách hàng không được để trống")

    phone = (c.phone or "").strip()
    if phone and not validate_vietnamese_phone(phone):
        raise HTTPException(status_code=400, detail="Số điện thoại không đúng định dạng Việt Nam (10 số di động)")

    email = (c.email or "").strip()
    if email and not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Địa chỉ email không đúng định dạng (ví dụ: email@gmail.com)")

    kind = c.kind.strip() if c.kind else "customer"
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO customers (name, phone, zalo, email, kind) VALUES (?, ?, ?, ?, ?)",
        (name, phone or None, c.zalo.strip() if c.zalo else None, email or None, kind)
    )
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    sync_all_dbs(
        "INSERT OR REPLACE INTO customers (id, name, phone, zalo, email, kind) VALUES (?, ?, ?, ?, ?, ?)",
        (new_id, name, phone or None, c.zalo.strip() if c.zalo else None, email or None, kind)
    )

    return {"success": True, "id": new_id, "message": "Thêm khách hàng thành công"}

@app.put("/api/customers/{customer_id}")
def update_customer(customer_id: int, c: CustomerUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

    name = c.name.strip() if c.name is not None else existing["name"]
    if not name:
        conn.close()
        raise HTTPException(status_code=400, detail="Tên khách hàng không được để trống")

    phone = c.phone.strip() if c.phone is not None else existing["phone"]
    if phone and not validate_vietnamese_phone(phone):
        conn.close()
        raise HTTPException(status_code=400, detail="Số điện thoại không đúng định dạng Việt Nam (10 số di động)")

    email = c.email.strip() if c.email is not None else (existing["email"] if "email" in existing.keys() else None)
    if email and not validate_email_format(email):
        conn.close()
        raise HTTPException(status_code=400, detail="Địa chỉ email không đúng định dạng (ví dụ: email@gmail.com)")

    zalo = c.zalo.strip() if c.zalo is not None else existing["zalo"]
    kind = c.kind.strip() if c.kind is not None else (existing["kind"] if "kind" in existing.keys() else "customer")

    conn.execute(
        "UPDATE customers SET name = ?, phone = ?, zalo = ?, email = ?, kind = ? WHERE id = ?",
        (name, phone, zalo, email, kind, customer_id)
    )
    conn.commit()
    conn.close()

    sync_all_dbs(
        "UPDATE customers SET name = ?, phone = ?, zalo = ?, email = ?, kind = ? WHERE id = ?",
        (name, phone, zalo, email, kind, customer_id)
    )

    return {"success": True, "message": "Cập nhật thông tin khách hàng thành công"}

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

    conn.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    conn.commit()
    conn.close()

    sync_all_dbs("DELETE FROM customers WHERE id = ?", (customer_id,))
    return {"success": True, "message": "Đã xóa khách hàng"}


# ==================== ORDERS API ====================

@app.get("/api/orders")
def list_orders():
    conn = get_conn()
    query = """
        SELECT 
            o.id, 
            o.order_code,
            o.customer_id, 
            c.name AS customer_name, 
            c.phone AS customer_phone,
            c.zalo AS customer_zalo,
            c.email AS customer_email,
            o.product_id, 
            p.name AS product_name, 
            p.type AS product_type,
            p.stock AS current_stock,
            p.price AS product_price,
            o.amount, 
            o.status, 
            o.order_date
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN products p ON o.product_id = p.id
        ORDER BY o.id DESC
    """
    rows = conn.execute(query).fetchall()
    conn.close()

    grouped = {}
    for r_obj in rows:
        r = dict(r_obj)
        code = r.get("order_code")
        if code and code.strip():
            group_key = f"code_{code.strip().upper()}"
        else:
            group_key = f"id_{r['id']}"

        if group_key not in grouped:
            display_code = code.strip().upper() if (code and code.strip()) else f"LN{r['id']:04d}"
            grouped[group_key] = {
                "id": r["id"],
                "order_code": display_code,
                "raw_order_code": code,
                "customer_id": r["customer_id"],
                "customer_name": r["customer_name"],
                "customer_phone": r["customer_phone"],
                "customer_zalo": r["customer_zalo"],
                "customer_email": r["customer_email"],
                "status": r["status"],
                "order_date": r["order_date"],
                "total_amount": 0.0,
                "amount": 0.0,
                "order_ids": [],
                "items": []
            }

        grouped[group_key]["order_ids"].append(r["id"])
        item_amt = float(r["amount"] or 0)
        grouped[group_key]["total_amount"] += item_amt
        grouped[group_key]["amount"] += item_amt

        if r["order_date"] and (not grouped[group_key]["order_date"] or r["order_date"] > grouped[group_key]["order_date"]):
            grouped[group_key]["order_date"] = r["order_date"]

        grouped[group_key]["items"].append({
            "order_item_id": r["id"],
            "product_id": r["product_id"],
            "product_name": r["product_name"] or f"Sản phẩm #{r['product_id']}",
            "product_type": r["product_type"],
            "amount": item_amt,
            "product_price": float(r["product_price"] or 0)
        })

    result = []
    for grp in grouped.values():
        item_names = [it["product_name"] for it in grp["items"]]
        grp["product_name"] = ", ".join(item_names)
        grp["product_type"] = grp["items"][0]["product_type"] if grp["items"] else "physical"
        grp["product_id"] = grp["items"][0]["product_id"] if grp["items"] else None
        grp["item_count"] = len(grp["items"])
        result.append(grp)

    return result

@app.post("/api/orders")
def create_order(o: OrderCreate):
    conn = get_conn()
    
    # 1. Kiểm tra khách hàng
    customer = conn.execute("SELECT * FROM customers WHERE id = ?", (o.customer_id,)).fetchone()
    if not customer:
        conn.close()
        raise HTTPException(status_code=400, detail="Khách hàng không tồn tại")

    # Chuẩn hóa danh sách items
    items_to_process = []
    if o.items and len(o.items) > 0:
        items_to_process = o.items
    elif o.product_id is not None:
        items_to_process = [OrderItem(product_id=o.product_id, quantity=o.quantity or 1, amount=o.amount)]
    else:
        conn.close()
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất 1 sản phẩm")

    cursor = conn.cursor()
    created_orders = []
    deductions = []
    has_physical_stock_deducted = False

    # Tạo mã đơn hàng chung cho toàn bộ món trong HĐ
    import random
    order_code = (o.order_code or "").strip().upper()
    if not order_code:
        order_code = f"LN{random.randint(1000, 9999)}"

    try:
        for item in items_to_process:
            pid = item.product_id
            qty = max(1, item.quantity or 1)
            
            product = conn.execute("SELECT * FROM products WHERE id = ?", (pid,)).fetchone()
            if not product:
                raise HTTPException(status_code=400, detail=f"Sản phẩm ID {pid} không tồn tại")

            amount = item.amount if (item.amount is not None and item.amount >= 0) else (product["price"] * qty)

            # Xử lý tồn kho nếu là physical
            if product["type"] == "physical":
                curr_stock = product["stock"] if product["stock"] is not None else 0
                if curr_stock < qty:
                    raise HTTPException(status_code=400, detail=f"Sản phẩm '{product['name']}' chỉ còn tồn kho {curr_stock}, không đủ để tạo đơn ({qty})")
                
                new_stock = curr_stock - qty
                conn.execute("UPDATE products SET stock = ? WHERE id = ?", (new_stock, pid))
                deductions.append((pid, new_stock))
                has_physical_stock_deducted = True

            cursor.execute(
                "INSERT INTO orders (customer_id, product_id, amount, status, order_code) VALUES (?, ?, ?, ?, ?)",
                (o.customer_id, pid, amount, o.status or "pending", order_code)
            )
            order_id = cursor.lastrowid
            created_orders.append({
                "id": order_id,
                "product_name": product["name"],
                "amount": amount,
                "quantity": qty
            })

            # Sync order to other databases
            sync_all_dbs(
                "INSERT OR REPLACE INTO orders (id, customer_id, product_id, amount, status, order_code) VALUES (?, ?, ?, ?, ?, ?)",
                (order_id, o.customer_id, pid, amount, o.status or "pending", order_code)
            )

        conn.commit()
    except Exception as err:
        conn.rollback()
        conn.close()
        if isinstance(err, HTTPException):
            raise err
        raise HTTPException(status_code=500, detail=str(err))

    conn.close()

    # Sync inventory updates
    for pid, new_stock in deductions:
        sync_all_dbs("UPDATE products SET stock = ? WHERE id = ?", (new_stock, pid))

    total_amount = sum(x["amount"] for x in created_orders)

    # Tự động gửi email xác nhận đơn hàng qua Resend nếu khách hàng có email
    email_status = None
    cust_email = (customer["email"] or "").strip()
    if cust_email:
        try:
            ok, res_info = send_order_confirmation_email(
                customer_name=customer["name"],
                customer_email=cust_email,
                items=created_orders,
                total_amount=total_amount,
                order_code=order_code
            )
            email_status = {"sent": ok, "info": res_info}
            print(f"[Order Email] Đã tự động gửi email xác nhận đơn cho {cust_email} (Thành công: {ok})")
        except Exception as email_err:
            print(f"[Order Email Error]: {email_err}")
            email_status = {"sent": False, "error": str(email_err)}

    msg = f"Đã tạo thành công đơn hàng #{order_code} gồm {len(created_orders)} món (Tổng: {total_amount:,.0f}đ)"
    if email_status and email_status.get("sent"):
        msg += f" và đã gửi email xác nhận tới {cust_email}!"

    return {
        "success": True, 
        "order_code": order_code,
        "stock_deducted": has_physical_stock_deducted,
        "message": msg,
        "orders": created_orders,
        "total_amount": total_amount,
        "email_status": email_status
    }

@app.put("/api/orders/{order_id}")
def update_order(order_id: int, o: OrderUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    order_code = existing["order_code"]
    status = o.status if o.status is not None else existing["status"]

    if order_code and str(order_code).strip():
        code_val = str(order_code).strip()
        conn.execute("UPDATE orders SET status = ? WHERE UPPER(order_code) = ?", (status, code_val.upper()))
        sync_all_dbs("UPDATE orders SET status = ? WHERE UPPER(order_code) = ?", (status, code_val.upper()))
    else:
        cust_id = o.customer_id if o.customer_id is not None else existing["customer_id"]
        prod_id = o.product_id if o.product_id is not None else existing["product_id"]
        amount = o.amount if o.amount is not None else existing["amount"]
        conn.execute(
            "UPDATE orders SET customer_id = ?, product_id = ?, amount = ?, status = ? WHERE id = ?",
            (cust_id, prod_id, amount, status, order_id)
        )
        sync_all_dbs(
            "UPDATE orders SET customer_id = ?, product_id = ?, amount = ?, status = ? WHERE id = ?",
            (cust_id, prod_id, amount, status, order_id)
        )

    conn.commit()
    conn.close()
    return {"success": True, "message": "Cập nhật đơn hàng thành công"}

@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    order_code = existing["order_code"]
    if order_code and str(order_code).strip():
        code_val = str(order_code).strip()
        conn.execute("DELETE FROM orders WHERE UPPER(order_code) = ?", (code_val.upper(),))
        sync_all_dbs("DELETE FROM orders WHERE UPPER(order_code) = ?", (code_val.upper(),))
    else:
        conn.execute("DELETE FROM orders WHERE id = ?", (order_id,))
        sync_all_dbs("DELETE FROM orders WHERE id = ?", (order_id,))

    conn.commit()
    conn.close()
    return {"success": True, "message": "Đã xóa toàn bộ đơn hàng"}


# ==================== LANDING PAGE ORDER ENDPOINT ====================

class SendOrderPayload(BaseModel):
    cust_name: Optional[str] = None
    cust_phone: Optional[str] = None
    cust_email: Optional[str] = None
    cust_address: Optional[str] = None
    order_code: Optional[str] = None
    items: Optional[List[dict]] = None
    stove_included: Optional[bool] = False

@app.post("/api/send-order")
@app.post("/send-order")
def handle_landing_send_order(data: SendOrderPayload):
    name = (data.cust_name or "").strip()
    phone = (data.cust_phone or "").strip()
    email = (data.cust_email or "").strip()
    address = (data.cust_address or "").strip()
    order_code = (data.order_code or "").strip()
    items = data.items or []

    if not name or not phone:
        raise HTTPException(status_code=400, detail="Thiếu thông tin họ tên hoặc số điện thoại nhận hàng")

    if not validate_vietnamese_phone(phone):
        raise HTTPException(status_code=400, detail="Số điện thoại nhận hàng không hợp lệ (yêu cầu 10 số di động Việt Nam)")

    if email and not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Địa chỉ email không đúng định dạng (ví dụ: email@gmail.com)")

    conn = get_conn()
    cursor = conn.cursor()

    # 1. Tìm hoặc tạo mới khách hàng trong bảng customers
    cust_row = conn.execute("SELECT id FROM customers WHERE phone = ? LIMIT 1", (phone,)).fetchone()
    if cust_row:
        customer_id = cust_row["id"]
        # Cập nhật tên và email nếu có
        conn.execute("UPDATE customers SET name = ?, email = COALESCE(NULLIF(?, ''), email) WHERE id = ?", (name, email or None, customer_id))
        sync_all_dbs("UPDATE customers SET name = ?, email = COALESCE(NULLIF(?, ''), email) WHERE id = ?", (name, email or None, customer_id))
    else:
        cursor.execute(
            "INSERT INTO customers (name, phone, zalo, email) VALUES (?, ?, ?, ?)",
            (name, phone, phone, email or None)
        )
        customer_id = cursor.lastrowid
        sync_all_dbs(
            "INSERT OR REPLACE INTO customers (id, name, phone, zalo, email) VALUES (?, ?, ?, ?, ?)",
            (customer_id, name, phone, phone, email or None)
        )

    # 2. Xử lý từng món trong đơn hàng
    created_orders = []
    for item in items:
        item_name = str(item.get("name", "Sản phẩm")).strip()
        item_qty = max(1, int(item.get("qty", 1)))
        item_price = float(item.get("price", 0))
        item_total = item_price * item_qty

        # Tìm sản phẩm trong DB
        prod_row = conn.execute(
            "SELECT * FROM products WHERE name = ? OR name LIKE ? LIMIT 1",
            (item_name, f"%{item_name}%")
        ).fetchone()

        if prod_row:
            product_id = prod_row["id"]
            prod_type = prod_row["type"]
            curr_stock = prod_row["stock"]
        else:
            # Nếu sản phẩm chưa có trong danh mục, tự tạo sản phẩm vật lý
            cursor.execute(
                "INSERT INTO products (name, type, price, description, stock) VALUES (?, 'physical', ?, 'Thêm tự động từ đơn đặt hàng trên website', 100)",
                (item_name, item_price)
            )
            product_id = cursor.lastrowid
            prod_type = "physical"
            curr_stock = 100
            sync_all_dbs(
                "INSERT OR REPLACE INTO products (id, name, type, price, description, stock) VALUES (?, ?, 'physical', ?, 'Thêm tự động từ đơn đặt hàng trên website', 100)",
                (product_id, item_name, item_price)
            )

        # Trừ tồn kho nếu là sản phẩm physical
        if prod_type == "physical" and curr_stock is not None:
            new_stock = max(0, curr_stock - item_qty)
            conn.execute("UPDATE products SET stock = ? WHERE id = ?", (new_stock, product_id))
            sync_all_dbs("UPDATE products SET stock = ? WHERE id = ?", (new_stock, product_id))

        # Lưu đơn hàng vào bảng orders
        cursor.execute(
            "INSERT INTO orders (customer_id, product_id, amount, status, order_code) VALUES (?, ?, ?, 'pending', ?)",
            (customer_id, product_id, item_total, order_code)
        )
        ord_id = cursor.lastrowid
        sync_all_dbs(
            "INSERT OR REPLACE INTO orders (id, customer_id, product_id, amount, status, order_code) VALUES (?, ?, ?, ?, ?, ?)",
            (ord_id, customer_id, product_id, item_total, 'pending', order_code)
        )
        created_orders.append(ord_id)

    conn.commit()
    conn.close()

    # 1. Tự động gửi email xác nhận đơn hàng (Order Confirmation) cho khách và quản lý
    email_status = None
    try:
        raw_subtotal = sum(float(it.get("price", 0)) * max(1, int(it.get("qty", 1))) for it in items)
        discount = 50000 if raw_subtotal > 0 else 0
        stove_fee = 50000 if data.stove_included and raw_subtotal < 399000 else 0
        final_total = max(0, raw_subtotal + stove_fee - discount)

        ok, res_info = send_order_confirmation_email(
            customer_name=name,
            customer_email=email,
            items=items,
            total_amount=final_total,
            order_code=order_code
        )
        email_status = {"sent": ok, "info": res_info}
        print(f"[Order Confirmation Email] Kết quả gửi email đơn #{order_code}: {ok} ({res_info})")
    except Exception as e:
        print(f"[Order Confirmation Email Error]: {e}")
        email_status = {"sent": False, "error": str(e)}

    # 2. Tự động kích hoạt chuỗi Email Sequence qua Resend (nếu khách có email)
    seq_result = None
    if email and "@" in email:
        try:
            seq_result = enroll_email_sequence(customer_id, name, email)
        except Exception as e:
            print(f"[Email Sequence Error]: {e}")

    return {
        "success": True,
        "order_code": order_code,
        "customer_id": customer_id,
        "orders_created": created_orders,
        "order_email": email_status,
        "email_sequence": seq_result,
        "message": "Đã lưu đơn hàng và gửi email xác nhận thành công"
    }


# ==================== LEADS & SURVEY MANAGEMENT ENDPOINTS ====================

@app.get("/api/leads")
def list_leads():
    conn = get_conn()
    query = """
        SELECT 
            l.id,
            l.customer_id,
            l.name,
            l.phone,
            l.email,
            l.eat_with,
            l.frequency,
            l.main_concern,
            l.interested_in_service,
            l.raw_answers,
            l.discount_code,
            l.code_used,
            l.notes,
            l.created_at,
            c.kind AS customer_kind
        FROM leads l
        LEFT JOIN customers c ON l.customer_id = c.id
        ORDER BY l.id DESC
    """
    rows = conn.execute(query).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/leads")
@app.post("/api/survey")
@app.post("/api/waitlist")
def handle_survey_submission(data: LeadCreatePayload):
    name = (data.name or "").strip()
    phone = (data.phone or "").strip()
    email = (data.email or "").strip()
    discount_code = (data.discount_code or "LAUNHA50K").strip().upper()
    eat_with = (data.eat_with or "").strip() or None
    frequency = (data.frequency or "").strip() or None
    main_concern = (data.main_concern or "").strip() or None
    interested = (data.interested_in_service or "").strip() or None
    notes = (data.notes or "").strip() or None

    if not name:
        raise HTTPException(status_code=400, detail="Họ và tên không được để trống")
    if not email or not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Vui lòng nhập địa chỉ email hợp lệ (ví dụ: hoten@gmail.com) để nhận mã ưu đãi")
    if phone and not validate_vietnamese_phone(phone):
        raise HTTPException(status_code=400, detail="Số điện thoại không đúng định dạng Việt Nam (10 số di động)")

    raw_json = json.dumps(data.raw_answers, ensure_ascii=False) if data.raw_answers else None

    conn = get_conn()
    cursor = conn.cursor()

    # 1. Trích xuất thông tin khách hàng và lưu vào bảng customers trong brain.db (với kind = 'lead')
    cust_row = None
    if phone:
        cust_row = conn.execute("SELECT * FROM customers WHERE phone = ? LIMIT 1", (phone,)).fetchone()
    if not cust_row and email:
        cust_row = conn.execute("SELECT * FROM customers WHERE email = ? LIMIT 1", (email,)).fetchone()

    if cust_row:
        customer_id = cust_row["id"]
        # Cập nhật thông tin khách hàng, gán kind = 'lead' nếu chưa có đơn hàng hoặc cập nhật theo khảo sát
        conn.execute(
            "UPDATE customers SET name = ?, phone = COALESCE(NULLIF(?, ''), phone), email = ?, kind = 'lead' WHERE id = ?",
            (name, phone, email, customer_id)
        )
        sync_all_dbs(
            "UPDATE customers SET name = ?, phone = COALESCE(NULLIF(?, ''), phone), email = ?, kind = 'lead' WHERE id = ?",
            (name, phone, email, customer_id)
        )
    else:
        cursor.execute(
            "INSERT INTO customers (name, phone, zalo, email, kind) VALUES (?, ?, ?, ?, 'lead')",
            (name, phone or None, phone or None, email)
        )
        customer_id = cursor.lastrowid
        sync_all_dbs(
            "INSERT OR REPLACE INTO customers (id, name, phone, zalo, email, kind) VALUES (?, ?, ?, ?, ?, 'lead')",
            (customer_id, name, phone or None, phone or None, email)
        )

    # 2. Lưu thông tin câu trả lời khảo sát và mã code vào bảng leads
    cursor.execute("""
        INSERT INTO leads 
        (customer_id, name, phone, email, eat_with, frequency, main_concern, interested_in_service, raw_answers, discount_code, code_used, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    """, (customer_id, name, phone or None, email, eat_with, frequency, main_concern, interested, raw_json, discount_code, notes))
    lead_id = cursor.lastrowid

    sync_all_dbs("""
        INSERT OR REPLACE INTO leads 
        (id, customer_id, name, phone, email, eat_with, frequency, main_concern, interested_in_service, raw_answers, discount_code, code_used, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    """, (lead_id, customer_id, name, phone or None, email, eat_with, frequency, main_concern, interested, raw_json, discount_code, notes))

    conn.commit()
    conn.close()

    # 3. Tự động đưa Lead vào Chuỗi 3 Email Tự Động (Resend)
    # - Email 1 (Ngay lập tức): Chào mừng + Voucher 50k + 2 nút Zalo/Chatbot
    # - Email 2 (+2 ngày): Insight nước cốt 12h
    # - Email 3 (+3 ngày): Tiệc lẩu tại gia / chốt sale
    seq_result = None
    try:
        seq_result = enroll_lead_email_sequence(
            customer_id=customer_id,
            name=name,
            email=email,
            discount_code=discount_code
        )
        print(f"[Lead Email Sequence] Đã ghi nhận chuỗi email cho lead {email}: {seq_result.get('message')}")
    except Exception as em_err:
        print(f"[Lead Email Sequence Error]: {em_err}")
        seq_result = {"success": False, "error": str(em_err)}

    # 4. Gửi thông báo Lead mới về nhóm Telegram
    tele_status = None
    try:
        lead_dict = {
            "name": name,
            "phone": phone or "Chưa điền",
            "email": email,
            "discount_code": discount_code,
            "eat_with": eat_with or "Không chọn",
            "frequency": frequency or "Không chọn",
            "main_concern": main_concern or "Không chọn",
            "interested_in_service": interested or "Không chọn"
        }
        tele_ok, tele_msg = notify_telegram_lead(lead_dict)
        tele_status = {"sent": tele_ok, "info": tele_msg}
        print(f"[Telegram Lead] Đã gửi thông báo Lead khảo sát về Telegram (Thành công: {tele_ok})")
    except Exception as tele_err:
        print(f"[Telegram Lead Error]: {tele_err}")
        tele_status = {"sent": False, "error": str(tele_err)}

    return {
        "success": True,
        "lead_id": lead_id,
        "customer_id": customer_id,
        "discount_code": discount_code,
        "email_sequence": seq_result,
        "telegram_status": tele_status,
        "message": f"Cảm ơn bạn {name}! Mã ưu đãi {discount_code} đã được gửi đến email {email}."
    }

@app.put("/api/leads/{lead_id}/toggle-code-used")
def toggle_lead_code_used(lead_id: int):
    conn = get_conn()
    lead = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
    if not lead:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy lead này")

    new_state = 0 if (lead["code_used"] == 1) else 1
    conn.execute("UPDATE leads SET code_used = ? WHERE id = ?", (new_state, lead_id))
    conn.commit()
    conn.close()

    sync_all_dbs("UPDATE leads SET code_used = ? WHERE id = ?", (new_state, lead_id))
    return {
        "success": True,
        "lead_id": lead_id,
        "code_used": new_state,
        "message": f"Đã chuyển trạng thái mã ưu đãi sang {'ĐÃ DÙNG' if new_state == 1 else 'CHƯA DÙNG'}"
    }

@app.put("/api/leads/{lead_id}")
def update_lead(lead_id: int, data: LeadUpdatePayload):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy lead này")

    code_used = data.code_used if data.code_used is not None else existing["code_used"]
    discount_code = data.discount_code.strip() if data.discount_code is not None else existing["discount_code"]
    notes = data.notes.strip() if data.notes is not None else existing["notes"]

    conn.execute(
        "UPDATE leads SET code_used = ?, discount_code = ?, notes = ? WHERE id = ?",
        (code_used, discount_code, notes, lead_id)
    )
    conn.commit()
    conn.close()

    sync_all_dbs(
        "UPDATE leads SET code_used = ?, discount_code = ?, notes = ? WHERE id = ?",
        (code_used, discount_code, notes, lead_id)
    )
    return {"success": True, "message": "Cập nhật lead thành công"}

@app.delete("/api/leads/{lead_id}")
def delete_lead(lead_id: int):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy lead")

    conn.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
    conn.commit()
    conn.close()

    sync_all_dbs("DELETE FROM leads WHERE id = ?", (lead_id,))
    return {"success": True, "message": "Đã xóa lead thành công"}


# ==================== EMAIL SEQUENCE MANAGEMENT ENDPOINTS ====================

@app.get("/api/email-sequences")
def list_email_sequences():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM email_sequences ORDER BY id DESC LIMIT 100").fetchall()
    conn.close()
    return [dict(r) for r in rows]

class TestEmailSeqPayload(BaseModel):
    name: Optional[str] = "Khách Hàng Test"
    email: str

@app.post("/api/test-email-sequence")
def trigger_test_email_sequence(p: TestEmailSeqPayload):
    email = (p.email or "").strip()
    name = (p.name or "Khách Hàng Test").strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Email không hợp lệ")

    res = enroll_email_sequence(0, name, email)
    return res


# ==================== AUTOMATIC PAYMENT STATUS UPDATE ====================

class MarkPaidPayload(BaseModel):
    order_code: Optional[str] = None
    transaction_id: Optional[str] = None
    amount_in: Optional[float] = None

@app.post("/api/orders/mark-paid")
def mark_order_paid(p: MarkPaidPayload):
    code = (p.order_code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Thiếu mã đơn hàng")

    conn = get_conn()
    cursor = conn.cursor()
    
    # Tìm và cập nhật tất cả các món thuộc mã đơn này sang 'paid'
    cursor.execute("UPDATE orders SET status = 'paid' WHERE UPPER(order_code) = ? OR UPPER(order_code) LIKE ?", (code, f"%{code}%"))
    updated = cursor.rowcount
    conn.commit()
    conn.close()

    sync_all_dbs("UPDATE orders SET status = 'paid' WHERE UPPER(order_code) = ? OR UPPER(order_code) LIKE ?", (code, f"%{code}%"))
    print(f"[Payment Notification] Đơn hàng #{code} đã được tự động cập nhật sang 'paid' ({updated} món)!")

    return {
        "success": True,
        "order_code": code,
        "updated_items": updated,
        "message": f"Đã tự động chuyển trạng thái đơn #{code} sang 'Đã thanh toán' (paid)"
    }

@app.post("/api/payment-webhook")
def handle_payment_webhook(data: dict):
    """Webhook nhận thông báo giao dịch từ cổng thanh toán SePay/VietQR."""
    content = str(data.get("content") or data.get("transaction_content") or "").upper()
    amount_in = float(data.get("transferAmount") or data.get("amount_in") or 0)
    
    import re
    matched = re.search(r"LN\d{4,}", content)
    if matched:
        order_code = matched.group(0)
        return mark_order_paid(MarkPaidPayload(order_code=order_code, amount_in=amount_in))
    
# ==================== AI CHATBOT ASSISTANT (GEMINI HYBRID ENGINE) ====================

class ChatMessagePayload(BaseModel):
    message: str
    history: Optional[List[dict]] = []

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

LAUNHA_SYSTEM_INSTRUCTION = """
Bạn là Trợ lý AI Bán Hàng thông minh, duyên dáng & tâm lý của thương hiệu 'Lẩu Nhà' (website: laumangdi.com - Hotline/Zalo: 0819 943 904).

BẢNG GIÁ & KHO TRI THỨC CHUẨN XÁC:
1. BƯỚC 1 - NƯỚC CỐT LẨU HẦM XƯƠNG 12H (Túi 1L tiệt trùng):
- Lẩu Thái Tom Yum (89k): Chua cay nồng nàn (Cay vừa 🌶️🌶️). Bé nhỏ hoặc người không ăn cay sẽ bị cay.
- Lẩu Nấm Thượng Hạng (89k): Ninh từ nấm tùng nhung, đông trùng hạ thảo, táo đỏ & kỷ tử. Hoàn toàn 0% CAY, ngọt thanh tự nhiên, KHÔNG BỘT NGỌT -> RẤT TỐT & BỔ DƯỠNG CHO NGƯỜI GIÀ, TRẺ NHỎ, MẸ BẦU, NGƯỜI BỆNH.
- Lẩu Riêu Cua Đồng (99k): Riêu cua giã tay thơm béo bùi, giấm bỗng chua thanh (Cay nhẹ 🌶️).
- Lẩu Tứ Xuyên Tiêu Tê (99k): Tiêu tê thảo mộc Trung Hoa (Cay nồng 🌶️🌶️🌶️).

2. BƯỚC 2 - SET TOPPING THỊT TƯƠI & KHAY ĐUN (1 Bữa lẩu trọn gói = Nước lẩu + Set topping):
- Set Đôi Lứa (249k - cho 2-3 người): 350g ba chỉ bò Mỹ & bắp bò Úc, 4 tôm thẻ tươi, viên nhúng, rau nấm, mì + Khay nhôm thực phẩm cao cấp đun trực tiếp. (Tổng combo với 1 túi nước lẩu 89k = 338k; áp mã [LAUNHA50K] còn 288k!).
- Set Gia Đình (399k - cho 4-5 người - Bán chạy nhất): 600g bò Mỹ/Úc, 300g tôm mực tươi, 10 viên nhúng, 2 khay rau nấm, mì tươi + MIỄN PHÍ MƯỢN TRỌN BỘ BẾP CỒN 0đ! (Tổng combo với nước lẩu = 488k; áp mã [LAUNHA50K] còn 438k!).
- Set Đại Tiệc (599k - cho 6-8 người): 800g bò thượng hạng, 500g hải sản tươi, 16 viên phô mai, 3 khay rau nấm + FREE mượn 2 bộ bếp cồn.

3. MÓN GỌI THÊM:
- Ba chỉ bò Mỹ thêm 200g (65k), Viên phô mai 6 viên (45k), Cồn gel (15k), Bát đũa dùng 1 lần (15k). Khay nhôm TẶNG MIỄN PHÍ 0đ.

4. CHÍNH SÁCH DỊCH VỤ & ƯU ĐÃI ĐẶC QUYỀN HÔM NAY:
- Mã giảm giá: [LAUNHA50K] (giảm ngay 50.000đ khi điền form khảo sát 30 giây trên website, mã gửi thẳng vào email dùng bất cứ lúc nào).
- Mượn bếp cồn: Đơn >= 399k MƯỢN BẾP 0Đ. Gửi shipper cọc nhẹ 200k/bếp, hôm sau shipper tự qua tận nơi thu hồi và hoàn đủ 100% tiền cọc 200k.
- Khay nhôm đun trực tiếp trên bếp ga mini, bếp hồng ngoại, bếp cồn (an toàn chịu nhiệt 600°C). Nếu dùng bếp từ thì trút vào nồi ở nhà hoặc mượn bếp cồn 0đ.
- Phí ship & Freeship: Giao hỏa tốc 30-40 phút qua Ahamove. Dưới 4km FREESHIP 100%, trên 5km hỗ trợ chia sẻ 20k tiền ship cho đơn từ 399k.
- Dọn dẹp Zero-Mess: Đun khay nhôm và có tặng túi rác, ăn xong túm 30 giây vứt rác, không cần rửa xoong nồi dính mỡ.
- Cam kết đồ tươi: Nhập tươi mỗi sáng, kiểm tra trước khi nhận, đổi mới 1-1 hỏa tốc hoặc hoàn tiền 100% nếu không ưng ý.

5. KỊCH BẢN UP-SELL KHI KHÁCH DO DỰ HOẶC BẢO "ĐỂ TÔI NGHĨ THÊM / ĐỂ XEM LẠI / CHƯA MUA NGAY":
- Luôn thân thiện, lịch sự và tạo cảm giác thoải mái ("Dạ không sao nè bạn ơi, bạn cứ thong thả tham khảo nha! ✨").
- Upsell khéo léo bằng cách giới thiệu 3 ưu đãi hot hôm nay (Mã giảm 50k LAUNHA50K, Free mượn bếp 0đ, Freeship Ahamove).
- Hướng dẫn khách: "Bạn dành 30 giây điền bảng khảo sát ngắn ở bên dưới để lấy và lưu trước Mã Giảm 50.000đ vào email nha, khi nào thèm lẩu chỉ cần mang ra áp dụng là được giảm ngay ạ! 😊".

YÊU CẦU TRẢ LỜI:
- Luôn thân thiện, niềm nở, tâm lý, giải đáp cặn kẽ và hướng khách hàng chọn combo phù hợp nhất.
- Sử dụng emoji sinh động. Dùng các thẻ HTML cơ bản (<strong>, <br>, •) để hiển thị đẹp mắt trên widget chat.
- Trả lời gọn gàng, súc tích (khoảng 80 - 160 từ).
"""

@app.post("/api/chat")
def chat_with_gemini(p: ChatMessagePayload):
    user_msg = (p.message or "").strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Tin nhắn không được để trống")

    import urllib.request
    import json
    import re

    models_to_try = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash", "gemma-4-26b-a4b-it"]
    reply_text = None
    
    payload = {
        "system_instruction": {
            "parts": [{"text": LAUNHA_SYSTEM_INSTRUCTION}]
        },
        "contents": [
            {"parts": [{"text": user_msg}]}
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 600
        }
    }

    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                reply_text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                if reply_text:
                    break
        except Exception as e:
            print(f"[Gemini API Error with {model}]: {e}")
            continue

    if not reply_text:
        return {
            "success": False,
            "reply": None,
            "error": "Gemini API unavailable, please use local fallback"
        }

    # Định dạng CTA buttons thông minh theo ngữ cảnh
    msg_lower = user_msg.lower()
    
    # 1. Nếu khách do dự / hỏi về khảo sát / voucher -> Ưu tiên nút dẫn về Bảng khảo sát
    if any(k in msg_lower for k in ["nghĩ thêm", "nghi them", "suy nghĩ", "suy nghi", "xem lại", "xem lai", "chưa mua", "chua mua", "đang phân vân", "phan van", "để khi khác", "de khi khac", "để xem", "de xem", "khảo sát", "khao sat", "voucher", "mã giảm", "ma giam"]):
        cta = [
            {"text": "🎁 ĐIỀN KHẢO SÁT NHẬN MÃ 50K", "action": "survey", "primary": True},
            {"text": "🔥 Xem Lại Menu Lẩu", "action": "order", "primary": False}
        ]
    elif "zalo" in msg_lower or "hotline" in msg_lower:
        cta = [
            {"text": "💬 Nhắn Qua Zalo (0819 943 904)", "action": "zalo", "primary": True},
            {"text": "🔥 Đặt Lẩu Trực Tiếp", "action": "order", "primary": False}
        ]
    else:
        cta = [
            {"text": "🔥 TỰ MIX SET LẨU (GIẢM 50K)", "action": "order", "primary": True},
            {"text": "🎁 Khảo Sát Nhận Mã 50K", "action": "survey", "primary": False}
        ]

    return {
        "success": True,
        "reply": reply_text,
        "cta": cta
    }


# ==================== STATIC & ADMIN ROUTES ====================

@app.get("/admin")
@app.get("/admin/")
def get_admin_page():
    admin_html = os.path.join(BASE_DIR, "admin", "index.html")
    if os.path.exists(admin_html):
        return FileResponse(admin_html)
    return HTMLResponse("<h1>Admin Panel</h1><p>Vui lòng tạo admin/index.html</p>")

# Mount static files for the main site if needed
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    print(f"🚀 Đang khởi động Admin Server tại http://0.0.0.0:{port}/admin ...")
    uvicorn.run(app, host="0.0.0.0", port=port)
