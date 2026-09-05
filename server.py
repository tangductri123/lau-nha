import os
import sqlite3
import sys
import json
import html
import asyncio
import urllib.request
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from pydantic import BaseModel
from telegram_bot import (
    answer_callback_query,
    edit_telegram_message,
    send_interactive_order_card,
)
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
    """Thá»±c thi cÃ¢u lá»nh ghi trÃªn cÃ¡c file brain.db phá»¥ Äá» Äá»ng bá»."""
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
        asyncio.create_task(telegram_polling_worker())
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
        raise HTTPException(status_code=400, detail="Loáº¡i sáº£n pháº©m pháº£i lÃ  physical, digital, hoáº·c service")
    if p.price < 0:
        raise HTTPException(status_code=400, detail="GiÃ¡ khÃ´ng thá» Ã¢m")
    if p.type == "physical" and p.stock is None:
        raise HTTPException(status_code=400, detail="Sáº£n pháº©m váº­t lÃ½ báº¯t buá»c pháº£i cÃ³ sá» lÆ°á»£ng tá»n kho")
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

    return {"success": True, "id": new_id, "message": "ThÃªm sáº£n pháº©m thÃ nh cÃ´ng"}

@app.put("/api/products/{product_id}")
def update_product(product_id: int, p: ProductUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m")

    name = p.name.strip() if p.name is not None else existing["name"]
    p_type = p.type if p.type is not None else existing["type"]
    price = p.price if p.price is not None else existing["price"]
    desc = p.description if p.description is not None else existing["description"]
    
    if p_type not in ["physical", "digital", "service"]:
        raise HTTPException(status_code=400, detail="Loáº¡i sáº£n pháº©m khÃ´ng há»£p lá»")

    if p_type in ["digital", "service"]:
        stock = None
    else:
        stock = p.stock if p.stock is not None else existing["stock"]
        if stock is None:
            raise HTTPException(status_code=400, detail="Sáº£n pháº©m váº­t lÃ½ báº¯t buá»c cÃ³ tá»n kho")

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

    return {"success": True, "message": "Cáº­p nháº­t sáº£n pháº©m thÃ nh cÃ´ng"}

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m")

    # Kiá»m tra xem cÃ³ ÄÆ¡n hÃ ng liÃªn quan khÃ´ng
    order_count = conn.execute("SELECT COUNT(*) FROM orders WHERE product_id = ?", (product_id,)).fetchone()[0]
    if order_count > 0:
        conn.close()
        raise HTTPException(status_code=400, detail=f"KhÃ´ng thá» xÃ³a vÃ¬ cÃ³ {order_count} ÄÆ¡n hÃ ng liÃªn quan Äáº¿n sáº£n pháº©m nÃ y")

    conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()

    sync_all_dbs("DELETE FROM products WHERE id = ?", (product_id,))
    return {"success": True, "message": "ÄÃ£ xÃ³a sáº£n pháº©m"}


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
        raise HTTPException(status_code=400, detail="TÃªn khÃ¡ch hÃ ng khÃ´ng ÄÆ°á»£c Äá» trá»ng")

    phone = (c.phone or "").strip()
    if phone and not validate_vietnamese_phone(phone):
        raise HTTPException(status_code=400, detail="Sá» Äiá»n thoáº¡i khÃ´ng ÄÃºng Äá»nh dáº¡ng Viá»t Nam (10 sá» di Äá»ng)")

    email = (c.email or "").strip()
    if email and not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Äá»a chá» email khÃ´ng ÄÃºng Äá»nh dáº¡ng (vÃ­ dá»¥: email@gmail.com)")

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

    return {"success": True, "id": new_id, "message": "ThÃªm khÃ¡ch hÃ ng thÃ nh cÃ´ng"}

@app.put("/api/customers/{customer_id}")
def update_customer(customer_id: int, c: CustomerUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y khÃ¡ch hÃ ng")

    name = c.name.strip() if c.name is not None else existing["name"]
    if not name:
        conn.close()
        raise HTTPException(status_code=400, detail="TÃªn khÃ¡ch hÃ ng khÃ´ng ÄÆ°á»£c Äá» trá»ng")

    phone = c.phone.strip() if c.phone is not None else existing["phone"]
    if phone and not validate_vietnamese_phone(phone):
        conn.close()
        raise HTTPException(status_code=400, detail="Sá» Äiá»n thoáº¡i khÃ´ng ÄÃºng Äá»nh dáº¡ng Viá»t Nam (10 sá» di Äá»ng)")

    email = c.email.strip() if c.email is not None else (existing["email"] if "email" in existing.keys() else None)
    if email and not validate_email_format(email):
        conn.close()
        raise HTTPException(status_code=400, detail="Äá»a chá» email khÃ´ng ÄÃºng Äá»nh dáº¡ng (vÃ­ dá»¥: email@gmail.com)")

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

    return {"success": True, "message": "Cáº­p nháº­t thÃ´ng tin khÃ¡ch hÃ ng thÃ nh cÃ´ng"}

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y khÃ¡ch hÃ ng")

    conn.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    conn.commit()
    conn.close()

    sync_all_dbs("DELETE FROM customers WHERE id = ?", (customer_id,))
    return {"success": True, "message": "ÄÃ£ xÃ³a khÃ¡ch hÃ ng"}


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
            c.address AS customer_address,
            o.product_id, 
            p.name AS product_name, 
            p.type AS product_type,
            p.stock AS current_stock,
            p.price AS product_price,
            o.amount, 
            o.status, 
            o.order_date,
            COALESCE(o.shipping_fee, 0) AS shipping_fee,
            COALESCE(o.deposit_amount, 0) AS deposit_amount,
            COALESCE(o.discount_amount, 0) AS discount_amount,
            COALESCE(o.voucher_code, '') AS voucher_code,
            COALESCE(o.total_collection, 0) AS total_collection,
            COALESCE(o.order_value, 0) AS order_value,
            COALESCE(o.deposit_refunded, 0) AS deposit_refunded,
            COALESCE(o.note, '') AS note,
            COALESCE(o.raw_items_json, '') AS raw_items_json,
            COALESCE(o.address, '') AS delivery_address
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
                "customer_address": r.get("delivery_address") or r.get("customer_address") or "",
                "status": r["status"],
                "order_date": r["order_date"],
                "shipping_fee": float(r.get("shipping_fee") or 0),
                "deposit_amount": float(r.get("deposit_amount") or 0),
                "discount_amount": float(r.get("discount_amount") or 0),
                "voucher_code": str(r.get("voucher_code") or ""),
                "total_collection": float(r.get("total_collection") or 0),
                "order_value": float(r.get("order_value") or 0),
                "deposit_refunded": int(r.get("deposit_refunded") or 0),
                "note": str(r.get("note") or ""),
                "total_amount": 0.0,
                "amount": 0.0,
                "order_ids": [],
                "items": []
            }

        grouped[group_key]["order_ids"].append(r["id"])
        item_amt = float(r["amount"] or 0)
        grouped[group_key]["total_amount"] += item_amt
        grouped[group_key]["amount"] += item_amt

        if r.get("shipping_fee") and float(r["shipping_fee"]) > grouped[group_key]["shipping_fee"]:
            grouped[group_key]["shipping_fee"] = float(r["shipping_fee"])
        if r.get("deposit_amount") and float(r["deposit_amount"]) > grouped[group_key]["deposit_amount"]:
            grouped[group_key]["deposit_amount"] = float(r["deposit_amount"])
        if r.get("discount_amount") and float(r["discount_amount"]) > grouped[group_key]["discount_amount"]:
            grouped[group_key]["discount_amount"] = float(r["discount_amount"])
        if r.get("voucher_code") and not grouped[group_key]["voucher_code"]:
            grouped[group_key]["voucher_code"] = str(r["voucher_code"])
        if r.get("total_collection") and float(r["total_collection"]) > grouped[group_key]["total_collection"]:
            grouped[group_key]["total_collection"] = float(r["total_collection"])
        if r.get("order_value") and float(r["order_value"]) > grouped[group_key]["order_value"]:
            grouped[group_key]["order_value"] = float(r["order_value"])
        if r.get("note") and not grouped[group_key]["note"]:
            grouped[group_key]["note"] = str(r["note"])

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
        if grp["total_collection"] == 0:
            grp["total_collection"] = max(0, grp["total_amount"] + grp["shipping_fee"] + grp["deposit_amount"] - grp["discount_amount"])
        if grp["order_value"] == 0:
            grp["order_value"] = max(0, grp["total_amount"] + grp["shipping_fee"] - grp["discount_amount"])
        result.append(grp)

    return result

@app.post("/api/orders")
def create_order(o: OrderCreate):
    conn = get_conn()
    
    # 1. Kiá»m tra khÃ¡ch hÃ ng
    customer = conn.execute("SELECT * FROM customers WHERE id = ?", (o.customer_id,)).fetchone()
    if not customer:
        conn.close()
        raise HTTPException(status_code=400, detail="KhÃ¡ch hÃ ng khÃ´ng tá»n táº¡i")

    # Chuáº©n hÃ³a danh sÃ¡ch items
    items_to_process = []
    if o.items and len(o.items) > 0:
        items_to_process = o.items
    elif o.product_id is not None:
        items_to_process = [OrderItem(product_id=o.product_id, quantity=o.quantity or 1, amount=o.amount)]
    else:
        conn.close()
        raise HTTPException(status_code=400, detail="Vui lÃ²ng chá»n Ã­t nháº¥t 1 sáº£n pháº©m")

    cursor = conn.cursor()
    created_orders = []
    deductions = []
    has_physical_stock_deducted = False

    # Táº¡o mÃ£ ÄÆ¡n hÃ ng chung cho toÃ n bá» mÃ³n trong HÄ
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
                raise HTTPException(status_code=400, detail=f"Sáº£n pháº©m ID {pid} khÃ´ng tá»n táº¡i")

            amount = item.amount if (item.amount is not None and item.amount >= 0) else (product["price"] * qty)

            # Xá»­ lÃ½ tá»n kho náº¿u lÃ  physical
            if product["type"] == "physical":
                curr_stock = product["stock"] if product["stock"] is not None else 0
                if curr_stock < qty:
                    raise HTTPException(status_code=400, detail=f"Sáº£n pháº©m '{product['name']}' chá» cÃ²n tá»n kho {curr_stock}, khÃ´ng Äá»§ Äá» táº¡o ÄÆ¡n ({qty})")
                
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

    # Tá»± Äá»ng gá»­i email xÃ¡c nháº­n ÄÆ¡n hÃ ng qua Resend náº¿u khÃ¡ch hÃ ng cÃ³ email
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
            print(f"[Order Email] ÄÃ£ tá»± Äá»ng gá»­i email xÃ¡c nháº­n ÄÆ¡n cho {cust_email} (ThÃ nh cÃ´ng: {ok})")
        except Exception as email_err:
            print(f"[Order Email Error]: {email_err}")
            email_status = {"sent": False, "error": str(email_err)}

    msg = f"ÄÃ£ táº¡o thÃ nh cÃ´ng ÄÆ¡n hÃ ng #{order_code} gá»m {len(created_orders)} mÃ³n (Tá»ng: {total_amount:,.0f}Ä)"
    if email_status and email_status.get("sent"):
        msg += f" vÃ  ÄÃ£ gá»­i email xÃ¡c nháº­n tá»i {cust_email}!"

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
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y ÄÆ¡n hÃ ng")

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
    return {"success": True, "message": "Cáº­p nháº­t ÄÆ¡n hÃ ng thÃ nh cÃ´ng"}

@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y ÄÆ¡n hÃ ng")

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
    return {"success": True, "message": "ÄÃ£ xÃ³a toÃ n bá» ÄÆ¡n hÃ ng"}


# ==================== LANDING PAGE ORDER ENDPOINT ====================

class SendOrderPayload(BaseModel):
    cust_name: Optional[str] = None
    cust_phone: Optional[str] = None
    cust_email: Optional[str] = None
    cust_address: Optional[str] = None
    cust_note: Optional[str] = None
    note: Optional[str] = None
    order_code: Optional[str] = None
    items: Optional[List[dict]] = None
    stove_included: Optional[bool] = False
    shipping_fee: Optional[float] = 0
    voucher_code: Optional[str] = None
    discount_code: Optional[str] = None
    discount_amount: Optional[float] = None
    deposit_amount: Optional[float] = None
    stove_deposit: Optional[float] = None
    stove_fee: Optional[float] = None
    order_value: Optional[float] = None
    total_collection: Optional[float] = None

@app.post("/api/send-order")
@app.post("/send-order")
def handle_landing_send_order(data: SendOrderPayload):
    name = (data.cust_name or "").strip()
    phone = (data.cust_phone or "").strip()
    email = (data.cust_email or "").strip()
    address = (data.cust_address or "").strip()
    note = (data.cust_note or data.note or "").strip()
    order_code = (data.order_code or "").strip()
    items = data.items or []

    if not name or not phone:
        raise HTTPException(status_code=400, detail="Thiếu thông tin họ tên hoặc số điện thoại nhận hàng")

    if not validate_vietnamese_phone(phone):
        raise HTTPException(status_code=400, detail="Số điện thoại nhận hàng không hợp lệ (yêu cầu 10 số di động Việt Nam)")

    if email and not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Địa chỉ email không đúng định dạng (ví dụ: email@gmail.com)")

    # Calculate financial breakdown
    raw_subtotal = sum(float(it.get("price", 0)) * max(1, int(it.get("qty", 1))) for it in items)
    is_stove = bool(data.stove_included)
    shipping_fee = float(data.shipping_fee or 0)
    discount_amount = float(data.discount_amount if data.discount_amount is not None else (50000 if raw_subtotal > 0 else 0))
    voucher_code = str(data.voucher_code or data.discount_code or ("LAUNHA50K" if discount_amount > 0 else "")).strip()
    deposit_amount = float(data.deposit_amount if data.deposit_amount is not None else (data.stove_deposit if data.stove_deposit is not None else (200000 if is_stove else 0)))
    stove_fee = float(data.stove_fee if data.stove_fee is not None else (50000 if is_stove and raw_subtotal < 399000 else 0))
    order_value = float(data.order_value if data.order_value is not None else max(0, raw_subtotal + stove_fee - discount_amount + shipping_fee))
    total_collection = float(data.total_collection if data.total_collection is not None else max(0, order_value + deposit_amount))

    conn = get_conn()
    cursor = conn.cursor()

    # 1. Tìm hoặc tạo mới khách hàng trong bảng customers
    cust_row = conn.execute("SELECT id FROM customers WHERE phone = ? LIMIT 1", (phone,)).fetchone()
    if cust_row:
        customer_id = cust_row["id"]
        conn.execute("UPDATE customers SET name = ?, email = COALESCE(NULLIF(?, ''), email), zalo = COALESCE(zalo, ?) WHERE id = ?", (name, email or None, phone, customer_id))
        sync_all_dbs("UPDATE customers SET name = ?, email = COALESCE(NULLIF(?, ''), email), zalo = COALESCE(zalo, ?) WHERE id = ?", (name, email or None, phone, customer_id))
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

        # Lưu đơn hàng vào bảng orders với đầy đủ các trường tài chính
        raw_json_str = json.dumps(items, ensure_ascii=False)
        cursor.execute(
            """INSERT INTO orders (
                customer_id, product_id, amount, status, order_code,
                shipping_fee, deposit_amount, discount_amount, voucher_code,
                total_collection, order_value, note, address, raw_items_json, notified
            ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""",
            (
                customer_id, product_id, item_total, order_code,
                shipping_fee, deposit_amount, discount_amount, voucher_code,
                total_collection, order_value, note, address, raw_json_str
            )
        )
        ord_id = cursor.lastrowid
        sync_all_dbs(
            """INSERT OR REPLACE INTO orders (
                id, customer_id, product_id, amount, status, order_code,
                shipping_fee, deposit_amount, discount_amount, voucher_code,
                total_collection, order_value, note, address, raw_items_json, notified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""",
            (
                ord_id, customer_id, product_id, item_total, 'pending', order_code,
                shipping_fee, deposit_amount, discount_amount, voucher_code,
                total_collection, order_value, note, address, raw_json_str
            )
        )
        created_orders.append(ord_id)

    conn.commit()
    conn.close()

    # 1. Gửi email xác nhận đơn hàng (Order Confirmation) cho khách và quản lý
    email_status = None
    try:
        ok, res_info = send_order_confirmation_email(
            customer_name=name,
            customer_email=email,
            items=items,
            total_amount=total_collection,
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

    # 3. Gửi thông báo đơn hàng vào nhóm Telegram
    try:
        from telegram_bot import send_interactive_order_card
        tg_payload = {
            "order_code": order_code,
            "name": name,
            "customer_name": name,
            "phone": phone,
            "email": email,
            "address": address,
            "note": note,
            "items": items,
            "is_stove": is_stove,
            "shipping_fee": shipping_fee,
            "discount_amount": discount_amount,
            "voucher_code": voucher_code,
            "deposit_amount": deposit_amount,
            "order_value": order_value,
            "total_collection": total_collection
        }
        send_interactive_order_card(tg_payload)
    except Exception as tg_err:
        print(f"[Telegram Notification Warning]: {tg_err}")

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
        raise HTTPException(status_code=400, detail="Há» vÃ  tÃªn khÃ´ng ÄÆ°á»£c Äá» trá»ng")
    if not email or not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Vui lÃ²ng nháº­p Äá»a chá» email há»£p lá» (vÃ­ dá»¥: hoten@gmail.com) Äá» nháº­n mÃ£ Æ°u ÄÃ£i")
    if phone and not validate_vietnamese_phone(phone):
        raise HTTPException(status_code=400, detail="Sá» Äiá»n thoáº¡i khÃ´ng ÄÃºng Äá»nh dáº¡ng Viá»t Nam (10 sá» di Äá»ng)")

    raw_json = json.dumps(data.raw_answers, ensure_ascii=False) if data.raw_answers else None

    conn = get_conn()
    cursor = conn.cursor()

    # 1. TrÃ­ch xuáº¥t thÃ´ng tin khÃ¡ch hÃ ng vÃ  lÆ°u vÃ o báº£ng customers trong brain.db (vá»i kind = 'lead')
    cust_row = None
    if phone:
        cust_row = conn.execute("SELECT * FROM customers WHERE phone = ? LIMIT 1", (phone,)).fetchone()
    if not cust_row and email:
        cust_row = conn.execute("SELECT * FROM customers WHERE email = ? LIMIT 1", (email,)).fetchone()

    if cust_row:
        customer_id = cust_row["id"]
        # Cáº­p nháº­t thÃ´ng tin khÃ¡ch hÃ ng, gÃ¡n kind = 'lead' náº¿u chÆ°a cÃ³ ÄÆ¡n hÃ ng hoáº·c cáº­p nháº­t theo kháº£o sÃ¡t
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

    # 2. LÆ°u thÃ´ng tin cÃ¢u tráº£ lá»i kháº£o sÃ¡t vÃ  mÃ£ code vÃ o báº£ng leads
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

    # 3. Tá»± Äá»ng ÄÆ°a Lead vÃ o Chuá»i 3 Email Tá»± Äá»ng (Resend)
    # - Email 1 (Ngay láº­p tá»©c): ChÃ o má»«ng + Voucher 50k + 2 nÃºt Zalo/Chatbot
    # - Email 2 (+2 ngÃ y): Insight nÆ°á»c cá»t 12h
    # - Email 3 (+3 ngÃ y): Tiá»c láº©u táº¡i gia / chá»t sale
    seq_result = None
    try:
        seq_result = enroll_lead_email_sequence(
            customer_id=customer_id,
            name=name,
            email=email,
            discount_code=discount_code
        )
        print(f"[Lead Email Sequence] ÄÃ£ ghi nháº­n chuá»i email cho lead {email}: {seq_result.get('message')}")
    except Exception as em_err:
        print(f"[Lead Email Sequence Error]: {em_err}")
        seq_result = {"success": False, "error": str(em_err)}

    # 4. Gá»­i thÃ´ng bÃ¡o Lead má»i vá» nhÃ³m Telegram
    tele_status = None
    try:
        lead_dict = {
            "name": name,
            "phone": phone or "ChÆ°a Äiá»n",
            "email": email,
            "discount_code": discount_code,
            "eat_with": eat_with or "KhÃ´ng chá»n",
            "frequency": frequency or "KhÃ´ng chá»n",
            "main_concern": main_concern or "KhÃ´ng chá»n",
            "interested_in_service": interested or "KhÃ´ng chá»n"
        }
        tele_ok, tele_msg = notify_telegram_lead(lead_dict)
        tele_status = {"sent": tele_ok, "info": tele_msg}
        print(f"[Telegram Lead] ÄÃ£ gá»­i thÃ´ng bÃ¡o Lead kháº£o sÃ¡t vá» Telegram (ThÃ nh cÃ´ng: {tele_ok})")
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
        "message": f"Cáº£m Æ¡n báº¡n {name}! MÃ£ Æ°u ÄÃ£i {discount_code} ÄÃ£ ÄÆ°á»£c gá»­i Äáº¿n email {email}."
    }

@app.put("/api/leads/{lead_id}/toggle-code-used")
def toggle_lead_code_used(lead_id: int):
    conn = get_conn()
    lead = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
    if not lead:
        conn.close()
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y lead nÃ y")

    new_state = 0 if (lead["code_used"] == 1) else 1
    conn.execute("UPDATE leads SET code_used = ? WHERE id = ?", (new_state, lead_id))
    conn.commit()
    conn.close()

    sync_all_dbs("UPDATE leads SET code_used = ? WHERE id = ?", (new_state, lead_id))
    return {
        "success": True,
        "lead_id": lead_id,
        "code_used": new_state,
        "message": f"ÄÃ£ chuyá»n tráº¡ng thÃ¡i mÃ£ Æ°u ÄÃ£i sang {'ÄÃ DÃNG' if new_state == 1 else 'CHÆ¯A DÃNG'}"
    }

@app.put("/api/leads/{lead_id}")
def update_lead(lead_id: int, data: LeadUpdatePayload):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y lead nÃ y")

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
    return {"success": True, "message": "Cáº­p nháº­t lead thÃ nh cÃ´ng"}

@app.delete("/api/leads/{lead_id}")
def delete_lead(lead_id: int):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y lead")

    conn.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
    conn.commit()
    conn.close()

    sync_all_dbs("DELETE FROM leads WHERE id = ?", (lead_id,))
    return {"success": True, "message": "ÄÃ£ xÃ³a lead thÃ nh cÃ´ng"}


# ==================== EMAIL SEQUENCE MANAGEMENT ENDPOINTS ====================

@app.get("/api/email-sequences")
def list_email_sequences():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM email_sequences ORDER BY id DESC LIMIT 100").fetchall()
    conn.close()
    return [dict(r) for r in rows]

class TestEmailSeqPayload(BaseModel):
    name: Optional[str] = "KhÃ¡ch HÃ ng Test"
    email: str

@app.post("/api/test-email-sequence")
def trigger_test_email_sequence(p: TestEmailSeqPayload):
    email = (p.email or "").strip()
    name = (p.name or "KhÃ¡ch HÃ ng Test").strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Email khÃ´ng há»£p lá»")

    res = enroll_email_sequence(0, name, email)
    return res



# ==================== TELEGRAM ORDER CONFIRMATION & WEBHOOK ====================

def confirm_order_and_decrement_stock(order_code: str):
    """Confirm all items for an order and decrement physical stock based on item quantities."""
    code = (order_code or "").strip().upper()
    if not code:
        raise ValueError("Thiếu mã đơn hàng")
    conn = get_conn()
    try:
        rows = conn.execute("""
            SELECT o.*, p.type AS product_type, p.stock AS product_stock, p.name AS product_name,
                   c.name as customer_name, c.phone as customer_phone
            FROM orders o 
            JOIN products p ON p.id = o.product_id 
            LEFT JOIN customers c ON c.id = o.customer_id
            WHERE UPPER(o.order_code) = ?
        """, (code,)).fetchall()
        if not rows:
            raise LookupError(f"Không tìm thấy đơn hàng {code}")

        all_confirmed = all(r["status"] in ("confirmed", "completed", "paid") for r in rows)
        first = dict(rows[0])
        
        # Parse items from raw_items_json if available
        raw_items_json = first.get("raw_items_json")
        parsed_items = []
        if raw_items_json:
            try:
                parsed_items = json.loads(raw_items_json)
            except Exception:
                pass

        if all_confirmed:
            return {
                "success": True,
                "already_confirmed": True,
                "order_code": code,
                "customer_name": first.get("customer_name") or "Khách hàng",
                "phone": first.get("customer_phone") or "",
                "total_collection": int(first.get("total_collection") or sum(float(r["amount"] or 0) for r in rows)),
                "order_value": int(first.get("order_value") or sum(float(r["amount"] or 0) for r in rows)),
                "items": parsed_items or [{"name": r["product_name"], "qty": 1, "subtotal": int(r["amount"])} for r in rows if r["product_name"]],
                "message": f"Đơn hàng {code} đã được xác nhận trước đó"
            }

        # Deduct stock
        for row in rows:
            if row["status"] in ("confirmed", "completed", "paid"):
                continue
            if row["product_type"] == "physical":
                # Find quantity
                qty = 1
                if parsed_items:
                    for pit in parsed_items:
                        if pit.get("product_id") == row["product_id"]:
                            qty = max(1, int(pit.get("qty", 1)))
                            break
                stock = row["product_stock"] if row["product_stock"] is not None else 0
                if stock < qty:
                    print(f"[Stock Warning] Sản phẩm '{row['product_name']}' tồn kho còn {stock}, trừ {qty}")
                new_stock = max(0, stock - qty)
                conn.execute("UPDATE products SET stock = ? WHERE id = ?", (new_stock, row["product_id"],))
                sync_all_dbs("UPDATE products SET stock = ? WHERE id = ?", (new_stock, row["product_id"],))

            conn.execute("UPDATE orders SET status = 'confirmed' WHERE id = ?", (row["id"],))
            sync_all_dbs("UPDATE orders SET status = 'confirmed' WHERE id = ?", (row["id"],))

        conn.commit()

        return {
            "success": True,
            "order_code": code,
            "customer_name": first.get("customer_name") or "Khách hàng",
            "phone": first.get("customer_phone") or "",
            "total_collection": int(first.get("total_collection") or sum(float(r["amount"] or 0) for r in rows)),
            "order_value": int(first.get("order_value") or sum(float(r["amount"] or 0) for r in rows)),
            "deposit_amount": int(first.get("deposit_amount") or 0),
            "shipping_fee": int(first.get("shipping_fee") or 0),
            "discount_amount": int(first.get("discount_amount") or 0),
            "items": parsed_items or [{"name": r["product_name"], "qty": 1, "subtotal": int(r["amount"])} for r in rows if r["product_name"]],
            "message": f"Đã xác nhận đơn {code} và trừ tồn kho thành công"
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.post("/api/telegram-webhook")
@app.post("/api/telegram/webhook")
async def telegram_webhook_handler(request: Request):
    """Xử lý sự kiện từ Telegram Webhook (Bấm nút [Chốt đơn], [QR], [Hủy đơn])"""
    try:
        data = await request.json()
    except Exception:
        return {"ok": False, "error": "Invalid JSON payload"}

    callback = data.get("callback_query") or {}
    if callback:
        handle_telegram_callback_sync(callback)
    return {"success": True}

def handle_telegram_callback_sync(callback: dict):
    callback_id = callback.get("id")
    callback_data = str(callback.get("data") or "")
    from_user = callback.get("from", {}).get("first_name") or callback.get("from", {}).get("username") or "Admin"
    message = callback.get("message") or {}
    chat_id = message.get("chat", {}).get("id")
    msg_id = message.get("message_id")
    original_text = message.get("text") or ""
    
    code = ""
    action = ""
    if callback_data.startswith("confirm_") or callback_data.startswith("final_confirm:"):
        action = "confirm"
        code = callback_data.replace("final_confirm:", "").replace("confirm_", "").strip().upper()
    elif callback_data.startswith("qr_"):
        action = "qr"
        code = callback_data.replace("qr_", "").strip().upper()
    elif callback_data.startswith("cancel_"):
        action = "cancel"
        code = callback_data.replace("cancel_", "").strip().upper()

    print(f"[Telegram Processing Callback] Action: {action}, Code: {code}, User: {from_user}")

    if not code:
        if callback_id:
            try:
                answer_callback_query(callback_id, "Yêu cầu không hợp lệ")
            except Exception:
                pass
        return

    conn = get_conn()
    cursor = conn.cursor()
    
    try:
        from telegram_bot import _telegram_post, answer_callback_query, edit_telegram_message

        if action == "confirm":
            cursor.execute("UPDATE orders SET status = 'confirmed' WHERE UPPER(order_code) = ? OR UPPER(order_code) LIKE ?", (code, f"%{code}%"))
            conn.commit()
            sync_all_dbs("UPDATE orders SET status = 'confirmed' WHERE UPPER(order_code) = ? OR UPPER(order_code) LIKE ?", (code, f"%{code}%"))
            
            if callback_id:
                try:
                    answer_callback_query(callback_id, f"✅ Đã xác nhận đơn #{code}!")
                except Exception as cb_err:
                    print(f"[Telegram Answer Callback Error]: {cb_err}")
            
            if chat_id and msg_id:
                clean_orig = html.escape(original_text)
                new_text = (
                    clean_orig + f"\n\n━━━━━━━━━━━━━━━━━━\n"
                    f"✅ <b>ĐÃ XÁC NHẬN ĐƠN HÀNG</b> bởi {html.escape(from_user)} lúc {datetime.now().strftime('%H:%M %d/%m/%Y')}\n"
                    f"📌 Trạng thái: <b>Đã xác nhận (confirmed)</b>"
                )
                try:
                    _telegram_post("editMessageText", {
                        "chat_id": chat_id,
                        "message_id": msg_id,
                        "text": new_text,
                        "parse_mode": "HTML",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {"text": "💳 Lấy mã QR", "callback_data": f"qr_{code}"},
                                    {"text": "❌ Hủy đơn", "callback_data": f"cancel_{code}"}
                                ]
                            ]
                        }
                    })
                except Exception as edit_err:
                    print(f"[Telegram Edit HTML Error]: {edit_err}")
                    try:
                        _telegram_post("editMessageText", {
                            "chat_id": chat_id,
                            "message_id": msg_id,
                            "text": original_text + f"\n\n━━━━━━━━━━━━━━━━━━\n✅ ĐÃ XÁC NHẬN ĐƠN HÀNG bởi {from_user} lúc {datetime.now().strftime('%H:%M %d/%m/%Y')}\n📌 Trạng thái: Đã xác nhận (confirmed)"
                        })
                    except Exception as fallback_err:
                        print(f"[Telegram Edit Fallback Error]: {fallback_err}")

        elif action == "qr":
            rows = conn.execute("SELECT * FROM orders WHERE UPPER(order_code) = ?", (code,)).fetchall()
            total_collect = 0
            if rows:
                total_collect = float(rows[0]["total_collection"] or sum(float(r["amount"] or 0) for r in rows))
            if total_collect == 0:
                total_collect = 399000
            
            if callback_id:
                try:
                    answer_callback_query(callback_id, f"💳 Đang gửi mã QR #{code}...")
                except Exception:
                    pass
            
            qr_url = f"https://qr.sepay.vn/img?acc=22678555999&bank=TPBank&amount={int(total_collect)}&des={code}&template=compact"
            caption = (
                f"💳 <b>MÃ VIETQR THANH TOÁN CHO ĐƠN #{code}</b>\n"
                f"• Số tiền: <b>{int(total_collect):,} đ</b>\n"
                f"• Ngân hàng: <b>TPBank (Tiên Phong)</b>\n"
                f"• Số tài khoản: <code>22678555999</code>\n"
                f"• Nội dung CK: <code>{code}</code>\n\n"
                f"<i>Khách chuyển khoản đúng nội dung trên hệ thống sẽ tự động xác nhận thanh toán.</i>"
            )
            try:
                _telegram_post("sendPhoto", {
                    "chat_id": chat_id,
                    "photo": qr_url,
                    "caption": caption,
                    "parse_mode": "HTML"
                })
            except Exception as qr_err:
                print(f"[Telegram QR Error]: {qr_err}")

        elif action == "cancel":
            cursor.execute("UPDATE orders SET status = 'cancelled' WHERE UPPER(order_code) = ? OR UPPER(order_code) LIKE ?", (code, f"%{code}%"))
            conn.commit()
            sync_all_dbs("UPDATE orders SET status = 'cancelled' WHERE UPPER(order_code) = ? OR UPPER(order_code) LIKE ?", (code, f"%{code}%"))
            
            if callback_id:
                try:
                    answer_callback_query(callback_id, f"❌ Đã hủy đơn #{code}!")
                except Exception:
                    pass
            
            if chat_id and msg_id:
                clean_orig = html.escape(original_text)
                new_text = (
                    clean_orig + f"\n\n━━━━━━━━━━━━━━━━━━\n"
                    f"❌ <b>ĐÃ HỦY ĐƠN HÀNG</b> bởi {html.escape(from_user)} lúc {datetime.now().strftime('%H:%M %d/%m/%Y')}\n"
                    f"📌 Trạng thái: <b>Đã hủy (cancelled)</b>"
                )
                try:
                    _telegram_post("editMessageText", {
                        "chat_id": chat_id,
                        "message_id": msg_id,
                        "text": new_text,
                        "parse_mode": "HTML"
                    })
                except Exception as cancel_err:
                    print(f"[Telegram Cancel Error]: {cancel_err}")
                    try:
                        _telegram_post("editMessageText", {
                            "chat_id": chat_id,
                            "message_id": msg_id,
                            "text": original_text + f"\n\n━━━━━━━━━━━━━━━━━━\n❌ ĐÃ HỦY ĐƠN HÀNG bởi {from_user} lúc {datetime.now().strftime('%H:%M %d/%m/%Y')}\n📌 Trạng thái: Đã hủy (cancelled)"
                        })
                    except Exception:
                        pass
    except Exception as e:
        print(f"[Handle Telegram Callback Error]: {e}")
    finally:
        conn.close()

