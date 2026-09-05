# [Antigravity] Task: Điều tra sự lệch dữ liệu giữa `create_manual_order` và `get_daily_summary`

## 🎯 Bối cảnh
- User test đơn `#LN0640` lúc 14:27 (GMT) → `create_manual_order` chạy OK, đã bắn card về Group Bếp
- Cùng ngày gọi `get_daily_summary` → trả về **0 đơn, 0 doanh thu, 0 leads**
- Có nguy cơ `create_manual_order` ghi vào bảng khác, hoặc lệch timezone

## 🔍 Cần điều tra 3 điểm

### 1. `create_manual_order` thực sự ghi vào bảng nào?
- **Câu hỏi:** Tool này insert vào SQLite `My-Brain/brain.db` (bảng `orders`) hay vào Postgres Railway (bảng `orders` của Admin)?
- **Cách check:** Đọc code handler của MCP tool `create_manual_order` trong repo, tìm dòng `INSERT INTO ...`
- **Cần xác nhận:**
  - Tên DB (SQLite path hay Postgres connection string)
  - Tên bảng đích
  - Các cột được fill: `order_code`, `customer_id`, `total_amount`, `status`, `order_date`/`created_at`, timezone của timestamp

### 2. `get_daily_summary` đang query từ đâu, filter ngày thế nào?
- **Câu hỏi:** Tool này query bảng nào, có cùng nguồn với `create_manual_order` không?
- **Cách check:** Đọc code handler của MCP tool `get_daily_summary`, tìm:
  - Connection string DB
  - Câu SQL aggregate
  - Logic filter theo ngày (so sánh với `created_at` hay `order_date`?)
  - Timezone áp dụng (UTC hay Asia/Ho_Chi_Minh = UTC+7)
- **Cần xác nhận:**
  - Có JOIN bảng `order_items` + `products` để ra `top_products` không
  - Status nào được tính vào `total_revenue` (chỉ `paid`+`completed` hay cả `pending`?)

### 3. Admin UI tab "Đơn hàng" đang gọi endpoint nào?
- **Câu hỏi:** `GET /api/orders` trong `server.py` query bảng nào, có trả về đơn từ `create_manual_order` không?
- **Cách check:** Đọc handler `@app.get("/api/orders")` trong `server.py`
- **Cần xác nhận:**
  - Có trả về đơn Telegram từ `create_manual_order` không, hay chỉ đơn tạo qua form Admin

## 📋 Expected Output (PR này chỉ là investigation, KHÔNG sửa code)

Trả lời bằng comment trên PR:

```
## Findings
1. `create_manual_order` ghi vào: <DB> / <bảng> / <cột timestamp + timezone>
2. `get_daily_summary` đọc từ: <DB> / <bảng> / <filter ngày + timezone>
3. Admin `/api/orders` đọc từ: <DB> / <bảng>

## Mismatch Analysis
- Có lệch nguồn không? (YES/NO, chi tiết)
- Có lệch timezone không? (YES/NO, chi tiết)
- Có lệch schema (tên cột) không? (YES/NO, chi tiết)

## Đề xuất Fix (nếu có)
- Phương án A: ... (trade-offs)
- Phương án B: ... (trade-offs)
- Khuyến nghị: ...
```

## 🎯 Tiêu chí chốt
- Không sửa code trong PR này, chỉ investigate + document
- Có bằng chứng cụ thể (snippet code, output query, schema bảng)
- Đề xuất fix phải kèm trade-offs và khuyến nghị 1 phương án rõ ràng

## 🔗 Reference
- File liên quan cần đọc: `server.py`, `mcp_server/`, `admin.html` (đã đọc - thấy `loadOrders()` gọi `/api/orders`)
- Domain test: `https://lau-nha-production.up.railway.app`
- DB local: `My-Brain/brain.db`
- Order test: `#LN0640` (khách Tang Duc Tri, 14:27 GMT)
