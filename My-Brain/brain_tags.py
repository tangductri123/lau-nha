"""
brain_tags.py - Hệ thống Tags cho Brain Database
Thêm tags, gắn tag vào items, tìm kiếm theo tag.

Cách dùng:
    python brain_tags.py add <tag_name> [--color #hex]
    python brain_tags.py list
    python brain_tags.py tag <table> <item_id> <tag_name>
    python brain_tags.py untag <table> <item_id> <tag_name>
    python brain_tags.py search <tag_name>
    python brain_tags.py show <table> <item_id>
"""

import sqlite3
import sys
from datetime import datetime

DB_PATH = r"d:\BO\My-Brain\brain.db"
VALID_TABLES = ["knowledge", "business", "brand_voice"]


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_tags_tables():
    """Tao bang tags va item_tags neu chua co."""
    conn = get_conn()
    cursor = conn.cursor()

    # --- Bang tags ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#3B82F6',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    """)

    # --- Bang lien ket: 1 bang chung cho tat ca tables ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS item_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag_id INTEGER NOT NULL,
            table_name TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
            UNIQUE(tag_id, table_name, item_id)
        )
    """)

    # Index de search nhanh
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_item_tags_lookup
        ON item_tags(table_name, item_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_item_tags_tag
        ON item_tags(tag_id)
    """)

    conn.commit()
    conn.close()


def add_tag(name, color="#3B82F6"):
    """Them tag moi."""
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO tags (name, color) VALUES (?, ?)",
            (name.lower().strip(), color),
        )
        conn.commit()
        print(f"[+] Da tao tag '{name}' (color: {color})")
    except sqlite3.IntegrityError:
        print(f"[!] Tag '{name}' da ton tai.")
    finally:
        conn.close()


def list_tags():
    """Liet ke tat ca tags va so luong items."""
    conn = get_conn()
    rows = conn.execute("""
        SELECT t.id, t.name, t.color,
               COUNT(it.id) as item_count
        FROM tags t
        LEFT JOIN item_tags it ON t.id = it.tag_id
        GROUP BY t.id
        ORDER BY item_count DESC, t.name
    """).fetchall()
    conn.close()

    if not rows:
        print("[i] Chua co tag nao.")
        return

    print(f"\n{'ID':<5} {'Tag':<20} {'Color':<10} {'Items':<6}")
    print("-" * 45)
    for r in rows:
        print(f"{r['id']:<5} {r['name']:<20} {r['color']:<10} {r['item_count']:<6}")
    print(f"\nTong: {len(rows)} tags")


def tag_item(table_name, item_id, tag_name):
    """Gan tag vao 1 item."""
    if table_name not in VALID_TABLES:
        print(f"[!] Table khong hop le. Chon: {', '.join(VALID_TABLES)}")
        return

    conn = get_conn()

    # Kiem tra item co ton tai khong
    item = conn.execute(
        f"SELECT id, title FROM {table_name} WHERE id = ?", (item_id,)
    ).fetchone()
    if not item:
        print(f"[!] Khong tim thay item id={item_id} trong bang '{table_name}'.")
        conn.close()
        return

    # Tim hoac tao tag
    tag = conn.execute(
        "SELECT id FROM tags WHERE name = ?", (tag_name.lower().strip(),)
    ).fetchone()
    if not tag:
        conn.execute("INSERT INTO tags (name) VALUES (?)", (tag_name.lower().strip(),))
        conn.commit()
        tag = conn.execute(
            "SELECT id FROM tags WHERE name = ?", (tag_name.lower().strip(),)
        ).fetchone()
        print(f"[+] Tu dong tao tag '{tag_name}'.")

    # Gan tag
    try:
        conn.execute(
            "INSERT INTO item_tags (tag_id, table_name, item_id) VALUES (?, ?, ?)",
            (tag["id"], table_name, item_id),
        )
        conn.commit()
        print(f"[+] Gan tag '{tag_name}' -> {table_name}#{item_id} ({item['title']})")
    except sqlite3.IntegrityError:
        print(f"[!] Item nay da co tag '{tag_name}' roi.")
    finally:
        conn.close()


def untag_item(table_name, item_id, tag_name):
    """Go tag khoi 1 item."""
    conn = get_conn()
    tag = conn.execute(
        "SELECT id FROM tags WHERE name = ?", (tag_name.lower().strip(),)
    ).fetchone()
    if not tag:
        print(f"[!] Khong tim thay tag '{tag_name}'.")
        conn.close()
        return

    deleted = conn.execute(
        "DELETE FROM item_tags WHERE tag_id = ? AND table_name = ? AND item_id = ?",
        (tag["id"], table_name, item_id),
    ).rowcount
    conn.commit()
    conn.close()

    if deleted:
        print(f"[-] Da go tag '{tag_name}' khoi {table_name}#{item_id}")
    else:
        print(f"[!] Item nay khong co tag '{tag_name}'.")


def search_by_tag(tag_name):
    """Tim tat ca items co tag nay."""
    conn = get_conn()
    tag = conn.execute(
        "SELECT id, name FROM tags WHERE name = ?", (tag_name.lower().strip(),)
    ).fetchone()
    if not tag:
        print(f"[!] Khong tim thay tag '{tag_name}'.")
        conn.close()
        return

    links = conn.execute(
        "SELECT table_name, item_id FROM item_tags WHERE tag_id = ?", (tag["id"],)
    ).fetchall()

    if not links:
        print(f"[i] Tag '{tag_name}' chua duoc gan cho item nao.")
        conn.close()
        return

    print(f"\n=== Ket qua cho tag: [{tag_name}] ({len(links)} items) ===\n")

    for link in links:
        tbl = link["table_name"]
        item = conn.execute(
            f"SELECT id, title, content FROM {tbl} WHERE id = ?", (link["item_id"],)
        ).fetchone()
        if item:
            snippet = (item["content"] or "")[:80]
            print(f"  [{tbl}] #{item['id']} - {item['title']}")
            print(f"           {snippet}...")
            print()

    conn.close()