async def telegram_polling_worker():
    """Background worker that continuously polls Telegram for button clicks and messages."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN") or "8814364164:AAE5q48PnNoLMVYJGjqdGyFZrw0LWKbVPi8"
    if not token:
        return
    offset = 0
    print("[Telegram Polling] Started Telegram bot polling worker...")
    while True:
        try:
            url = f"https://api.telegram.org/bot{token}/getUpdates?offset={offset}&timeout=20"
            req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
            loop = asyncio.get_event_loop()
            
            def fetch_updates():
                with urllib.request.urlopen(req, timeout=25) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            
            data = await loop.run_in_executor(None, fetch_updates)
            if data.get("ok"):
                for update in data.get("result", []):
                    offset = max(offset, update.get("update_id", 0) + 1)
                    
                    callback = update.get("callback_query")
                    if callback:
                        print(f"[Telegram Callback Event]: {callback.get('data')}")
                        await loop.run_in_executor(None, handle_telegram_callback_sync, callback)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Telegram Polling Loop Exception]: {e}")
            await asyncio.sleep(2)



# ==================== AUTOMATIC PAYMENT STATUS UPDATE ====================

class MarkPaidPayload(BaseModel):
    order_code: Optional[str] = None
    transaction_id: Optional[str] = None
    amount_in: Optional[float] = None

@app.post("/api/orders/mark-paid")
def mark_order_paid(p: MarkPaidPayload):
    code = (p.order_code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Thiáº¿u mÃ£ ÄÆ¡n hÃ ng")

    conn = get_conn()
    cursor = conn.cursor()
    
    # TÃ¬m vÃ  cáº­p nháº­t táº¥t cáº£ cÃ¡c mÃ³n thuá»c mÃ£ ÄÆ¡n nÃ y sang 'paid'
    cursor.execute("UPDATE orders SET status = 'paid' WHERE UPPER(order_code) = ? OR UPPER(order_code) LIKE ?", (code, f"%{code}%"))
    updated = cursor.rowcount
    conn.commit()
    conn.close()

    sync_all_dbs("UPDATE orders SET status = 'paid' WHERE UPPER(order_code) = ? OR UPPER(order_code) LIKE ?", (code, f"%{code}%"))
    print(f"[Payment Notification] ÄÆ¡n hÃ ng #{code} ÄÃ£ ÄÆ°á»£c tá»± Äá»ng cáº­p nháº­t sang 'paid' ({updated} mÃ³n)!")

    return {
        "success": True,
        "order_code": code,
        "updated_items": updated,
        "message": f"ÄÃ£ tá»± Äá»ng chuyá»n tráº¡ng thÃ¡i ÄÆ¡n #{code} sang 'ÄÃ£ thanh toÃ¡n' (paid)"
    }

@app.post("/api/payment-webhook")
def handle_payment_webhook(data: dict):
    """Webhook nháº­n thÃ´ng bÃ¡o giao dá»ch tá»« cá»ng thanh toÃ¡n SePay/VietQR."""
    content = str(data.get("content") or data.get("transaction_content") or "").upper()
    amount_in = float(data.get("transferAmount") or data.get("amount_in") or 0)
    
    import re
    matched = re.search(r"LN\d{4,}", content)
    if matched:
        order_code = matched.group(0)
        return mark_order_paid(MarkPaidPayload(order_code=order_code, amount_in=amount_in))

_DEFAULT_SEPAY_TOKEN = "YAKFPXJ5EXEI6PHHJK3DBNO6ZQ9GWTEXT9Z2AMKWFIVLU0C7G10SVBWP5QAK3QPT"
SEPAY_API_TOKEN = os.environ.get("SEPAY_API_TOKEN") or _DEFAULT_SEPAY_TOKEN
SEPAY_ACCOUNT_NUMBER = os.environ.get("SEPAY_ACCOUNT_NUMBER", "22678555999")

@app.get("/api/check-payment")
def api_check_payment(code: Optional[str] = None, order_code: Optional[str] = None, amount: Optional[float] = 0):
    import urllib.request, ssl, re
    raw_code = (code or order_code or "").strip().upper()
    clean_code = re.sub(r"[^A-Z0-9]", "", raw_code)
    if not clean_code:
        return {"success": False, "error": "MÃ£ ÄÆ¡n hÃ ng khÃ´ng há»£p lá»", "paid": False}

    try:
        url = f"https://my.sepay.vn/userapi/transactions/list?account_number={SEPAY_ACCOUNT_NUMBER}&limit=20"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {SEPAY_API_TOKEN}",
                "Content-Type": "application/json"
            }
        )
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=8, context=ctx) as res:
            data = json.loads(res.read().decode("utf-8"))
            txs = data.get("transactions", [])
            code_digits = re.sub(r"\D", "", clean_code)

            for tx in txs:
                content = str(tx.get("transaction_content") or "").upper()
                amt_in = float(tx.get("amount_in") or 0)
                has_code = (clean_code in content) or (len(code_digits) >= 4 and code_digits in content)
                if has_code and amt_in > 0:
                    # Update status in DB
                    mark_res = mark_order_paid(MarkPaidPayload(order_code=clean_code, transaction_id=str(tx.get("id")), amount_in=amt_in))
                    return {
                        "success": True,
                        "paid": True,
                        "transaction": {
                            "id": tx.get("id"),
                            "amount_in": amt_in,
                            "transaction_date": tx.get("transaction_date"),
                            "content": content
                        },
                        "db_result": mark_res
                    }
    except Exception as e:
        print(f"[Check Payment Error]: {e}")
        return {"success": False, "error": str(e), "paid": False}

    return {"success": True, "paid": False}
    
# ==================== AI CHATBOT ASSISTANT (GEMINI HYBRID ENGINE) ====================

class ChatMessagePayload(BaseModel):
    message: str
    history: Optional[List[dict]] = []

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

LAUNHA_SYSTEM_INSTRUCTION = """
Báº¡n lÃ  Trá»£ lÃ½ AI BÃ¡n HÃ ng thÃ´ng minh, duyÃªn dÃ¡ng & tÃ¢m lÃ½ cá»§a thÆ°Æ¡ng hiá»u 'Láº©u NhÃ ' (website: laumangdi.com - Hotline/Zalo: 0819 943 904).

