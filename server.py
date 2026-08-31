import os
import sqlite3
import sys
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from pydantic import BaseModel

# Ensure UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATHS = [
    os.path.join(BASE_DIR, "My-Brain", "brain.db"),
    r"d:\BO\My-Brain\brain.db",
]

def get_db_path():
    for p in DB_PATHS:
        if os.path.exists(p):
            return p
    return DB_PATHS[0]

def get_conn():
    path = get_db_path()
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
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
                conn = sqlite3.connect(path, timeout=5)
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

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    zalo: Optional[str] = None

class OrderCreate(BaseModel):
    customer_id: int
    product_id: int
    amount: Optional[float] = None
    status: Optional[str] = "pending"
    quantity: Optional[int] = 1

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


# ==================== CUSTOMERS API ====================

@app.get("/api/customers")
def list_customers():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM customers ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/customers")
def create_customer(c: CustomerCreate):
    if not c.name.strip():
        raise HTTPException(status_code=400, detail="Tên khách hàng không được để trống")

    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO customers (name, phone, zalo) VALUES (?, ?, ?)",
        (c.name.strip(), c.phone.strip() if c.phone else None, c.zalo.strip() if c.zalo else None)
    )
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    sync_all_dbs(
        "INSERT OR REPLACE INTO customers (id, name, phone, zalo) VALUES (?, ?, ?, ?)",
        (new_id, c.name.strip(), c.phone.strip() if c.phone else None, c.zalo.strip() if c.zalo else None)
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
    phone = c.phone.strip() if c.phone is not None else existing["phone"]
    zalo = c.zalo.strip() if c.zalo is not None else existing["zalo"]

    conn.execute(
        "UPDATE customers SET name = ?, phone = ?, zalo = ? WHERE id = ?",
        (name, phone, zalo, customer_id)
    )
    conn.commit()
    conn.close()

    sync_all_dbs(
        "UPDATE customers SET name = ?, phone = ?, zalo = ? WHERE id = ?",
        (name, phone, zalo, customer_id)
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
            o.customer_id, 
            c.name AS customer_name, 
            c.phone AS customer_phone,
            c.zalo AS customer_zalo,
            o.product_id, 
            p.name AS product_name, 
            p.type AS product_type,
            p.stock AS current_stock,
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
    return [dict(r) for r in rows]

@app.post("/api/orders")
def create_order(o: OrderCreate):
    conn = get_conn()
    
    # 1. Kiểm tra khách hàng
    customer = conn.execute("SELECT * FROM customers WHERE id = ?", (o.customer_id,)).fetchone()
    if not customer:
        conn.close()
        raise HTTPException(status_code=400, detail="Khách hàng không tồn tại")

    # 2. Kiểm tra sản phẩm
    product = conn.execute("SELECT * FROM products WHERE id = ?", (o.product_id,)).fetchone()
    if not product:
        conn.close()
        raise HTTPException(status_code=400, detail="Sản phẩm không tồn tại")

    # Tính số tiền nếu không truyền
    qty = max(1, o.quantity or 1)
    amount = o.amount if (o.amount is not None and o.amount >= 0) else (product["price"] * qty)

    # 3. Xử lý tồn kho: Chỉ tự động trừ nếu là sản phẩm vật lý (physical)
    stock_deducted = False
    new_stock = None
    if product["type"] == "physical":
        curr_stock = product["stock"] if product["stock"] is not None else 0
        if curr_stock < qty:
            conn.close()
            raise HTTPException(status_code=400, detail=f"Sản phẩm vật lý chỉ còn tồn kho {curr_stock}, không đủ để tạo đơn ({qty})")
        
        new_stock = curr_stock - qty
        conn.execute("UPDATE products SET stock = ? WHERE id = ?", (new_stock, product["id"]))
        stock_deducted = True

    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO orders (customer_id, product_id, amount, status) VALUES (?, ?, ?, ?)",
        (o.customer_id, o.product_id, amount, o.status or "pending")
    )
    order_id = cursor.lastrowid
    conn.commit()
    conn.close()

    # Sync
    if stock_deducted:
        sync_all_dbs("UPDATE products SET stock = ? WHERE id = ?", (new_stock, product["id"]))
    sync_all_dbs(
        "INSERT OR REPLACE INTO orders (id, customer_id, product_id, amount, status) VALUES (?, ?, ?, ?, ?)",
        (order_id, o.customer_id, o.product_id, amount, o.status or "pending")
    )

    msg = "Tạo đơn hàng thành công"
    if stock_deducted:
        msg += f" (Đã tự động trừ {qty} tồn kho, còn lại: {new_stock})"
    else:
        msg += f" (Sản phẩm loại '{product['type']}' - Không trừ tồn kho)"

    return {
        "success": True, 
        "id": order_id, 
        "message": msg,
        "stock_deducted": stock_deducted,
        "remaining_stock": new_stock
    }

@app.put("/api/orders/{order_id}")
def update_order(order_id: int, o: OrderUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    cust_id = o.customer_id if o.customer_id is not None else existing["customer_id"]
    prod_id = o.product_id if o.product_id is not None else existing["product_id"]
    amount = o.amount if o.amount is not None else existing["amount"]
    status = o.status if o.status is not None else existing["status"]

    conn.execute(
        "UPDATE orders SET customer_id = ?, product_id = ?, amount = ?, status = ? WHERE id = ?",
        (cust_id, prod_id, amount, status, order_id)
    )
    conn.commit()
    conn.close()

    sync_all_dbs(
        "UPDATE orders SET customer_id = ?, product_id = ?, amount = ?, status = ? WHERE id = ?",
        (cust_id, prod_id, amount, status, order_id)
    )

    return {"success": True, "message": "Cập nhật đơn hàng thành công"}

@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    conn.execute("DELETE FROM orders WHERE id = ?", (order_id,))
    conn.commit()
    conn.close()

    sync_all_dbs("DELETE FROM orders WHERE id = ?", (order_id,))
    return {"success": True, "message": "Đã xóa đơn hàng"}


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
    address = (data.cust_address or "").strip()
    order_code = (data.order_code or "").strip()
    items = data.items or []

    if not name or not phone:
        raise HTTPException(status_code=400, detail="Thiếu thông tin họ tên hoặc số điện thoại")

    conn = get_conn()
    cursor = conn.cursor()

    # 1. Tìm hoặc tạo mới khách hàng trong bảng customers
    cust_row = conn.execute("SELECT id FROM customers WHERE phone = ? LIMIT 1", (phone,)).fetchone()
    if cust_row:
        customer_id = cust_row["id"]
        # Cập nhật tên nếu có
        conn.execute("UPDATE customers SET name = ? WHERE id = ?", (name, customer_id))
    else:
        cursor.execute(
            "INSERT INTO customers (name, phone, zalo) VALUES (?, ?, ?)",
            (name, phone, phone)
        )
        customer_id = cursor.lastrowid
        sync_all_dbs(
            "INSERT OR REPLACE INTO customers (id, name, phone, zalo) VALUES (?, ?, ?, ?)",
            (customer_id, name, phone, phone)
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
            "INSERT INTO orders (customer_id, product_id, amount, status) VALUES (?, ?, ?, 'pending')",
            (customer_id, product_id, item_total)
        )
        ord_id = cursor.lastrowid
        sync_all_dbs(
            "INSERT OR REPLACE INTO orders (id, customer_id, product_id, amount, status) VALUES (?, ?, ?, ?, 'pending')",
            (ord_id, customer_id, product_id, item_total)
        )
        created_orders.append(ord_id)

    conn.commit()
    conn.close()

    return {
        "success": True,
        "order_code": order_code,
        "customer_id": customer_id,
        "orders_created": created_orders,
        "message": "Đã lưu đơn hàng và thông tin khách hàng vào database"
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
    print("🚀 Đang khởi động Admin Server tại http://localhost:8000/admin ...")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