def show_item_tags(table_name, item_id):
    """Hien thi tat ca tags cua 1 item."""
    if table_name not in VALID_TABLES:
        print(f"[!] Table khong hop le. Chon: {', '.join(VALID_TABLES)}")
        return

    conn = get_conn()
    item = conn.execute(
        f"SELECT id, title, content FROM {table_name} WHERE id = ?", (item_id,)
    ).fetchone()
    if not item:
        print(f"[!] Khong tim thay item id={item_id} trong bang '{table_name}'.")
        conn.close()
        return

    tags = conn.execute("""
        SELECT t.name, t.color
        FROM tags t
        JOIN item_tags it ON t.id = it.tag_id
        WHERE it.table_name = ? AND it.item_id = ?
        ORDER BY t.name
    """, (table_name, item_id)).fetchall()
    conn.close()

    print(f"\n=== {table_name}#{item_id}: {item['title']} ===")
    print(f"    {(item['content'] or '')[:120]}")
    if tags:
        tag_str = ", ".join(f"[{t['name']}]" for t in tags)
        print(f"    Tags: {tag_str}")
    else:
        print("    Tags: (chua co)")


def seed_sample_tags():
    """Them du lieu mau: tags + gan vao items co san."""
    conn = get_conn()

    sample_tags = [
        ("productivity", "#10B981"),
        ("mindset", "#8B5CF6"),
        ("ai", "#F59E0B"),
        ("marketing", "#EF4444"),
        ("content", "#3B82F6"),
        ("strategy", "#EC4899"),
    ]

    for name, color in sample_tags:
        try:
            conn.execute(
                "INSERT INTO tags (name, color) VALUES (?, ?)", (name, color)
            )
        except sqlite3.IntegrityError:
            pass

    conn.commit()

    # Gan tags vao items mau
    sample_links = [
        # knowledge#1 (80/20) -> productivity, strategy
        ("knowledge", 1, "productivity"),
        ("knowledge", 1, "strategy"),
        # knowledge#2 (hoc qua hanh dong) -> mindset
        ("knowledge", 2, "mindset"),
        # business#1 (khoa hoc AI) -> ai, marketing
        ("business", 1, "ai"),
        ("business", 1, "marketing"),
        # business#2 (khach hang) -> marketing, strategy
        ("business", 2, "marketing"),
        ("business", 2, "strategy"),
        # brand_voice#1 (tone) -> content
        ("brand_voice", 1, "content"),
        # brand_voice#2 (style) -> content, marketing
        ("brand_voice", 2, "content"),
        ("brand_voice", 2, "marketing"),
    ]

    for tbl, item_id, tag_name in sample_links:
        tag = conn.execute(
            "SELECT id FROM tags WHERE name = ?", (tag_name,)
        ).fetchone()
        if tag:
            try:
                conn.execute(
                    "INSERT INTO item_tags (tag_id, table_name, item_id) VALUES (?, ?, ?)",
                    (tag["id"], tbl, item_id),
                )
            except sqlite3.IntegrityError:
                pass

    conn.commit()
    conn.close()
    print("[+] Da them 6 tags mau va gan vao cac items co san.")


def print_usage():
    print("""
Brain Tags - He thong tags cho Brain Database

Cach dung:
    python brain_tags.py setup              Tao bang tags + du lieu mau
    python brain_tags.py add <tag> [color]  Them tag moi
    python brain_tags.py list               Liet ke tat ca tags
    python brain_tags.py tag <table> <id> <tag>     Gan tag vao item
    python brain_tags.py untag <table> <id> <tag>   Go tag khoi item
    python brain_tags.py search <tag>       Tim items theo tag
    python brain_tags.py show <table> <id>  Xem tags cua 1 item

Tables: knowledge, business, brand_voice
    """)


def main():
    if len(sys.argv) < 2:
        print_usage()
        return

    cmd = sys.argv[1].lower()

    # Luon dam bao bang tags ton tai
    init_tags_tables()

    if cmd == "setup":
        seed_sample_tags()
        list_tags()

    elif cmd == "add":
        if len(sys.argv) < 3:
            print("[!] Thieu ten tag. VD: python brain_tags.py add marketing")
            return
        color = sys.argv[3] if len(sys.argv) > 3 else "#3B82F6"
        add_tag(sys.argv[2], color)

    elif cmd == "list":
        list_tags()

    elif cmd == "tag":
        if len(sys.argv) < 5:
            print("[!] VD: python brain_tags.py tag knowledge 1 productivity")
            return
        tag_item(sys.argv[2], int(sys.argv[3]), sys.argv[4])

    elif cmd == "untag":
        if len(sys.argv) < 5:
            print("[!] VD: python brain_tags.py untag knowledge 1 productivity")
            return
        untag_item(sys.argv[2], int(sys.argv[3]), sys.argv[4])

    elif cmd == "search":
        if len(sys.argv) < 3:
            print("[!] VD: python brain_tags.py search marketing")
            return
        search_by_tag(sys.argv[2])

    elif cmd == "show":
        if len(sys.argv) < 4:
            print("[!] VD: python brain_tags.py show knowledge 1")
            return
        show_item_tags(sys.argv[2], int(sys.argv[3]))

    else:
        print(f"[!] Lenh '{cmd}' khong hop le.")
        print_usage()


if __name__ == "__main__":
    main()