Báº¢NG GIÃ & KHO TRI THá»¨C CHUáº¨N XÃC:
1. BÆ¯á»C 1 - NÆ¯á»C Cá»T Láº¨U Háº¦M XÆ¯Æ NG 12H (TÃºi 1L tiá»t trÃ¹ng):
- Láº©u ThÃ¡i Tom Yum (89k): Chua cay ná»ng nÃ n (Cay vá»«a ð¶ï¸ð¶ï¸). BÃ© nhá» hoáº·c ngÆ°á»i khÃ´ng Än cay sáº½ bá» cay.
- Láº©u Náº¥m ThÆ°á»£ng Háº¡ng (89k): Ninh tá»« náº¥m tÃ¹ng nhung, ÄÃ´ng trÃ¹ng háº¡ tháº£o, tÃ¡o Äá» & ká»· tá»­. HoÃ n toÃ n 0% CAY, ngá»t thanh tá»± nhiÃªn, KHÃNG Bá»T NGá»T -> Ráº¤T Tá»T & Bá» DÆ¯á» NG CHO NGÆ¯á»I GIÃ, TRáºº NHá», Máº¸ Báº¦U, NGÆ¯á»I Bá»NH.
- Láº©u RiÃªu Cua Äá»ng (99k): RiÃªu cua giÃ£ tay thÆ¡m bÃ©o bÃ¹i, giáº¥m bá»ng chua thanh (Cay nháº¹ ð¶ï¸).
- Láº©u Tá»© XuyÃªn TiÃªu TÃª (99k): TiÃªu tÃª tháº£o má»c Trung Hoa (Cay ná»ng ð¶ï¸ð¶ï¸ð¶ï¸).

