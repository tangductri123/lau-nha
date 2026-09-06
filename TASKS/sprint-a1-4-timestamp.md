# [Antigravity] Task SPRINT A1: Tách 4-timestamp + đo latency

## 🎯 Bối cảnh
Theo kiến trúc `docs/ca-meo-hub-v2.md`, Sprint 1 đã 70% done. Phần còn lại:
- ❌ Chưa tách 4-timestamp (mới có `order_date` duy nhất)
- ❌ Chưa đo được P50/P95 latency

## 📋 Yêu cầu chi tiết

### 1. Migration thêm 4 cột vào bảng `orders`
```sql
ALTER TABLE orders ADD COLUMN source_event_time TEXT;
ALTER TABLE orders ADD COLUMN received_time TEXT;
ALTER TABLE orders ADD COLUMN parsed_time TEXT;
ALTER TABLE orders ADD COLUMN confirmed_time TEXT;
```
- **Lưu ý:** Dùng `IF NOT EXISTS` hoặc check trước khi ADD (SQLite không hỗ trợ IF NOT EXISTS cho ADD COLUMN, cần dùng `PRAGMA table_info(orders)` check)

### 2. Update `create_manual_order` trong `mcp/server.py`
- Fill 4 timestamp:
  - `source_event_time` = thời điểm khách gửi tin nhắn (nếu có từ Telegram update)
  - `received_time` = thời điểm bot nhận (now)
  - `parsed_time` = thời điểm AI parse xong (now)
  - `confirmed_time` = NULL lúc tạo, fill khi Founder bấm "Chốt đơn"
- Format: `datetime('now', 'localtime')` — giữ nguyên timezone hiện tại (KHÔNG ép +7)

### 3. Thêm index
```sql
CREATE INDEX IF NOT EXISTS idx_orders_source_event_time ON orders(source_event_time);
CREATE INDEX IF NOT EXISTS idx_orders_received_time ON orders(received_time);
```

### 4. Backfill dữ liệu cũ (nếu có)
- Với orders đã tồn tại: set cả 4 cột = `order_date`
- Câu lệnh: `UPDATE orders SET source_event_time = order_date, received_time = order_date, parsed_time = order_date WHERE source_event_time IS NULL`

### 5. Update `get_daily_summary` để đo latency
- Tính P50 và P95 của `received_time - source_event_time` (nếu có data)
- Trả về thêm field `latency_stats`:
  ```json
  {
    "latency_stats": {
      "sample_size": 2,
      "p50_seconds": 5,
      "p95_seconds": 12,
      "unit": "seconds"
    }
  }
  ```
- Nếu sample_size < 5 thì trả `null` (chưa đủ data)

## 🚫 KHÔNG ĐƯỢC LÀM
- ❌ KHÔNG ép timezone +07:00
- ❌ KHÔNG xóa cột `order_date` cũ
- ❌ KHÔNG thay đổi schema các bảng khác
- ❌ KHÔNG thay đổi logic `create_manual_order` (chỉ thêm timestamp)

## ✅ Acceptance Criteria
1. ✅ 4 cột tồn tại trong bảng `orders`
2. ✅ Migration idempotent — chạy nhiều lần không lỗi
3. ✅ Đơn mới tự động fill đủ 4 cột (trừ `confirmed_time` ban đầu NULL)
4. ✅ Index được tạo
5. ✅ Backfill chạy thành công cho dữ liệu cũ
6. ✅ `get_daily_summary` trả về `latency_stats` khi đủ data
7. ✅ Tương thích ngược: code cũ vẫn chạy (vì chỉ thêm cột)

## 🧪 Test Plan
```bash
# Test 1: Verify schema
sqlite3 brain.db "PRAGMA table_info(orders);"  # Phải thấy 4 cột mới

# Test 2: Tạo đơn mới qua MCP
# Gọi create_manual_order → check 4 timestamp đã fill

# Test 3: Backfill
sqlite3 brain.db "SELECT COUNT(*) FROM orders WHERE source_event_time IS NULL;"
# Phải = 0

# Test 4: get_daily_summary có latency_stats
# Gọi tool → check response có field latency_stats
```

## 🔗 Reference
- Spec: `docs/ca-meo-hub-v2.md` mục 7 (Sprint A1)
- File liên quan: `mcp/server.py` (hàm `exec_create_manual_order`, `exec_get_daily_summary`)
- PR trước: #1 (idempotency), #2 (GROUP BY)
