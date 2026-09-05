import sqlite3
import os
import shutil
from datetime import datetime

# Cấu hình đường dẫn DB
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "My-Brain", "brain.db")

def backup_database():
    if not os.path.exists(DB_PATH):
        print(f"❌ Không tìm thấy database tại: {DB_PATH}")
        return False
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BASE_DIR, "My-Brain", f"brain_backup_{timestamp}.db")
    try:
        shutil.copy2(DB_PATH, backup_path)
        print(f"🛡️ Đã tạo bản snapshot backup an toàn tại: {backup_path}")
        return True
    except Exception as e:
        print(f"❌ Không thể backup database: {e}")
        return False

def migrate():
    if not backup_database():
        print("⛔ Dừng migration để đảm bảo an toàn dữ liệu.")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    print("\n🚀 Bắt đầu Migration Sprint 1: Nền tảng dữ liệu Cá Mèo Hub...")

    try:
        # 1. Tạo bảng raw_events (Phễu tiếp nhận)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS raw_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL, 
                raw_payload TEXT NOT NULL,
                message_id TEXT UNIQUE, 
                received_at TEXT DEFAULT (datetime('now', 'localtime')),
                status TEXT DEFAULT 'pending'
            )
        """)
        print("✅ Đã tạo/kiểm tra bảng: raw_events")

        # 2. Tạo bảng parse_results (Kết quả AI)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS parse_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER,
                parsed_data TEXT NOT NULL, 
                confidence_score REAL,
                status TEXT DEFAULT 'needs_review', 
                parser_version TEXT,
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (event_id) REFERENCES raw_events(id) ON DELETE CASCADE
            )
        """)
        print("✅ Đ violent/kiểm tra bảng: parse_results")

        # 3. Tạo bảng audit_logs (Truy vết)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT,
                entity_id INTEGER,
                action TEXT,
                old_value TEXT,
                new_value TEXT,
                changed_by TEXT,
                timestamp TEXT DEFAULT (datetime('now', 'localtime'))
            )
        """)
        print("✅ Đã tạo/kiểm tra bảng: audit_logs")

        # 4. Nâng cấp bảng orders (Thêm cột vận hành)
        columns_to_add = {
            "source_event_id": "INTEGER",
            "confirmed_at": "TEXT",
            "confirmed_by": "TEXT",
            "state": "TEXT DEFAULT 'CONFIRMED'"
        }
        
        for col_name, col_type in columns_to_add.items():
            try:
                cursor.execute(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}")
                print(f"✅ Đã thêm cột [{col_name}] vào bảng orders")
            except sqlite3.OperationalError:
                print(f"ℹ️ Cột [{col_name}] đã tồn tại trong bảng orders, bỏ qua.")

        # 5. Đánh Index tối ưu tốc độ truy vấn
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_events_msg_id ON raw_events(message_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_parse_results_event_id ON parse_results(event_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_state ON orders(state)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_source_event ON orders(source_event_id)")
        # 4b. Soft delete columns for orders & customers
        for col_name, col_type in [("is_deleted", "INTEGER DEFAULT 0"), ("deleted_at", "TEXT"), ("address", "TEXT")]:
            try:
                cursor.execute(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}")
                print(f"✅ Đã thêm cột [{col_name}] vào bảng orders")
            except Exception:
                pass

        for col_name, col_type in [("is_deleted", "INTEGER DEFAULT 0"), ("deleted_at", "TEXT"), ("address", "TEXT")]:
            try:
                cursor.execute(f"ALTER TABLE customers ADD COLUMN {col_name} {col_type}")
                print(f"✅ Đã thêm cột [{col_name}] vào bảng customers")
            except Exception:
                pass

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_is_deleted ON orders(is_deleted)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_customers_is_deleted ON customers(is_deleted)")

        print("✅ Đã thiết lập Database Indexes cho truy vấn thời gian thực")

        # 6. Chuẩn hóa dữ liệu cũ
        cursor.execute("UPDATE orders SET state = 'CONFIRMED' WHERE state IS NULL OR state = 'pending'")
        print("✅ Đã chuẩn hóa trạng thái legacy orders sang 'CONFIRMED'")

        # Commit toàn bộ transaction
        conn.commit()
        print("\n🎉 MIGRATION HOÀN TẤT THÀNH CÔNG! Database đã sẵn sàng cho Sprint 2.")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Lỗi trong quá trình Migration: {e}")
        print("⚠️ Toàn bộ thay đổi đã được Rollback. Database giữ nguyên trạng thái cũ.")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