2. BÆ¯á»C 2 - SET TOPPING THá»T TÆ¯Æ I & KHAY ÄUN (1 Bá»¯a láº©u trá»n gÃ³i = NÆ°á»c láº©u + Set topping):
- Set ÄÃ´i Lá»©a (249k - cho 2-3 ngÆ°á»i): 350g ba chá» bÃ² Má»¹ & báº¯p bÃ² Ãc, 4 tÃ´m tháº» tÆ°Æ¡i, viÃªn nhÃºng, rau náº¥m, mÃ¬ + Khay nhÃ´m thá»±c pháº©m cao cáº¥p Äun trá»±c tiáº¿p. (Tá»ng combo vá»i 1 tÃºi nÆ°á»c láº©u 89k = 338k; Ã¡p mÃ£ [LAUNHA50K] cÃ²n 288k!).
- Set Gia ÄÃ¬nh (399k - cho 4-5 ngÆ°á»i - BÃ¡n cháº¡y nháº¥t): 600g bÃ² Má»¹/Ãc, 300g tÃ´m má»±c tÆ°Æ¡i, 10 viÃªn nhÃºng, 2 khay rau náº¥m, mÃ¬ tÆ°Æ¡i + MIá»N PHÃ MÆ¯á»¢N TRá»N Bá» Báº¾P Cá»N 0Ä! (Tá»ng combo vá»i nÆ°á»c láº©u = 488k; Ã¡p mÃ£ [LAUNHA50K] cÃ²n 438k!).
- Set Äáº¡i Tiá»c (599k - cho 6-8 ngÆ°á»i): 800g bÃ² thÆ°á»£ng háº¡ng, 500g háº£i sáº£n tÆ°Æ¡i, 16 viÃªn phÃ´ mai, 3 khay rau náº¥m + FREE mÆ°á»£n 2 bá» báº¿p cá»n.

