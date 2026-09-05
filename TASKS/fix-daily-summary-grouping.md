# [Antigravity] Task: Fix `get_daily_summary` — Group by order_code + tách bạch tài chính

## 🎯 Bối cảnh (tiếp nối PR #1 investigation)
Antigravity đã điều tra xong tại PR #1, phát hiện 3 điểm lệch giữa `get_daily_summary` và Admin UI. **Founder đã duyệt fix 2/3 điểm, LOẠI BỎ phần timezone.**

## ✅ Phạm vi Fix PR này

### Fix #1: Đếm đúng số đơn (GROUP BY order_code)
**Hiện tại (SAI):**
```sql
SELECT o.id, o.amount, o.status, o.order_code, o.order_date
FROM orders o
WHERE DATE(o.order_date) = DATE(?)
-- total_orders = len(rows)  ← ĐẾM SAI: 1 đơn 3 món = 3 rows = báo 3 đơn
```

**Sau fix (ĐÚNG):**
```sql
SELECT order_code,
       MIN(order_date) as order_date,
       MAX(status) as status,  -- hoặc logic status riêng
       SUM(order_value) as order_value,
       SUM(amount) as amount,
       SUM(deposit_amount) as deposit_amount,
       SUM(shipping_fee) as shipping_fee
FROM orders
WHERE DATE(order_date) = DATE(?)
GROUP BY order_code
-- total_orders = số mã đơn duy nhất  ← ĐẾM ĐÚNG
```

### Fix #2: Tách bạch tài chính F&B (3 chỉ số riêng)
Output JSON trả về phải có:
```json
{
  "success": true,
  "date": "2026-09-05",
  "total_orders": 1,                    // ← Số đơn duy nhất (GROUP BY)
  "orders_by_status": {
    "pending": 1
  },
  "total_revenue_vnd": 309000,          // ← Tổng order_value (doanh thu món ăn, đã trừ voucher)
  "total_revenue_formatted": "309.000 đ",
  "total_collection_vnd": 509000,       // ← Tổng tiền thực thu (order_value + ship + cọc bếp)
  "total_collection_formatted": "509.000 đ",
  "total_deposit_vnd": 200000,          // ← Tổng deposit_amount (tiền cọc bếp đang giữ)
  "total_deposit_formatted": "200.000 đ",
  "new_leads_count": 0,
  "top_products": [
    {"name": "Lẩu Gia Đình", "qty": 1, "revenue": 309000}
  ]
}
```

### Fix #3: top_products aggregate từ items (KHÔNG phải từ order cha)
- Query riêng từ bảng `orders` (đã có sẵn `product_id` ở từng row)
- GROUP BY `product_id` → SUM(amount) → JOIN products để lấy tên
- Sort DESC theo revenue, lấy TOP 5

## 🚫 KHÔNG ĐƯỢC LÀM (Founder đã chỉ đạo rõ)

**❌ KHÔNG ép timezone +07:00.** Bỏ hoàn toàn phần `datetime(order_date, '+7 hours')` khỏi SQL filter. Giữ nguyên `DATE(order_date) = DATE(?)` như hiện tại.

Lý do: Founder muốn giữ logic timezone như cũ, không can thiệp vào cách ghi timestamp.

## 📋 Acceptance Criteria

1. ✅ `total_orders` = số `order_code` duy nhất (không phải số rows)
2. ✅ `total_revenue_vnd` = tổng `order_value` (KHÔNG bao gồm ship + cọc)
3. ✅ `total_collection_vnd` = `total_revenue + shipping_fee + deposit_amount`
4. ✅ `total_deposit_vnd` = tổng `deposit_amount`
5. ✅ `top_products` aggregate từ items, sort theo revenue DESC, lấy TOP 5
6. ✅ KHÔNG có bất kỳ thay đổi nào về timezone
7. ✅ Test với đơn `#LN0640` (nếu còn trong DB) → phải báo ≥ 1 đơn
8. ✅ Tương thích ngược: Admin UI `/api/orders` không bị ảnh hưởng

## 🧪 Test Plan
Sau khi fix, gọi thử:
```bash
# Test 1: Daily summary hôm nay
mcp_biz__get_daily_summary(date="today")

# Expected: Nếu có đơn LN0640, phải thấy total_orders >= 1, total_revenue > 0

# Test 2: So sánh với Admin UI
# Vào /admin.html tab "Đơn hàng" → đếm tay số đơn
# So sánh với total_orders từ tool → phải khớp
```

## 🎯 Tiêu chí chốt
- **Không thay đổi schema** (zero migration)
- **Không động vào `create_manual_order`** (chỉ fix bên đọc)
- **Không động vào timezone** (giữ nguyên)
- **Tương thích ngược 100%** với Admin UI
- Code phải có comment giải thích logic GROUP BY và cách tách 3 chỉ số tài chính
