import os
import sqlite3
import sys
from datetime import datetime

# Ensure UTF-8 output on Windows console
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "brain.db"))
FALLBACK_PATH = r"d:\BO\My-Brain\brain.db"

def create_database(target_path=DB_PATH):
    print(f"\n📦 Khởi tạo / Đồng bộ database: {target_path}")
    conn = sqlite3.connect(target_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    # --- Bảng knowledge: lưu bài học, insight ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS knowledge (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    """)

    # --- Bảng business: lưu sản phẩm, khách hàng ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS business (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    """)

    # --- Bảng brand_voice: lưu giọng văn, tone, style ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS brand_voice (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    """)

    # --- Bảng products: sản phẩm (physical, digital, service) ---
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

    # --- Bảng customers: khách hàng ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            zalo TEXT,
            registered_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    """)

    # --- Bảng orders: đơn hàng ---
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

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_products_type ON products(type)")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Dữ liệu mẫu ban đầu nếu bảng rỗng
    cursor.execute("SELECT COUNT(*) FROM knowledge")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO knowledge (title, content, created_at) VALUES (?, ?, ?)",
            [
                ("Nguyên tắc 80/20", "80% kết quả đến từ 20% nỗ lực. Tập trung vào những việc tạo ra đòn bẩy lớn nhất thay vì làm mọi thứ.", now),
                ("Học qua hành động", "Cách học nhanh nhất là làm thật, sai thật, rút bài học thật. Đọc 10 cuốn sách không bằng thực chiến 1 dự án.", now),
            ],
        )

    cursor.execute("SELECT COUNT(*) FROM business")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO business (title, content, created_at) VALUES (?, ?, ?)",
            [
                ("Sản phẩm: Khóa học AI cho người mới", "Khóa học online 8 tuần, dạy ứng dụng AI vào công việc hàng ngày. Đối tượng: freelancer, chủ shop, nhân viên văn phòng.", now),
                ("Khách hàng mục tiêu", "Người 25-40 tuổi, muốn tăng năng suất bằng công nghệ, sẵn sàng đầu tư học nhưng không có nhiều thời gian.", now),
            ],
        )

    cursor.execute("SELECT COUNT(*) FROM brand_voice")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO brand_voice (title, content, created_at) VALUES (?, ?, ?)",
            [
                ("Tone chính: Thực chiến & Gần gũi", "Viết như đang nói chuyện với bạn bè. Không dùng từ hàn lâm. Luôn kèm ví dụ thực tế. Ngắn gọn, đi thẳng vào vấn đề.", now),
                ("Style: Storytelling có số liệu", "Mở đầu bằng câu chuyện hoặc tình huống thực. Chốt bằng insight rõ ràng. Dùng số liệu để tăng độ tin cậy.", now),
            ],
        )

    conn.commit()

    # --- Xác nhận kết quả ---
    for table in ["knowledge", "business", "brand_voice", "products", "customers", "orders"]:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"✅ Bảng '{table}': {count} dòng")

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"📋 Các bảng: {', '.join(tables)}")

    conn.close()
    print("🧠 Brain database đã sẵn sàng!\n")


if __name__ == "__main__":
    create_database(DB_PATH)
    if os.path.exists(os.path.dirname(FALLBACK_PATH)):
        create_database(FALLBACK_PATH)