3. MÃN Gá»I THÃM:
- Ba chá» bÃ² Má»¹ thÃªm 200g (65k), ViÃªn phÃ´ mai 6 viÃªn (45k), Cá»n gel (15k), BÃ¡t ÄÅ©a dÃ¹ng 1 láº§n (15k). Khay nhÃ´m Táº¶NG MIá»N PHÃ 0Ä.

4. CHÃNH SÃCH Dá»CH Vá»¤ & Æ¯U ÄÃI Äáº¶C QUYá»N HÃM NAY:
- MÃ£ giáº£m giÃ¡: [LAUNHA50K] (giáº£m ngay 50.000Ä khi Äiá»n form kháº£o sÃ¡t 30 giÃ¢y trÃªn website, mÃ£ gá»­i tháº³ng vÃ o email dÃ¹ng báº¥t cá»© lÃºc nÃ o).
- MÆ°á»£n báº¿p cá»n: ÄÆ¡n >= 399k MÆ¯á»¢N Báº¾P 0Ä. Gá»­i shipper cá»c nháº¹ 200k/báº¿p, hÃ´m sau shipper tá»± qua táº­n nÆ¡i thu há»i vÃ  hoÃ n Äá»§ 100% tiá»n cá»c 200k.
- Khay nhÃ´m Äun trá»±c tiáº¿p trÃªn báº¿p ga mini, báº¿p há»ng ngoáº¡i, báº¿p cá»n (an toÃ n chá»u nhiá»t 600Â°C). Náº¿u dÃ¹ng báº¿p tá»« thÃ¬ trÃºt vÃ o ná»i á» nhÃ  hoáº·c mÆ°á»£n báº¿p cá»n 0Ä.
- PhÃ­ ship & Freeship: Giao há»a tá»c 30-40 phÃºt qua Ahamove. DÆ°á»i 4km FREESHIP 100%, trÃªn 5km há» trá»£ chia sáº» 20k tiá»n ship cho ÄÆ¡n tá»« 399k.
- Dá»n dáº¹p Zero-Mess: Äun khay nhÃ´m vÃ  cÃ³ táº·ng tÃºi rÃ¡c, Än xong tÃºm 30 giÃ¢y vá»©t rÃ¡c, khÃ´ng cáº§n rá»­a xoong ná»i dÃ­nh má»¡.
- Cam káº¿t Äá» tÆ°Æ¡i: Nháº­p tÆ°Æ¡i má»i sÃ¡ng, kiá»m tra trÆ°á»c khi nháº­n, Äá»i má»i 1-1 há»a tá»c hoáº·c hoÃ n tiá»n 100% náº¿u khÃ´ng Æ°ng Ã½.

