# [Antigravity][KHẨN] Investigate: create_manual_order insert items rỗng + amount lệch

## 🚨 Mức độ
**CAO** — ảnh hưởng trực tiếp đến dữ liệu báo cáo daily + vận hành đơn hàng

## 🎯 Bug phát hiện
Khi check đơn `LN9999` (Nguyễn Văn Hùng, 0989123456, 824k), tool `check_order_and_payment` trả về:

```json
{
  "order_code": "LN9999",
  "amount": 65000,
  "items": [],
  "status": "pending"
}
```

**Nhưng trong raw_text có đủ 3 món:**
- Set Lẩu Tươi Gia Đình (4-6 người) x1
- Bò Wagyu Thượng Hạng (200g) x1
- Nước Lẩu Nấm Dưỡng Nhan (1.5L) x1
- **Tổng dự kiến: ~824,000 đ**

**Vấn đề:**
- `items[]` rỗng → không lưu được món nào
- `amount` = 65k (sai) thay vì 824k

## 🔍 Cần điều tra 4 điểm

### 1. `create_manual_order` xử lý `items` thế nào?
**Câu hỏi:** Hàm `exec_create_manual_order` trong `mcp/server.py` có nhận `items` parameter không? Có INSERT vào bảng `order_items` không?
**Cách check:** Đọc code handler, tìm:
- Có validate `items` không
- Có INSERT riêng vào bảng `order_items` không
- Có transaction wrap không (commit/rollback)

### 2. Bảng `order_items` có thực sự tồn tại không?
**Câu hỏi:** Bảng `order_items` đã được migrate chưa? Schema thế nào?
**Cách check:** `sqlite3 brain.db ".schema order_items"` — xem có bảng không, có cột gì

### 3. Lịch sử insert đơn LN9999
**Câu hỏi:** Đơn này insert khi nào, bởi ai, qua tool nào?
**Cách check:**
- `SELECT * FROM audit_logs WHERE entity_id LIKE '%LN9999%' OR entity_type='order' AND entity_id IN (SELECT id FROM orders WHERE order_code='LN9999')`
- `SELECT * FROM orders WHERE order_code='LN9999'`
- `SELECT * FROM parse_results WHERE order_code='LN9999'`

### 4. Có bao nhiêu đơn bị bug tương tự?
**Câu hỏi:** Bug này ảnh hưởng bao nhiêu đơn?
**Cách check:**
```sql
-- Tìm đơn có amount < 100k (khả năng cao bị lỗi)
SELECT o.order_code, o.amount, o.status, o.order_date, COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id
HAVING item_count = 0 AND o.amount < 100000
```

## 🧪 Test Plan

### Test 1: Gọi create_manual_order với items đầy đủ
```python
mcp_biz__create_manual_order(
    customer_name="Test Customer",
    phone="0900000000",
    address="Test Address",
    items=[
        {"name": "Lẩu Gia Đình", "qty": 1, "unit_price": 399000},
        {"name": "Nước Lẩu Thái", "qty": 1, "unit_price": 99000}
    ],
    raw_text="Test order with 2 items"
)
# Expected: Tạo đơn + 2 row trong order_items
```

### Test 2: Gọi create_manual_order với product_name (fallback)
```python
mcp_biz__create_manual_order(
    customer_name="Test 2",
    phone="0900000001",
    address="Test",
    product_name="Lẩu Gia Đình",
    amount=399000
)
# Expected: Tạo đơn + 1 row trong order_items với tên + amount
```

### Test 3: Gọi create_manual_order KHÔNG truyền items/product_name
```python
mcp_biz__create_manual_order(
    customer_name="Test 3",
    phone="0900000002",
    address="Test",
    raw_text="Random text no items"
)
# Expected: BÁO LỖI, không tạo đơn
```

## 📋 Expected Output (báo cáo trên PR này)

Trả lời bằng comment trên PR:

```
## Findings
1. create_manual_order xử lý items: ...
2. Bảng order_items: tồn tại / không tồn tại
3. Lịch sử insert LN9999: ... (kết quả query audit_logs)
4. Số đơn bị bug tương tự: ... (kết quả HAVING query)

## Root Cause
- Bug ở đâu: ...
- Tại sao items rỗng: ...
- Tại sao amount sai: ...

## Đề xuất Fix
- Phương án A: ...
- Phương án B: ...
- Khuyến nghị: ...

## Test Results
- Test 1: PASS / FAIL
- Test 2: PASS / FAIL
- Test 3: PASS / FAIL
```

## 🎯 Tiêu chí chốt
- **Phải xác định được root cause** (không đoán mò)
- **Phải đếm được số đơn bị ảnh hưởng** (để biết scope fix)
- **Đề xuất fix phải có code cụ thể** (không nói chung chung)
- **Có test 3 case** (có items / fallback / không có gì)

## 🚫 KHÔNG ĐƯỢC LÀM TRONG PR NÀY
- ❌ KHÔNG sửa code trong PR này (chỉ investigate)
- ❌ KHÔNG tạo PR fix mới (đợi duyệt phương án)
- ❌ KHÔNG xóa data (kể cả đơn lỗi)

## 🔗 Reference
- Đơn bug: LN9999 (Nguyễn Văn Hùng, 0989123456, raw_text có 3 món)
- Daily summary 06/09 có include đơn này: 2,238,000đ tổng
- PR liên quan: #1 (idempotency), #2 (GROUP BY), #3 (soft delete - chưa merge)
- File cần đọc: `mcp/server.py` (hàm `exec_create_manual_order`)
