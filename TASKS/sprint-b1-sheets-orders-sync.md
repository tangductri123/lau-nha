# [Antigravity] Task SPRINT B1: Google Sheets sync — Orders tab

## 🎯 Bối cảnh
Theo `docs/ca-meo-hub-v2.md` mục 6, Google Sheets là lớp báo cáo (không phải source of truth). Founder cần xem doanh thu / đơn hàng trên Sheets hàng ngày, không phải lúc nào cũng vào Admin Panel.

Sprint B chia thành nhiều task (B1-B10), B1 tập trung vào **Orders tab** trước.

## 📋 Yêu cầu chi tiết

### 1. Setup Google Service Account
- Tạo Service Account trên Google Cloud Console
- Enable Google Sheets API v4
- Lưu credentials JSON vào **biến môi trường** (KHÔNG commit vào repo)
  - Tên biến: `GOOGLE_SHEETS_CREDENTIALS_JSON` (string JSON)
  - Hoặc: `GOOGLE_SHEETS_CREDENTIALS_PATH` (path to file)
- Share Google Sheet với email Service Account (Editor permission)
- Lưu Sheet ID vào env: `GOOGLE_SHEETS_ID`

### 2. Tạo Google Sheet template với 4 tab
**Tab 1: `Orders`** (Task B1 này)
| Cột | Header | Nguồn |
|-----|--------|-------|
| A | order_code | `orders.order_code` (khóa) |
| B | order_date | `orders.source_event_time` |
| C | customer_name | `customers.name` |
| D | phone | `customers.phone` |
| E | address | `orders.address` |
| F | items | GROUP_CONCAT từ `order_items` |
| G | total_amount | SUM từ `order_items.amount` |
| H | shipping_fee | `orders.shipping_fee` |
| I | deposit_amount | `orders.deposit_amount` |
| J | total_collection | `orders.total_collection` |
| K | status | `orders.status` |
| L | channel | 'telegram' (cố định cho B1) |
| M | confidence | `orders.confidence` |
| N | confirm_by | `orders.confirm_by` |
| O | sync_version | auto-increment |
| P | last_synced_at | timestamp |

Tab 2, 3, 4 để trống (sẽ làm ở task B4, B5, B6)

### 3. Viết module `sheets_sync.py`
```python
# sơ đồ function
def upsert_order(order_code: str, order_data: dict) -> bool:
    """Insert hoặc update 1 row theo order_code"""
    
def sync_daily_summary(date: str, summary: dict) -> bool:
    """Fill Daily tab"""
    
def sync_all_pending_orders() -> int:
    """Sync tất cả orders chưa sync hoặc sync fail"""
    
def reconciliation() -> dict:
    """So sánh tổng tiền DB vs Sheets, trả về diff"""
```

### 4. Tích hợp vào `create_manual_order`
- Sau khi tạo đơn thành công → gọi `upsert_order` (async, không block response)
- Nếu Sheets fail → log error, KHÔNG revert đơn
- Ghi `last_synced_at`, `sync_version`, `sync_status` vào bảng `orders`

### 5. Thêm 3 cột vào bảng `orders`
```sql
ALTER TABLE orders ADD COLUMN last_synced_at TEXT;
ALTER TABLE orders ADD COLUMN sync_version INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN sync_status TEXT DEFAULT 'pending';
-- 'pending' | 'synced' | 'failed' | 'manual_review'
```

### 6. Cron job sync định kỳ
- Schedule: mỗi 5-10 phút
- Query: `SELECT * FROM orders WHERE sync_status IN ('pending', 'failed') AND updated_at > NOW() - 1h`
- Gọi `upsert_order` cho mỗi row
- Retry fail: tăng `attempt_count` (cột mới), sau 5 lần → `sync_status='manual_review'`

### 7. Retry với exponential backoff
- Lần 1: delay 1s
- Lần 2: delay 2s
- Lần 3: delay 4s
- Lần 4: delay 8s
- Lần 5: delay 16s
- Sau 5 lần: đánh dấu `sync_status='failed'`, log error, KHÔNG retry tự động nữa

### 8. Reconciliation job (chạy mỗi 6h)
- Đếm số row trong Sheets vs DB
- So sánh tổng tiền (SUM total_amount) DB vs Sheets
- Nếu lệch > 0: log warning + gửi Telegram alert
- KHÔNG tự động sửa — để Founder quyết

## 🚫 KHÔNG ĐƯỢC LÀM
- ❌ KHÔNG commit credentials vào repo
- ❌ KHÔNG sync 2 chiều (Sheets → DB)
- ❌ KHÔNG xóa row khi sync fail (giữ lại, đánh dấu failed)
- ❌ KHÔNG tự động sửa khi reconciliation lệch (chỉ alert)
- ❌ KHÔNG block API response khi Sheets fail (async)
- ❌ KHÔNG thay đổi logic `create_manual_order` (chỉ thêm hook)

## ✅ Acceptance Criteria
1. ✅ Credentials trong env var, KHÔNG có trong code
2. ✅ Service Account có quyền Editor trên Sheet
3. ✅ Module `sheets_sync.py` hoạt động độc lập
4. ✅ Tạo đơn mới → Sheets tự động có row trong <10s
5. ✅ Update đơn → Sheets update (không tạo row mới)
6. ✅ Cancel đơn → Sheets đánh dấu cancelled, không xóa
7. ✅ Sheets API fail → retry 5 lần với backoff
8. ✅ Sau 5 lần fail → `sync_status='manual_review'`
9. ✅ Cron job sync định kỳ chạy đúng
10. ✅ Reconciliation alert khi lệch tổng tiền
11. ✅ Tương thích ngược: nếu không có credentials, vẫn tạo đơn bình thường (chỉ log warning)

## 🧪 Test Plan
```bash
# Test 1: Setup
# - Tạo Google Sheet test
# - Set env var GOOGLE_SHEETS_CREDENTIALS_JSON
# - Share Sheet với service account email

# Test 2: Tạo đơn
# Gọi create_manual_order → check Sheets có row mới trong tab Orders

# Test 3: Update
# Update status đơn → check Sheets cũng update

# Test 4: Fail simulation
# Set credentials sai → retry 5 lần → sync_status='manual_review'

# Test 5: Reconciliation
# Sửa tay 1 row trong Sheets (đổi tổng tiền) → chạy reconciliation → có alert

# Test 6: Credentials missing
# Unset env var → tạo đơn vẫn OK, log warning về Sheets
```

## 🔗 Reference
- Spec: `docs/ca-meo-hub-v2.md` mục 6 (DB vs Sheets) + mục 7 (Sprint B1-B3)
- File liên quan: `mcp/server.py`, `server.py`
- PR trước: #6 (4-timestamp), #7 (needs_review), #8 (dead_letter)
- Google Sheets API docs: https://developers.google.com/sheets/api/quickstart/python

## 📦 Output mong đợi
1. Module `sheets_sync.py` hoàn chỉnh
2. Cron job setup
3. File `.env.example` cập nhật với 3 biến mới:
   ```
   GOOGLE_SHEETS_CREDENTIALS_JSON=...  # hoặc dùng PATH
   GOOGLE_SHEETS_CREDENTIALS_PATH=...
   GOOGLE_SHEETS_ID=...
   ```
4. Document README ngắn trong `docs/sheets-sync.md` hướng dẫn setup