5. Ká»CH Báº¢N UP-SELL KHI KHÃCH DO Dá»° HOáº¶C Báº¢O "Äá» TÃI NGHÄ¨ THÃM / Äá» XEM Láº I / CHÆ¯A MUA NGAY":
- LuÃ´n thÃ¢n thiá»n, lá»ch sá»± vÃ  táº¡o cáº£m giÃ¡c thoáº£i mÃ¡i ("Dáº¡ khÃ´ng sao nÃ¨ báº¡n Æ¡i, báº¡n cá»© thong tháº£ tham kháº£o nha! â¨").
- Upsell khÃ©o lÃ©o báº±ng cÃ¡ch giá»i thiá»u 3 Æ°u ÄÃ£i hot hÃ´m nay (MÃ£ giáº£m 50k LAUNHA50K, Free mÆ°á»£n báº¿p 0Ä, Freeship Ahamove).
- HÆ°á»ng dáº«n khÃ¡ch: "Báº¡n dÃ nh 30 giÃ¢y Äiá»n báº£ng kháº£o sÃ¡t ngáº¯n á» bÃªn dÆ°á»i Äá» láº¥y vÃ  lÆ°u trÆ°á»c MÃ£ Giáº£m 50.000Ä vÃ o email nha, khi nÃ o thÃ¨m láº©u chá» cáº§n mang ra Ã¡p dá»¥ng lÃ  ÄÆ°á»£c giáº£m ngay áº¡! ð".

