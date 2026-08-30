import sqlite3
from datetime import datetime

DB_PATH = r"d:\BO\My-Brain\brain.db"

def create_database():
    conn = sqlite3.connect(DB_PATH)
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

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # --- Dữ liệu mẫu: knowledge ---
    cursor.executemany(
        "INSERT INTO knowledge (title, content, created_at) VALUES (?, ?, ?)",
        [
            (
                "Nguyên tắc 80/20",
                "80% kết quả đến từ 20% nỗ lực. Tập trung vào những việc tạo ra đòn bẩy lớn nhất thay vì làm mọi thứ.",
                now,
            ),
            (
                "Học qua hành động",
                "Cách học nhanh nhất là làm thật, sai thật, rút bài học thật. Đọc 10 cuốn sách không bằng thực chiến 1 dự án.",
                now,
            ),
        ],
    )

    # --- Dữ liệu mẫu: business ---
    cursor.executemany(
        "INSERT INTO business (title, content, created_at) VALUES (?, ?, ?)",
        [
            (
                "Sản phẩm: Khóa học AI cho người mới",
                "Khóa học online 8 tuần, dạy ứng dụng AI vào công việc hàng ngày. Đối tượng: freelancer, chủ shop, nhân viên văn phòng.",
                now,
            ),
            (
                "Khách hàng mục tiêu",
                "Người 25-40 tuổi, muốn tăng năng suất bằng công nghệ, sẵn sàng đầu tư học nhưng không có nhiều thời gian.",
                now,
            ),
        ],
    )

    # --- Dữ liệu mẫu: brand_voice ---
    cursor.executemany(
        "INSERT INTO brand_voice (title, content, created_at) VALUES (?, ?, ?)",
        [
            (
                "Tone chính: Thực chiến & Gần gũi",
                "Viết như đang nói chuyện với bạn bè. Không dùng từ hàn lâm. Luôn kèm ví dụ thực tế. Ngắn gọn, đi thẳng vào vấn đề.",
                now,
            ),
            (
                "Style: Storytelling có số liệu",
                "Mở đầu bằng câu chuyện hoặc tình huống thực. Chốt bằng insight rõ ràng. Dùng số liệu để tăng độ tin cậy.",
                now,
            ),
        ],
    )

    conn.commit()

    # --- Xác nhận kết quả ---
    for table in ["knowledge", "business", "brand_voice"]:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"✅ Bảng '{table}': {count} dòng")

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"\n📦 Database: {DB_PATH}")
    print(f"📋 Các bảng: {', '.join(tables)}")

    conn.close()
    print("\n🧠 Brain database đã sẵn sàng!")


if __name__ == "__main__":
    create_database()
