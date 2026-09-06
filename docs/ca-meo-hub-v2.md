# Cá Mèo Hub v2 — Kiến Trúc & Roadmap (Phiên bản Lẩu Nhà)

> **Phiên bản:** v2.0 — Cập nhật 2026-09-06
> **Người soạn:** Cá Mèo (review & adapt từ bản gốc)
> **Người duyệt:** Founder Lẩu Nhà
> **Khác với v1:** Map 100% vào thực tế Lẩu Nhà (Telegram + Website, không phải email Grab/Shopee)

---

## 1. Tóm tắt điều hành

Cá Mèo Hub là lớp vận hành omnichannel cho Lẩu Nhà:
- **Tiếp nhận đơn** từ Telegram (chính) + Website form khảo sát
- **Chuẩn hóa dữ liệu** bằng AI parser (Cá Mèo)
- **Điều phối** qua Telegram Bot + Group Bếp
- **Đồng bộ báo cáo** sang Google Sheets (lớp báo cáo, không phải nguồn dữ liệu)

### 4 điểm nghẽn cần giải quyết (theo review v1)
1. ~~Độ trễ email Grab/Shopee~~ → **Không áp dụng** (Lẩu Nhà không dùng email)
2. **Trùng đơn từ AI parse** → ✅ Đã fix (PR #1)
3. **Thiếu vòng xác nhận rõ ràng** → Cần làm (Sprint 2)
4. **Mơ hồ Telegram vs DB vs Sheets** → Cần làm (Sprint 4)

---

## 2. Kiến trúc mục tiêu

### Luồng dữ liệu

```
┌──────────────────────────────────────────────────────────────┐
│  NGUỒN VÀO                                                    │
│  ├─ Telegram: Founder chat @cameodev_bot                      │
│  ├─ Telegram: Khách chat trực tiếp                            │
│  ├─ Website laumangdi.com: Form khảo sát → Lead               │
│  └─ Admin Panel: Tạo đơn thủ công                             │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  INGESTION LAYER                                               │
│  - Lưu raw payload (raw_events)                               │
│  - Gắn idempotency_key (đã có ở PR #1)                        │
│  - Gắn 4-timestamp: source_event_time, received_time,          │
│    parsed_time, confirmed_time                                 │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  AI PARSING LAYER (Cá Mèo)                                    │
│  - Bóc tách: customer_name, phone, address, items, amount     │
│  - Confidence score                                            │
│  - parse_version + prompt_version                              │
│  - 4 trạng thái: parsed / needs_review / confirmed / rejected  │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  VALIDATION & CONFIRMATION                                     │
│  - Business rules check                                        │
│  - High confidence (>90%) → auto-suggest confirmed             │
│  - Medium (70-90%) → đưa vào queue needs_review                │
│  - Low (<70%) → bắt buộc manual review                         │
│  - Telegram card gửi Founder duyệt                             │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  OPERATIONAL WORKSPACE                                         │
│  - Telegram Bot + Group Bếp (-5566848105) + Inline buttons    │
│  - Tương lai: Mini App Kanban (Sprint 3)                       │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  PRIMARY DATABASE (My-Brain/brain.db) ← SOURCE OF TRUTH         │
│  - orders, customers, leads, order_items, audit_logs            │
│  - raw_events, parse_results                                   │
│  - needs_review, dead_letter (cần thêm ở Sprint 2)              │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  REPORTING SYNC                                                │
│  - Google Sheets: 4 tab (Orders, Daily, Leads, Errors)         │
│  - Upsert theo order_code, retry, reconciliation               │
└──────────────────────────────────────────────────────────────┘
```

### Nguyên tắc thiết kế
- **Event-driven** ở lớp tiếp nhận
- **DB là source of truth** — Sheets chỉ là báo cáo
- **AI chỉ đề xuất** — không tự chốt data nhạy cảm
- **Idempotent** cho mọi thao tác
- **UI ưu tiên tốc độ & truy vết**

---

## 3. Trạng thái Sprint 1 — Nền tảng dữ liệu

| Hạng mục | Trạng thái | Ghi chú |
|----------|-----------|---------|
| Canonical order schema | ✅ Done | `orders` + `order_items` chuẩn hóa |
| Raw event store | ✅ Done | Bảng `raw_events` (Sprint 1 migration) |
| Order table + parse result | ✅ Done | Bảng `parse_results` |
| Audit log | ✅ Done | Bảng `audit_logs` |
| Idempotency key + dedup | ✅ Done | PR #1 Antigravity fix |
| **4-layer timestamp** | ❌ TODO | Mới có `order_date` — cần tách |
| **SLA dashboard** | ❌ TODO | Chưa có |
| Adapter email Grab/Shopee | ⏸️ Skip | Không áp dụng Lẩu Nhà |

**Tỷ lệ hoàn thành Sprint 1: 70%**

---

## 4. AI Parser: Idempotency & Confirmation (Sprint 2)

### Nguy cơ chính
- AI không xác định → cùng input có thể cho output khác nhau
- Retry ghi đè data đã chốt
- Thiếu audit trail cho AI decision

### Thiết kế idempotency (đã có ở PR #1)
- Idempotency key theo thứ tự ưu tiên:
  1. Provider message ID (Telegram message_id)
  2. Hash(source, order_id, event_type, normalized_content)
- Lưu `parser_version`, `model_version`, `prompt_version`, `raw_input`
- Parser không ghi đè order đã confirmed

### Confidence & business rules
- **High (>90%):** Tự động tạo đơn + gửi thẻ Telegram, vẫn lưu audit
- **Medium (70-90%):** Tạo đơn + gắn cờ `needs_review=1`, Telegram nhắc Founder
- **Low (<70%):** KHÔNG tạo đơn, đưa vào `dead_letter` queue, Telegram hỏi Founder

### Confirmation loop
1. AI tạo parse result với confidence + các trường được đánh dấu "không chắc chắn"
2. Telegram gửi card có 3 nút: `[✅ Xác nhận] [✏️ Sửa] [❌ Hủy]`
3. Founder xác nhận → status = `confirmed`, ghi `confirmed_by` + `confirmed_at`
4. Sau confirmed → mới được tính vào báo cáo daily

### Retry safety
- Giới hạn tối đa 3 lần auto-retry
- Sau 3 lần → chuyển manual review
- Không gửi lặp cùng 1 yêu cầu xác nhận nếu status chưa đổi

---

## 5. Telegram Operational Workspace

### Mini App v0.1 (HIỆN TẠI)
- Bot `@cameodev_bot` (Founder chat với Cá Mèo)
- Bot `laumangdi_bot` (gửi thẻ đơn về Group Bếp `-5566848105`)
- Inline buttons: `[Chốt đơn] [Lấy mã QR] [Hủy đơn]`
- **Đủ dùng cho 1 cửa hàng, chưa có Kanban đầy đủ**

### Mini App v2 (SPRINT 3 — tương lai)
Kanban 8 cột:
1. New / Chưa phân loại
2. AI Parsed / Đã đọc
3. Needs Confirmation / Chờ xác nhận
4. Confirmed / Đã xác nhận
5. In Preparation / Đang chuẩn bị
6. Ready / Sẵn sàng giao
7. Completed / Hoàn tất
8. Exception / Ngoại lệ

Tính năng tối thiểu:
- Lọc theo cửa hàng, kênh, tuổi đơn, priority, status
- Xem raw event + parse result + audit log
- Sửa/xác nhận từng trường
- Gán người phụ trách
- Bulk action cho thao tác an toàn
- Cảnh báo late event, duplicate, quá SLA
- Phân quyền: owner / manager / operator / read-only
- Command có request_id chống ghi đè khi concurrent

---

## 6. Primary DB vs Google Sheets

### DB chính chịu trách nhiệm
- Order + trạng thái hiện tại
- Raw events + parse attempts
- Confirmation records
- Audit log
- Idempotency keys
- User, role, store
- Retry queue + sync status

### Google Sheets phù hợp cho
- Báo cáo doanh thu / vận hành
- KPI theo ngày / ca / cửa hàng
- Export cho kế toán
- Ad-hoc analysis

### Schema Sheets đề xuất (4 tab)

**Tab 1: `Orders`** — 1 dòng = 1 đơn (group theo order_code)
| Cột | Mô tả |
|-----|--------|
| order_code | Mã đơn (khóa chính) |
| order_date | Ngày đặt |
| customer_name | Tên khách |
| phone | SĐT |
| address | Địa chỉ giao |
| items | Danh sách món (text) |
| total_amount | Tổng tiền món |
| shipping_fee | Phí ship |
| deposit_amount | Cọc bếp |
| total_collection | Tổng thu |
| status | pending/paid/completed/cancelled |
| channel | telegram/website/admin |
| confidence | AI confidence |
| confirm_by | Người xác nhận |
| sync_version | Phiên bản sync |
| last_synced_at | Thời gian sync cuối |

**Tab 2: `Daily Summary`** — auto-fill bằng công thức
| Cột | Mô tả |
|-----|--------|
| date | Ngày |
| total_orders | Số đơn (unique order_code) |
| revenue | Doanh thu thuần |
| collection | Tổng tiền thu |
| deposit | Tổng cọc bếp |
| top_product | Sản phẩm bán chạy |

**Tab 3: `Leads`** — 1 dòng = 1 lead từ form khảo sát
| Cột | Mô tả |
|-----|--------|
| id | ID lead |
| name | Tên khách |
| phone | SĐT |
| email | Email |
| answers | Câu trả lời khảo sát |
| voucher | Mã voucher |
| code_used | 0/1 |
| created_at | Ngày tạo |

**Tab 4: `Errors / Manual Review`** — các đơn cần review
| Cột | Mô tả |
|-----|--------|
| order_code | Mã đơn |
| error_type | Loại lỗi |
| raw_text | Tin nhắn gốc |
| parse_attempt | Số lần parse |
| assigned_to | Người xử lý |
| status | pending/resolved |

### Cơ chế sync
- Upsert theo order_code (khóa ổn định)
- Ghi `last_synced_at`, `sync_version`, `sync_status`
- Sync theo event hoặc batch nhỏ (5-10 đơn/lần)
- Exponential backoff khi fail
- Tombstone cho đơn cancelled (không xóa hẳn)
- Reconciliation job định kỳ (mỗi 6h) so sánh tổng tiền giữa DB và Sheets
- User chỉnh Sheets = ghi chú, KHÔNG ghi ngược DB

---

## 7. Roadmap — Đơn giản hóa từ 4 sprint xuống 2 sprint

> Lý do: Lẩu Nhà là 1 cửa hàng + team solo. 4 sprint quá nhiều, 2 sprint đủ dùng.

### 🟡 SPRINT A — Hoàn thiện nền tảng (còn lại của Sprint 1 + Sprint 2)
**Mục tiêu:** Số liệu đúng, có thể đo được, có vòng xác nhận rõ ràng.

| Task | Mô tả | Status |
|------|-------|--------|
| A1 | Tách 4-timestamp (source/parse/confirm/sync) | ❌ TODO |
| A2 | Tạo bảng `needs_review` queue | ❌ TODO |
| A3 | Tạo bảng `dead_letter` cho parse fail | ❌ TODO |
| A4 | Parser versioning (parser_version, prompt_version) | ❌ TODO |
| A5 | Confidence threshold: >90% auto, 70-90% queue, <70% reject | ❌ TODO |
| A6 | Field-level accuracy tracking | ❌ TODO |
| A7 | SLA dashboard (P50/P95 latency) | ❌ TODO |
| A8 | Retry limit (max 3 lần) + manual fallback | ❌ TODO |

### 🟡 SPRINT B — Google Sheets sync + nâng cấp báo cáo
**Mục tiêu:** Sếp xem báo cáo trên Sheets hàng ngày, không cần vào Admin Panel.

| Task | Mô tả | Status |
|------|-------|--------|
| B1 | Tạo Google Service Account + share Sheet | ❌ TODO |
| B2 | API client cho Google Sheets v4 | ❌ TODO |
| B3 | Upsert sync Orders tab theo order_code | ❌ TODO |
| B4 | Daily Summary tự fill bằng công thức Sheets | ❌ TODO |
| B5 | Leads tab sync từ form khảo sát | ❌ TODO |
| B6 | Errors tab sync từ needs_review + dead_letter | ❌ TODO |
| B7 | Retry queue với exponential backoff | ❌ TODO |
| B8 | Reconciliation job (so sánh tổng tiền DB vs Sheets) | ❌ TODO |
| B9 | Cron job sync định kỳ 5-10 phút/lần | ❌ TODO |
| B10 | Tombstone cho cancelled orders | ❌ TODO |

### ⏸️ SPRINT C (tương lai, optional) — Kanban Mini App v2
| Task | Mô tả |
|------|-------|
| C1 | Mini App với 8-cột Kanban |
| C2 | Filter + phân quyền + assignment |
| C3 | Command có request_id chống ghi đè |
| C4 | Cảnh báo late event trong UI |

---

## 8. KPI & tiêu chuẩn vận hành

| KPI | Mục tiêu | Hiện tại |
|-----|----------|----------|
| P50 latency (event → Kanban) | <30s | ⏱️ Đo được sau Sprint A1 |
| P95 latency | <2 phút | ⏱️ Đo được sau Sprint A1 |
| Ingestion success rate | >99% | ✅ |
| Parse accuracy (field-level) | >95% | ⏱️ Đo được sau Sprint A6 |
| Manual review rate | <10% | ⏱️ Đo được sau Sprint A5 |
| Duplicate rate | <0.1% | ✅ (PR #1) |
| Retry trung bình | <1.5 | ⏱️ |
| Confirmation time (P50) | <5 phút | ⏱️ |
| Đơn vượt SLA | <2% | ⏱️ |
| Sheets sync success | >99% | ⏱️ Đo được sau Sprint B |
| Manual state corrections | <5/tuần | ⏱️ |

---

## 9. Quyết định nền tảng (CHỐT)

1. **DB là source of truth** — Sheets chỉ là báo cáo, không ghi ngược
2. **AI chỉ đề xuất** — không tự chốt data nhạy cảm (tiền, địa chỉ, SĐT)
3. **Telegram là operational cockpit** — Bot + Group Bếp là kênh chính
4. **Tất cả thao tác phải idempotent** — không tạo trùng dù retry nhiều lần
5. **Mọi state change phải có audit log** — truy vết được từ order về raw event

---

## 10. Task brief cho Antigravity

### 📋 Task SPRINT A1 — Tách 4-timestamp (ƯU TIÊN CAO)
**PR đề xuất:** `feat/sprint-a1-4-timestamp`

**Yêu cầu:**
1. Migration thêm 4 cột vào bảng `orders`:
   - `source_event_time TEXT` (thời điểm gốc từ Telegram/Website)
   - `received_time TEXT` (thời điểm bot nhận)
   - `parsed_time TEXT` (thời điểm AI parse xong)
   - `confirmed_time TEXT` (thời điểm Founder xác nhận)
2. Update `create_manual_order` (mcp/server.py) để fill 4 cột
3. Thêm index trên `source_event_time` để query nhanh
4. Backfill dữ liệu cũ (nếu có): set 4 cột = `order_date`
5. Update `get_daily_summary` để đo latency P50/P95

**Acceptance:**
- ✅ 4 cột tồn tại, NULL-safe
- ✅ Migration idempotent
- ✅ Đơn mới tự động fill đủ 4 cột
- ✅ Query latency chạy được

**KHÔNG làm:**
- ❌ Không sửa timezone
- ❌ Không đổi schema lớn
- ❌ Không xóa cột cũ

---

### 📋 Task SPRINT A2 — Tạo bảng `needs_review` queue
**PR đề xuất:** `feat/sprint-a2-needs-review-queue`

**Yêu cầu:**
1. Tạo bảng `needs_review`:
   ```sql
   CREATE TABLE IF NOT EXISTS needs_review (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     order_code TEXT,
     customer_name TEXT,
     phone TEXT,
     raw_text TEXT,
     parse_result_json TEXT,
     confidence REAL,
     issue_type TEXT,  -- 'low_confidence' | 'missing_field' | 'price_mismatch' | 'unknown_product'
     assigned_to TEXT,
     status TEXT DEFAULT 'pending',  -- 'pending' | 'confirmed' | 'rejected'
     created_at TEXT,
     resolved_at TEXT,
     resolved_by TEXT
   )
   ```
2. Khi AI parse có confidence 70-90% hoặc thiếu trường quan trọng → INSERT vào `needs_review`
3. Telegram gửi thẻ riêng cho queue này (khác thẻ đơn bình thường)
4. API endpoint: `GET /api/needs-review`, `POST /api/needs-review/{id}/resolve`
5. Update Admin UI: thêm tab "Cần xác nhận"

**Acceptance:**
- ✅ Bảng tạo thành công, idempotent
- ✅ Parse medium confidence tự động vào queue
- ✅ Admin UI hiển thị được
- ✅ Resolve action cập nhật status + ghi audit log

---

### 📋 Task SPRINT A3 — Tạo bảng `dead_letter` cho parse fail
**PR đề xuất:** `feat/sprint-a3-dead-letter-queue`

**Yêu cầu:**
1. Tạo bảng `dead_letter`:
   ```sql
   CREATE TABLE IF NOT EXISTS dead_letter (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     source TEXT,  -- 'telegram' | 'website' | 'admin'
     raw_text TEXT,
     error_type TEXT,  -- 'parse_failed' | 'max_retries' | 'invalid_format'
     error_message TEXT,
     attempt_count INTEGER DEFAULT 1,
     assigned_to TEXT,
     status TEXT DEFAULT 'open',  -- 'open' | 'resolved' | 'discarded'
     created_at TEXT,
     resolved_at TEXT
   )
   ```
2. Khi parse fail hoặc retry >3 lần → INSERT vào `dead_letter`
3. Telegram cảnh báo Founder mỗi khi có dead_letter mới
4. Heartbeat: nếu dead_letter mới trong 1h → gửi cảnh báo

**Acceptance:**
- ✅ Bảng tạo thành công
- ✅ Parse fail tự động vào dead_letter
- ✅ Telegram cảnh báo hoạt động
- ✅ Admin UI có tab "Lỗi parse"

---

### 📋 Task SPRINT B1-B3 — Google Sheets sync (Orders tab)
**PR đề xuất:** `feat/sprint-b1-sheets-orders-sync`

**Yêu cầu:**
1. Setup Google Service Account, lưu credentials JSON trong env var (KHÔNG commit)
2. Tạo Google Sheet template với 4 tab theo schema mục 6
3. Viết module `sheets_sync.py`:
   - Function `upsert_order(order_code, order_data)` — insert hoặc update theo order_code
   - Function `sync_daily_summary(date, summary_data)` — fill Daily tab
   - Function `sync_leads(leads_data)` — fill Leads tab
   - Function `sync_errors(errors_data)` — fill Errors tab
4. Tích hợp vào `create_manual_order`: sau khi tạo đơn OK → gọi `upsert_order`
5. Retry với exponential backoff (1s, 2s, 4s, 8s, max 5 lần)
6. Ghi `last_synced_at`, `sync_version`, `sync_status` vào bảng `orders`

**Acceptance:**
- ✅ Order mới tự động sync lên Sheets trong <10s
- ✅ Update order → Sheets cũng update (không tạo row mới)
- ✅ Cancel order → Sheets đánh dấu cancelled, không xóa
- ✅ Lỗi Sheets API → retry 5 lần, ghi log nếu vẫn fail
- ✅ Credentials KHÔNG lộ trong code (env var only)

**KHÔNG làm:**
- ❌ Không sync 2 chiều (Sheets → DB)
- ❌ Không tự động merge nếu user sửa Sheets
- ❌ Không xóa row khi sync fail

---

## 11. Cross-cutting concerns

### Audit log schema (đã có)
Mỗi state change phải ghi:
- `actor` (ai thực hiện: founder/operator/ai/system)
- `action` (create_order/update_status/confirm/cancel/sync)
- `entity_type` (order/customer/lead)
- `entity_id`
- `old_value`, `new_value` (JSON)
- `timestamp`
- `request_id` (chống duplicate command)

### Idempotency (đã có ở PR #1)
Mỗi write operation phải check idempotency_key trước khi ghi.

### Error handling
- Mọi exception phải ghi log + gửi alert (Telegram)
- Không nuốt lỗi im lặng
- Có fallback cho mọi dependency (Sheets API fail → vẫn ghi DB, retry Sheets sau)

---

## 12. Phụ lục — File tham chiếu

- `server.py` — backend chính (Lẩu Nhà)
- `mcp/server.py` — MCP tools (create_manual_order, check_order_and_payment, get_daily_summary)
- `admin.html` — Admin Panel
- `index.html` — Website chính
- `brain.db` — SQLite primary database
- `sop/SOP-AI-PARSE-ORDER-FLOW.md` — SOP đã merge (PR #4)

### PR liên quan
- PR #1: Investigation lệch dữ liệu daily
- PR #2: Fix GROUP BY order_code + tách bạch tài chính
- PR #3: Soft delete data test
- PR #4: SOP quy trình đặt món qua AI parse

---

*File này là living document — cập nhật mỗi khi sprint hoàn thành hoặc có quyết định kiến trúc mới.*