YÃU Cáº¦U TRáº¢ Lá»I:
- LuÃ´n thÃ¢n thiá»n, niá»m ná», tÃ¢m lÃ½, giáº£i ÄÃ¡p cáº·n káº½ vÃ  hÆ°á»ng khÃ¡ch hÃ ng chá»n combo phÃ¹ há»£p nháº¥t.
- Sá»­ dá»¥ng emoji sinh Äá»ng. DÃ¹ng cÃ¡c tháº» HTML cÆ¡ báº£n (<strong>, <br>, â¢) Äá» hiá»n thá» Äáº¹p máº¯t trÃªn widget chat.
- Tráº£ lá»i gá»n gÃ ng, sÃºc tÃ­ch (khoáº£ng 80 - 160 tá»«).
"""

@app.post("/api/chat")
def chat_with_gemini(p: ChatMessagePayload):
    user_msg = (p.message or "").strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Tin nháº¯n khÃ´ng ÄÆ°á»£c Äá» trá»ng")

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

    # Äá»nh dáº¡ng CTA buttons thÃ´ng minh theo ngá»¯ cáº£nh
    msg_lower = user_msg.lower()
    
    # 1. Náº¿u khÃ¡ch do dá»± / há»i vá» kháº£o sÃ¡t / voucher -> Æ¯u tiÃªn nÃºt dáº«n vá» Báº£ng kháº£o sÃ¡t
    if any(k in msg_lower for k in ["nghÄ© thÃªm", "nghi them", "suy nghÄ©", "suy nghi", "xem láº¡i", "xem lai", "chÆ°a mua", "chua mua", "Äang phÃ¢n vÃ¢n", "phan van", "Äá» khi khÃ¡c", "de khi khac", "Äá» xem", "de xem", "kháº£o sÃ¡t", "khao sat", "voucher", "mÃ£ giáº£m", "ma giam"]):
        cta = [
            {"text": "ð ÄIá»N KHáº¢O SÃT NHáº¬N MÃ 50K", "action": "survey", "primary": True},
            {"text": "ð¥ Xem Láº¡i Menu Láº©u", "action": "order", "primary": False}
        ]
    elif "zalo" in msg_lower or "hotline" in msg_lower:
        cta = [
            {"text": "ð¬ Nháº¯n Qua Zalo (0819 943 904)", "action": "zalo", "primary": True},
            {"text": "ð¥ Äáº·t Láº©u Trá»±c Tiáº¿p", "action": "order", "primary": False}
        ]
    else:
        cta = [
            {"text": "ð¥ Tá»° MIX SET Láº¨U (GIáº¢M 50K)", "action": "order", "primary": True},
            {"text": "ð Kháº£o SÃ¡t Nháº­n MÃ£ 50K", "action": "survey", "primary": False}
        ]

    return {
        "success": True,
        "reply": reply_text,
        "cta": cta
    }


# ==================== STATIC & ADMIN ROUTES ====================

@app.get("/admin/migrate-sprint1")
@app.post("/admin/migrate-sprint1")
@app.get("/api/migrate-sprint1")
@app.post("/api/migrate-sprint1")
def migrate_sprint1():
    """Run the Sprint 1 database migration with a timestamped backup."""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail=f"Database not found: {db_path}")
    backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    try:
        import shutil
        shutil.copy2(db_path, backup_path)
        conn = sqlite3.connect(db_path, timeout=30.0)
        conn.execute("PRAGMA foreign_keys = ON")
        cursor = conn.cursor()
        try:
            cursor.execute("""CREATE TABLE IF NOT EXISTS raw_events (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, raw_payload TEXT NOT NULL, message_id TEXT UNIQUE, received_at TEXT DEFAULT (datetime('now', 'localtime')), status TEXT DEFAULT 'pending')""")
            cursor.execute("""CREATE TABLE IF NOT EXISTS parse_results (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER, parsed_data TEXT NOT NULL, confidence_score REAL, status TEXT DEFAULT 'needs_review', parser_version TEXT, created_at TEXT DEFAULT (datetime('now', 'localtime')), FOREIGN KEY (event_id) REFERENCES raw_events(id) ON DELETE CASCADE)""")
            cursor.execute("""CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT, entity_id INTEGER, action TEXT, old_value TEXT, new_value TEXT, changed_by TEXT, timestamp TEXT DEFAULT (datetime('now', 'localtime')))""")
            for col_name, col_type in {"source_event_id":"INTEGER", "confirmed_at":"TEXT", "confirmed_by":"TEXT", "state":"TEXT DEFAULT 'CONFIRMED'"}.items():
                try: cursor.execute(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}")
                except sqlite3.OperationalError: pass
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_events_msg_id ON raw_events(message_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_parse_results_event_id ON parse_results(event_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_state ON orders(state)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_source_event ON orders(source_event_id)")
            cursor.execute("UPDATE orders SET state = 'CONFIRMED' WHERE state IS NULL OR state = 'pending'")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally: conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sprint 1 migration failed: {e}")
    return {"success": True, "message": "Sprint 1 migration completed", "backup_path": backup_path}



# ==================== MCP API ENDPOINTS ====================
try:
    from mcp_server import get_daily_summary as mcp_get_summary, check_order_and_payment as mcp_check_order, create_manual_order as mcp_create_order

    @app.get("/api/mcp/summary")
    def api_mcp_summary(date: str = "today"):
        return mcp_get_summary(date)

    @app.get("/api/mcp/check-order")
    def api_mcp_check_order(order_code: Optional[str] = None, phone: Optional[str] = None):
        return mcp_check_order(order_code, phone)

    class MCPCreateOrderPayload(BaseModel):
        customer_name: str
        phone: str
        address: str
        product_name: Optional[str] = "Set Lẩu Cặp Đôi (2-3 người)"
        amount: Optional[float] = 299000
        is_stove: Optional[bool] = False
        email: Optional[str] = None
        note: Optional[str] = None

    @app.post("/api/mcp/create-order")
    def api_mcp_create_order(payload: MCPCreateOrderPayload):
        return mcp_create_order(
            customer_name=payload.customer_name,
            phone=payload.phone,
            address=payload.address,
            product_name=payload.product_name or "Set Lẩu Cặp Đôi (2-3 người)",
            amount=payload.amount or 299000,
            is_stove=payload.is_stove or False,
            email=payload.email,
            note=payload.note
        )
except Exception as mcp_err:
    print(f"[MCP Endpoint Init Warning]: {mcp_err}")


@app.get("/admin")
@app.get("/admin/")
def get_admin_page():
    admin_html = os.path.join(BASE_DIR, "admin", "index.html")
    if os.path.exists(admin_html):
        return FileResponse(admin_html)
    return HTMLResponse("<h1>Admin Panel</h1><p>Vui lÃ²ng táº¡o admin/index.html</p>")

# Mount static files for the main site if needed
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    print(f"ð Äang khá»i Äá»ng Admin Server táº¡i http://0.0.0.0:{port}/admin ...")
    uvicorn.run(app, host="0.0.0.0", port=port)
