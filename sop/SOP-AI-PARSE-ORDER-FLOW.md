# SOP: Quy Trình Đặt Món Qua AI Parse & Điều Phối Đơn Hàng Telegram

> **Mục tiêu:** Chuẩn hóa luồng đơn hàng từ lúc khách nhắn tin → AI bóc tách → Bếp nhận đơn → Giao hàng, đảm bảo không rớt đơn, không sót thông tin, không chậm xác nhận.
> **Người thực hiện:** Cá Mèo (AI Parser) + Founder + Nhân viên Bếp + Shipper.
> **Thời gian tiêu chuẩn:** Từ lúc khách nhắn → Thẻ đơn bay về Group Bếp ≤ **30 giây**. Từ Thẻ đơn → Bếp xác nhận ≤ **5 phút**.

---

## 1. Chuẩn bị & Công cụ

- [ ] **Cá Mèo Bot** (`@cameodev_bot`) đang chạy, kết nối MCP Server ổn định
- [ ] **Group Bếp Telegram** (`-5566848105`) đã add bot `laumangdi_bot` làm admin
- [ ] **Admin Panel** (`laumangdi.com/admin.html`) truy cập được
- [ ] **MCP tools** hoạt động: `create_manual_order`, `check_order_and_payment`, `get_daily_summary`
- [ ] **Database** `My-Brain/brain.db` đang ghi, không full disk

---

## 2. Các bước thực hiện

### Giai đoạn 1: Khách nhắn tin đặt món

**1. Bước 1: Khách gửi tin nhắn đặt món (qua Telegram/Website/Zalo)**
- Tin nhắn cần chứa tối thiểu: **Tên + SĐT + Địa chỉ + Món muốn đặt**
- Có thể kèm: Giờ giao, ghi chú cay/không cay, mượn bếp, voucher
- ✅ Tiêu chuẩn: Tin nhắn có đủ 4 trường bắt buộc. Nếu thiếu → chuyển sang Bước 2B.

**2. Bước 2A: AI tự động parse (Cá Mèo bóc tách)**
- Cá Mèo đọc tin nhắn, bóc tách: `customer_name`, `phone`, `address`, `product_name` / `items[]`, `amount`, `is_stove`, `note`
- Tự động tính: shipping fee theo quận, voucher (nếu có), deposit 200k nếu mượn bếp
- ✅ Tiêu chuẩn: AI parse xong trong ≤ 5 giây, độ tin cậy ≥ 85%.

**3. Bước 2B: Hỏi lại nếu thiếu thông tin (Fallback)**
- Thiếu SĐT → *"Sếp ơi cho em xin SĐT khách để chốt đơn ạ"*
- Thiếu địa chỉ → *"Địa chỉ giao cụ thể là quận nào ạ?"*
- Mơ hồ về món → *"Khách chọn set nào: Gia đình 4-6 người hay Cặp đôi 2-3 người ạ?"*
- ✅ Tiêu chuẩn: Hỏi 1 lần, gọn, đúng trọng tâm. Không hỏi lan man.

### Giai đoạn 2: Tạo đơn & bắn thẻ về Bếp

**4. Bước 3: Gọi tool `create_manual_order`**
- **Đọc lại tham số 1 lần** trước khi gọi (đặc biệt `amount`, `phone`, `is_stove`)
- Gọi tool với đầy đủ: `customer_name`, `phone`, `address`, `items` (hoặc `product_name` + `amount`), `note`, `raw_text`
- Nếu mượn bếp: `is_stove=true`, `deposit_amount=200000`
- ✅ Tiêu chuẩn: Tool trả về `success=true` + mã đơn `#LNxxxx`.

**5. Bước 4: Verify Thẻ đơn đã bay về Group Bếp**
- Sau khi tool chạy → Thẻ đơn tự động gửi về Group `-5566848105`
- Thẻ gồm: Mã đơn, tên khách, SĐT, địa chỉ, món, tổng tiền, **3 nút: [Chốt đơn] [Lấy mã QR] [Hủy đơn]**
- ✅ Tiêu chuẩn: Thẻ hiện trong Group Bếp trong ≤ 5 giây.

### Giai đoạn 3: Bếp tiếp nhận & chuẩn bị

**6. Bước 5: Nhân viên Bếp bấm nút "Chốt đơn" trên thẻ**
- Bếp bấm nút → trạng thái đơn chuyển `pending → confirmed`
- SePay webhook sẽ đối soát khi khách chuyển khoản
- Nếu bếp thấy thiếu nguyên liệu → bấm "Hủy đơn" + báo Founder ngay
- ✅ Tiêu chuẩn: Bếp chốt trong ≤ 5 phút. Nếu quá 10 phút chưa chốt → Cá Mèo Heartbeat cảnh báo Founder.

**7. Bước 6: Bếp chuẩn bị món theo SOP đóng gói**
- Tuân thủ SOP riêng: đúng định lượng, niêm phong, kèm Kit dọn 30s
- ✅ Tiêu chuẩn: Đơn sẵn sàng giao trong thời gian cam kết với khách.

### Giai đoạn 4: Đối soát thanh toán & giao hàng

**8. Bước 7: Đối soát tiền qua SePay**
- Khi khách chuyển khoản → SePay webhook tự bắn về hệ thống
- Gọi `check_order_and_payment(order_code="LNxxxx")` để verify tiền đã về
- ✅ Tiêu chuẩn: Tiền khớp với tổng đơn (bao gồm ship + cọc bếp nếu có).

**9. Bước 8: Bàn giao Shipper**
- Bếp bấm "Sẵn sàng giao" trên Admin UI
- Shipper đến lấy, kiểm tra niêm phong + đơn trước khi đi
- ✅ Tiêu chuẩn: Đơn đến tay khách đúng giờ, đúng món.

