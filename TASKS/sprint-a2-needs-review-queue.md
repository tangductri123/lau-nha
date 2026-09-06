# [Antigravity] Task SPRINT A2: Tạo bảng `needs_review` queue

## 🎯 Bối cảnh
Theo `docs/ca-meo-hub-v2.md`, AI parser cần có 3 mức confidence:
- **High (>90%):** Tự động tạo đơn
- **Medium (70-90%):** Tạo đơn + đưa vào queue `needs_review`
- **Low (<70%):** Đưa vào `dead_letter` (Sprint A3)

Hiện tại chưa có queue `needs_review` → đơn parse medium confidence đang lẫn với đơn high confidence.

## 📋 Yêu cầu chi tiết

### 1. Tạo bảng `needs_review`
```sql
CREATE TABLE IF NOT EXISTS needs_review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code TEXT,
  customer_name TEXT,
  phone TEXT,
  raw_text TEXT,
  parse_result_json TEXT,    -- Lưu JSON output từ AI
  confidence REAL,
  issue_type TEXT,            -- 'low_confidence' | 'missing_field' | 'price_mismatch' | 'unknown_product'
  assigned_to TEXT,           -- Username Telegram của người xử lý
  status TEXT DEFAULT 'pending',  -- 'pending' | 'confirmed' | 'rejected'
  created_at TEXT,
  resolved_at TEXT,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_needs_review_status ON needs_review(status);
CREATE INDEX IF NOT EXISTS idx_needs_review_confidence ON needs_review(confidence);
```

### 2. Update `create_manual_order` trong `mcp/server.py`
- Lấy `confidence` từ AI output
- Nếu `70 <= confidence < 90` HOẶC thiếu 1 trong các trường (phone, address, total_amount):
  - INSERT vào `needs_review` với status='pending'
  - Telegram gửi thẻ riêng (template khác thẻ đơn bình thường) có nhãn "⚠️ CẦN XÁC NHẬN"
- Nếu `confidence >= 90` và đủ trường → giữ flow hiện tại
- Nếu `confidence < 70` → reject + chuyển cho Sprint A3 xử lý

### 3. Thêm 2 API endpoint trong `server.py`
```python
GET  /api/needs-review          # List tất cả (filter theo status)
POST /api/needs-review/{id}/resolve  # Body: {action: 'confirm'|'reject', note: '...'}
```
- Resolve action phải:
  - Update status + resolved_at + resolved_by
  - Ghi audit log
  - Nếu confirm → cập nhật order gốc (set confidence chính thức)

### 4. Update Admin UI (`admin.html`)
- Thêm tab mới: "⚠️ Cần xác nhận"
- Hiển thị danh sách `needs_review` với confidence + issue_type
- Nút `[Xem chi tiết] [Xác nhận] [Từ chối]` cho mỗi row
- Auto-refresh mỗi 30s

### 5. Template Telegram card cho needs_review
```
⚠️ ĐƠN CẦN XÁC NHẬN (Confidence: 75%)
━━━━━━━━━━━━━━━━━━
Mã đơn: #LN0xxx
Khách: Nguyễn Văn A
SĐT: 0901xxx
Địa chỉ: [Đang trống - cần bổ sung]
Tổng tiền: 309k (AI đoán - chưa chắc)
━━━━━━━━━━━━━━━━━━
[✅ Xác nhận] [✏️ Sửa] [❌ Từ chối]
```

## 🚫 KHÔNG ĐƯỢC LÀM
- ❌ KHÔNG tự động confirm đơn confidence < 70%
- ❌ KHÔNG xóa row `needs_review` (chỉ update status)
- ❌ KHÔNG gửi lặp cùng 1 thẻ xác nhận nếu status chưa đổi
- ❌ KHÔNG thay đổi schema bảng `orders`

## ✅ Acceptance Criteria
1. ✅ Bảng `needs_review` tạo thành công
2. ✅ Parse confidence 70-90% tự động vào queue
3. ✅ Telegram gửi thẻ riêng với nhãn "CẦN XÁC NHẬN"
4. ✅ Admin UI có tab mới, hiển thị + resolve được
5. ✅ Resolve ghi audit log
6. ✅ Confirm action cập nhật order gốc
7. ✅ Reject action giữ order nhưng đánh dấu cần xem xét

## 🧪 Test Plan
```bash
# Test 1: Tạo đơn test với confidence thấp (fake raw_text)
# → Phải xuất hiện trong tab "Cần xác nhận" + Telegram card riêng

# Test 2: API endpoint
curl http://localhost:8080/api/needs-review
# → Trả về JSON list

# Test 3: Resolve
curl -X POST http://localhost:8080/api/needs-review/1/resolve \
  -H "Content-Type: application/json" \
  -d '{"action": "confirm", "note": "Đã gọi khách xác nhận"}'
# → Status chuyển confirmed, resolved_at filled, audit log có row mới

# Test 4: Idempotency
# Click confirm 2 lần liên tiếp → chỉ log 1 lần
```

## 🔗 Reference
- Spec: `docs/ca-meo-hub-v2.md` mục 4 (Confirmation loop) + mục 7 (Sprint A2)
- File liên quan: `mcp/server.py`, `server.py`, `admin.html`
- PR trước: #6 (4-timestamp)
