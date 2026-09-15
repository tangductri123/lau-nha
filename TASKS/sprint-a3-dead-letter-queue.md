# [Antigravity] Task SPRINT A3: Tạo bảng `dead_letter` queue

## 🎯 Bối cảnh
Khi AI parse fail hoặc retry > 3 lần, hiện tại đơn bị mất hoặc lẫn vào `needs_review` không rõ ràng. Cần một bảng riêng để:
- Lưu các event parse fail để debug
- Heartbeat tự cảnh báo Founder
- Tránh spam Telegram với cùng 1 lỗi

## 📋 Yêu cầu chi tiết

### 1. Tạo bảng `dead_letter`
```sql
CREATE TABLE IF NOT EXISTS dead_letter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT,                -- 'telegram' | 'website' | 'admin'
  raw_text TEXT,
  raw_payload_json TEXT,      -- Lưu toàn bộ payload gốc
  error_type TEXT,            -- 'parse_failed' | 'max_retries' | 'invalid_format' | 'unknown_product'
  error_message TEXT,
  attempt_count INTEGER DEFAULT 1,
  parser_version TEXT,
  prompt_version TEXT,
  assigned_to TEXT,           -- Người xử lý
  status TEXT DEFAULT 'open', -- 'open' | 'resolved' | 'discarded'
  resolution_note TEXT,
  created_at TEXT,
  resolved_at TEXT,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_status ON dead_letter(status);
CREATE INDEX IF NOT EXISTS idx_dead_letter_created ON dead_letter(created_at);
```

### 2. Update logic parse trong `mcp/server.py`
Khi AI parse fail:
- Bắt exception
- INSERT vào `dead_letter` với error_type='parse_failed' + error_message
- KHÔNG tạo đơn
- Telegram gửi cảnh báo 1 lần (không spam)

Khi retry > 3 lần cho cùng idempotency_key:
- INSERT vào `dead_letter` với error_type='max_retries'
- Telegram cảnh báo

### 3. Thêm API endpoint
```python
GET  /api/dead-letter                    # List theo status
POST /api/dead-letter/{id}/resolve       # Body: {action: 'resolve'|'discard', note: '...'}
POST /api/dead-letter/{id}/reprocess     # Thử parse lại bằng version mới
```

### 4. Update Admin UI (`admin.html`)
- Thêm tab: "🚨 Lỗi parse"
- Hiển thị: raw_text + error_type + attempt_count + thời gian
- Nút: `[Xem raw] [Xử lý] [Bỏ qua] [Parse lại]`
- Filter theo status + source

### 5. Heartbeat cảnh báo
- Trong chu kỳ heartbeat (5-15 phút), check `dead_letter` có row mới trong 1h
- Nếu có → gửi Telegram alert:
  ```
  🚨 CÓ {N} ĐƠN LỖI PARSE TRONG 1H QUA
  - Mới nhất: {raw_text_snippet}
  - Lỗi: {error_type}
  - Xử lý: Vào Admin → tab "Lỗi parse"
  ```
- KHÔNG spam nếu đã alert trong 1h rồi (dùng flag `alerted_at` trong row)

## 🚫 KHÔNG ĐƯỢC LÀM
- ❌ KHÔNG tự động retry quá 3 lần
- ❌ KHÔNG xóa row `dead_letter` (chỉ update status)
- ❌ KHÔNG spam Telegram (dùng cooldown flag)
- ❌ KHÔNG block flow chính khi INSERT dead_letter fail (log error, tiếp tục)

## ✅ Acceptance Criteria
1. ✅ Bảng `dead_letter` tạo thành công
2. ✅ Parse fail tự động vào dead_letter
3. ✅ Retry > 3 lần vào dead_letter
4. ✅ Admin UI có tab mới, hiển thị + xử lý được
5. ✅ Heartbeat cảnh báo hoạt động (test bằng cách fake 1 row)
6. ✅ Cooldown flag chống spam
7. ✅ Resolve/Discard action ghi audit log

## 🧪 Test Plan
```bash
# Test 1: Gửi raw_text rác để trigger parse fail
# → Phải xuất hiện trong tab "Lỗi parse" + Telegram alert

# Test 2: Retry
# Submit cùng 1 input 4 lần → row thứ 4 phải có error_type='max_retries'

# Test 3: API resolve
curl -X POST http://localhost:8080/api/dead-letter/1/resolve \
  -H "Content-Type: application/json" \
  -d '{"action": "discard", "note": "Khách gửi nhầm"}'
# → status='discarded', resolved_at filled

# Test 4: Heartbeat cooldown
# Trigger 2 lỗi liên tiếp → chỉ nhận 1 alert Telegram
```

## 🔗 Reference
- Spec: `docs/ca-meo-hub-v2.md` mục 4 (Retry safety) + mục 7 (Sprint A3)
- File liên quan: `mcp/server.py`, `server.py`, `admin.html`, Heartbeat logic
- PR trước: #6 (4-timestamp), #7 (needs_review)
