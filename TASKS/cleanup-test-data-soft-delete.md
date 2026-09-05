# [Antigravity] Task: Soft delete 2 đơn test + filter báo cáo daily

## 🎯 Bối cảnh
- Founder test 2 đơn qua `create_manual_order`, đơn đã lưu vào DB
- SĐT test: `0819943904`, Tên: `Tang Duc Tri`
- Lo ngại: data test sẽ làm bẩn báo cáo doanh thu tương lai
- **Phương án được duyệt: SOFT DELETE** (giữ audit trail, an toàn hơn hard delete)

## ✅ Phạm vi công việc

### Bước 1: Thêm cột `is_deleted` vào các bảng liên quan (nếu chưa có)
- Bảng `orders` → thêm cột `is_deleted INTEGER DEFAULT 0` + `deleted_at TEXT NULL`
- Bảng `customers` → thêm cột `is_deleted INTEGER DEFAULT 0` + `deleted_at TEXT NULL`
- **Lưu ý:** Dùng `ALTER TABLE ... ADD COLUMN` với `IF NOT EXISTS` để idempotent

### Bước 2: Soft delete 2 đơn test cụ thể
Query điều kiện:
```sql
-- Tìm 2 đơn test
SELECT id, order_code, customer_id, total_amount, order_date
FROM orders
WHERE customer_id = (
  SELECT id FROM customers WHERE phone = '0819943904'
)
ORDER BY id DESC
-- Hiển thị cho Founder duyệt TRƯỚC khi xóa
```

Sau khi Founder xác nhận, chạy:
```sql
-- Soft delete orders
UPDATE orders
SET is_deleted = 1, deleted_at = datetime('now', 'localtime')
WHERE customer_id = (
  SELECT id FROM customers WHERE phone = '0819943904'
);

-- Soft delete customer
UPDATE customers
SET is_deleted = 1, deleted_at = datetime('now', 'localtime')
WHERE phone = '0819943904';
```

### Bước 3: Update `get_daily_summary` để filter đơn đã xóa
Thêm điều kiện `WHERE o.is_deleted = 0` (hoặc `IS NULL` để tương thích với row cũ) vào SQL query.

### Bước 4: Update Admin UI `/api/orders` để filter đơn đã xóa
Trong `server.py` hàm `list_orders`, thêm `WHERE o.is_deleted = 0` để Admin cũng không hiển thị đơn đã soft delete.

## 🚫 KHÔNG ĐƯỢC LÀM

- ❌ **KHÔNG hard delete** dữ liệu (giữ nguyên row, chỉ đánh dấu)
- ❌ **KHÔNG xóa các bảng liên quan** (order_items, payments, audit_logs, leads)
- ❌ **KHÔNG đụng vào timezone** (giữ nguyên `datetime('now', 'localtime')`)
- ❌ **KHÔNG thay đổi schema bảng lớn** (chỉ ADD COLUMN)

## 📋 Acceptance Criteria

1. ✅ Migration idempotent — chạy nhiều lần không lỗi
2. ✅ 2 đơn test được soft delete (không hiển thị trong Admin UI, không tính trong báo cáo)
3. ✅ Customer `Tang Duc Tri` / SĐT `0819943904` được soft delete
4. ✅ `get_daily_summary` trả về 0 đơn, 0 doanh thu (sau khi xóa)
5. ✅ Admin UI `/api/orders` không hiển thị 2 đơn test
6. ✅ Soft-deleted data vẫn còn trong DB (có thể query `WHERE is_deleted=1` để audit)
7. ✅ Tương thích ngược với rows cũ (không có cột `is_deleted` → coi như `is_deleted=0`)

## 🧪 Test Plan

```bash
# Test 1: Trước khi fix - lấy danh sách 2 đơn test
sqlite3 brain.db "SELECT id, order_code, total_amount FROM orders WHERE customer_id = (SELECT id FROM customers WHERE phone = '0819943904');"

# Test 2: Sau migration - kiểm tra cột đã thêm
sqlite3 brain.db "PRAGMA table_info(orders);"  # Phải có is_deleted, deleted_at
sqlite3 brain.db "PRAGMA table_info(customers);"  # Phải có is_deleted, deleted_at

# Test 3: Sau soft delete
sqlite3 brain.db "SELECT COUNT(*) FROM orders WHERE is_deleted=1 AND customer_id = (SELECT id FROM customers WHERE phone = '0819943904');"  # = 2

# Test 4: get_daily_summary phải trả về 0
# Gọi mcp_biz__get_daily_summary(date="today") → total_orders = 0, total_revenue = 0

# Test 5: Admin UI không hiển thị
# Vào /admin.html tab "Đơn hàng" → không thấy 2 đơn test
```

## 🎯 Tiêu chí chốt
- **Soft delete 100%** — không xóa row, chỉ đánh dấu
- **Idempotent migration** — chạy nhiều lần OK
- **Backward compatible** — rows cũ không có cột vẫn hoạt động
- **Audit trail preserved** — vẫn query được data đã xóa nếu cần
- **Báo cáo daily sạch** — không còn data test