**10. Bước 9: Hoàn tất đơn & đánh giá**
- Sau giao thành công → cập nhật `status=completed` trên Admin
- Nếu có sự cố (giao trễ, sai món, đổi/hoàn) → mở ticket Telegram báo Founder
- ✅ Tiêu chuẩn: Đơn closed trong ngày, mọi sự cố ghi nhận vào `audit_logs`.

### Giai đoạn 5: Báo cáo cuối ngày

**11. Bước 10: Cá Mèo báo cáo daily tự động**
- Gọi `get_daily_summary(date="today")` khi Founder yêu cầu
- Báo cáo gồm: Tổng đơn, doanh thu thuần, tổng tiền thu, cọc bếp, top món
- ✅ Tiêu chuẩn: Số liệu khớp với Admin UI từng đồng (đã fix ở PR #2).

---

## 3. Xử lý sự cố & Tình huống phát sinh

| Sự cố / Tình huống | Nguyên nhân | Cách xử lý |
| :--- | :--- | :--- |
| AI parse sai tên/sđt/địa chỉ | Khách viết tắt, sai chính tả | Founder đọc lại raw_text trước khi gọi tool. Nếu sai → sửa tay tham số rồi mới gọi. |
| Tool báo lỗi "Không tìm thấy đơn LNxxxx" | Khách chat lại trùng mã, hoặc bug MCP | Gọi `check_order_and_payment` để check. Nếu không có → tạo đơn mới. |
| Thẻ đơn không bay về Group Bếp | Bot mất quyền, hoặc group ID sai | Check log Telegram, restart bot. Verify group ID = `-5566848105`. |
| Không CK sau 30 phút | Khách đổi ý, hoặc quên | Cá Mèo nhắc 1 lần. Sau 1 tiếng → báo Founder quyết định giữ/hủy. |
| Hết nguyên liệu (cốt/thịt) | Tồn kho chạm đáy, không kịp nhập | Heartbeat cảnh báo → Founder nhập gấp. Tạm dừng nhận đơn có món đó. |
| Khách yêu cầu hủy sau chốt | Đổi ý, đặt nhầm | Bếp bấm "Hủy đơn". Cá Mèo refund nếu đã CK. |
| Trùng đơn (khách nhắn 2 lần) | Khách không biết đã gửi | Idempotency Key (PR #1) chặn tự động. Lọt → Founder check, xóa đơn trùng. |
| SePay không đối soát được | Khách CK sai nội dung/số tiền | Check SĐT trong `check_order_and_payment`. Liên hệ khách nếu cần. |

---

## 4. Bảng kiểm tra trước khi bàn giao (Checklist QC)

### Trước khi Founder gọi `create_manual_order`:
- [ ] Đã đọc kỹ raw_text của khách
- [ ] Tên khách viết đúng, có dấu
- [ ] SĐT đúng 10 số, đầu 03/05/07/08/09
- [ ] Địa chỉ đầy đủ: số nhà + đường + phường + quận
- [ ] Món đúng (set/cỡ/vị), số lượng đúng
- [ ] Ghi chú: giờ giao, cay/không cay, mượn bếp
- [ ] Mượn bếp → `is_stove=true`, cọc 200k
- [ ] Có voucher → truyền `voucher_code` hoặc `discount_amount`
- [ ] Tổng tiền khớp với menu

### Trước khi Bếp bấm "Sẵn sàng giao":
- [ ] Đúng món theo thẻ đơn
- [ ] Đủ Kit dọn 30s
- [ ] Niêm phong túi cốt, không rỉ
- [ ] Có phiếu cảm ơn kèm theo
- [ ] Thời gian giao đúng cam kết

---

## 5. Ghi nhận & Báo cáo

- **Tất cả đơn** log vào `brain.db` (`orders`) + `audit_logs` (mọi parse/edit/delete)
- **Báo cáo lỗi AI parse**: Báo Founder qua Telegram ngay (kèm raw_text + AI output)
- **Báo cáo sự cố giao hàng**: Ghi ticket Telegram + update `note` trên Admin
- **Báo cáo daily**: Cá Mèo gửi khi Founder yêu cầu
- **Cú pháp báo cáo sự cố mẫu:**
  ```
  ⚠️ [BÁO CÁO SỰ CỐ - ĐƠN #LNxxxx]
  - Khách: [Tên] - [SĐT]
  - Sự cố: [Mô tả ngắn]
  - Thời gian: [HH:MM]
  - Đề xuất: [Phương án]
  ```

---

## 📎 Phụ lục: Tham chiếu nhanh

- **Tool chính:** `create_manual_order`, `check_order_and_payment`, `get_daily_summary`
- **Group Bếp:** Telegram `-5566848105` (qua bot `laumangdi_bot`)
- **Admin UI:** `https://laumangdi.com/admin.html`
- **Database:** `My-Brain/brain.db` (bảng: `orders`, `customers`, `leads`, `audit_logs`, `raw_events`, `parse_results`)
- **PR liên quan:**
  - PR #1: Investigation lệch dữ liệu daily
  - PR #2: Fix GROUP BY order_code + tách bạch tài chính
  - PR #3: Soft delete data test

---

## 📌 Ghi chú

SOP này có thể được tách nhỏ thành 3 SOP riêng cho từng vai trò:
- **SOP-A: Cho Founder/Cá Mèo** (bước 1-4, tiếp nhận + parse + tạo đơn)
- **SOP-B: Cho Bếp** (bước 5-6, chốt đơn + đóng gói)
- **SOP-C: Cho Shipper/CSKH** (bước 7-9, đối soát + giao + hoàn tất)
