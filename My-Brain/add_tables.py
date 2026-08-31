import os
import sqlite3
import sys

# Ensure UTF-8 output on Windows console
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

DB_PATHS = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "brain.db")),
    r"d:\BO\My-Brain\brain.db",
]

def update_db(db_path):
    if not os.path.exists(os.path.dirname(db_path)):
        print(f"Directory for {db_path} does not exist. Skipping.")
        return

    print(f"\n==========================================")
    print(f" Đang cập nhật database: {db_path}")
    print(f"==========================================")

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    # 1. Bảng products (sản phẩm)
    # Lưu tên, loại (physical/digital/service), giá, mô tả, số lượng còn lại (bắt buộc với physical, có thể null với digital/service)
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

    # 2. Bảng customers (khách hàng)
    # Lưu tên, số điện thoại, zalo, ngày đăng ký
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            zalo TEXT,
            registered_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    """)

    # 3. Bảng orders (đơn hàng)
    # Lưu khách hàng nào mua sản phẩm gì, số tiền, trạng thái đơn hàng, ngày mua
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            amount REAL NOT NULL CHECK(amount >= 0),
            status TEXT NOT NULL DEFAULT 'pending',
            order_date TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
        )
    """)

    # Tạo chỉ mục (indexes) để truy vấn nhanh
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_products_type ON products(type)")

    conn.commit()

    # Kiểm tra số lượng dòng hiện tại
    for tbl in ["products", "customers", "orders"]:
        cursor.execute(f"SELECT COUNT(*) FROM {tbl}")
        count = cursor.fetchone()[0]
        print(f"✅ Bảng '{tbl}': {count} dòng hiện có")

    # Liệt kê tất cả các bảng trong DB
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"\n📋 Danh sách bảng trong DB: {', '.join(tables)}")

    conn.close()

def seed_sample_data(db_path):
    if not os.path.exists(db_path):
        return

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        print(f"\n--- Thêm dữ liệu mẫu vào {db_path} ---")
        
        # Thêm sản phẩm mẫu (physical, digital, service)
        sample_products = [
            ("Set Lẩu Thái Tomyum Mang Đi (2-3 người)", "physical", 299000, "Set lẩu gồm cốt tomyum tươi, bò ba chỉ Mỹ, tôm tươi, viên thả lẩu, rau nấm sạch và kit dọn 30s", 50),
            ("Set Lẩu Riêu Cua Bắp Bò (3-4 người)", "physical", 399000, "Set lẩu riêu cua đồng xịn, bắp bò hoa, sườn sụn, giò sống, mướp mồng tơi và kit dọn 30s", 30),
            ("Ebook: 100 Công thức Nước Cốt Lẩu Chuẩn Vị", "digital", 99000, "Ebook PDF hướng dẫn chi tiết bí quyết ninh cốt và canh chỉnh gia vị tự nhiên", None),
            ("Dịch vụ Setup Tiệc Lẩu Tại Gia (Full Gói)", "service", 500000, "Nhân viên đến tận nơi chuẩn bị bàn tiệc, cho mượn bếp nồi và dọn dẹp sạch sẽ sau tiệc", None),
        ]
        cursor.executemany(
            "INSERT INTO products (name, type, price, description, stock) VALUES (?, ?, ?, ?, ?)",
            sample_products
        )

        # Thêm khách hàng mẫu
        sample_customers = [
            ("Nguyễn Văn An", "0901234567", "0901234567"),
            ("Trần Thị Mai", "0912345678", "zalo_mai_tran"),
            ("Lê Hoàng Nam", "0987654321", "0987654321"),
        ]
        cursor.executemany(
            "INSERT INTO customers (name, phone, zalo) VALUES (?, ?, ?)",
            sample_customers
        )

        # Thêm đơn hàng mẫu
        sample_orders = [
            (1, 1, 299000, "completed"),
            (2, 3, 99000, "completed"),
            (3, 2, 399000, "paid"),
            (1, 4, 500000, "pending"),
        ]
        cursor.executemany(
            "INSERT INTO orders (customer_id, product_id, amount, status) VALUES (?, ?, ?, ?)",
            sample_orders
        )

        conn.commit()
        print("✅ Đã thêm dữ liệu mẫu thành công!")

    conn.close()

def test_constraints(db_path):
    print(f"\n--- Kiểm tra ràng buộc (Constraints Check) ---")
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    # Test: physical product without stock must fail
    try:
        cursor.execute("INSERT INTO products (name, type, price, stock) VALUES ('Lỗi Test', 'physical', 100000, NULL)")
        print("❌ Lỗi: Ràng buộc stock cho physical product không hoạt động!")
    except sqlite3.IntegrityError as e:
        print(f"✅ Ràng buộc chuẩn: Sản phẩm physical bắt buộc có stock (IntegrityError: {e})")

    # Test: digital product with NULL stock must succeed
    try:
        cursor.execute("INSERT INTO products (name, type, price, stock) VALUES ('Khoá học Test', 'digital', 50000, NULL)")
        conn.commit()
        cursor.execute("DELETE FROM products WHERE name = 'Khoá học Test'")
        conn.commit()
        print("✅ Ràng buộc chuẩn: Sản phẩm digital/service cho phép stock NULL.")
    except Exception as e:
        print(f"❌ Lỗi khi thêm digital product với NULL stock: {e}")

    conn.close()

if __name__ == "__main__":
    for db_p in set(DB_PATHS):
        if os.path.exists(os.path.dirname(db_p)):
            update_db(db_p)
            seed_sample_data(db_p)
            test_constraints(db_p)
