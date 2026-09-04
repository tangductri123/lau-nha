# 🛠️ Danh Sách 3 MCP Functions Chính Thức Cho Website Lẩu Nhà (laumangdi.com)

Hệ thống MCP Server của **Lẩu Nhà** trang bị "tay chân" cho AI Agent GoClaw tương tác trực tiếp với cơ sở dữ liệu SQLite (`brain.db`), cổng thanh toán tự động VietQR/SePay, dịch vụ email Resend và nhóm thông báo Telegram.

Dưới đây là 3 function cốt lõi được kích hoạt và sử dụng hàng ngày:

---

## 1. `get_daily_summary` (Báo Cáo Tổng Quan Ngày)
- **Mục đích:** Thống kê nhanh doanh thu các đơn đã thanh toán, tổng số đơn hàng theo trạng thái, số lượng lead khảo sát mới và các món lẩu bán chạy nhất.
- **Input params:**
  - `date` (`string`, tuỳ chọn): Ngày xem báo cáo định dạng `YYYY-MM-DD` hoặc `"today"` (mặc định: `"today"`).
- **Output dự kiến:**
  ```json
  {
    "date": "2026-09-04",
    "total_revenue_vnd": 1197000,
    "total_revenue_formatted": "1,197,000 đ",
    "total_orders": 4,
    "orders_by_status": {
      "paid": 3,
      "pending": 1
    },
    "new_leads_count": 2,
    "top_products": [
      {"name": "Set Lẩu Cặp Đôi (2-3 người)", "quantity": 2},
      {"name": "Set Lẩu Gia Đình (4-6 người)", "quantity": 1}
    ]
  }
  ```
- **💬 Ví dụ câu nhắn Telegram sẽ trigger function này:**
  - *"Hôm nay quán bán được bao nhiêu đơn rồi em?"*
  - *"Báo cáo doanh thu ngày hôm nay"*
  - *"Tổng kết tình hình kinh doanh hôm nay: có bao nhiêu đơn đã thanh toán, món nào bán chạy nhất?"*
  - *"Cho anh xem báo cáo ngày 2026-09-03"*

---

## 2. `check_order_and_payment` (Tra Cứu Đơn & Đối Soát Tiền Về SePay)
- **Mục đích:** Tra cứu chi tiết đơn hàng theo mã đơn hoặc số điện thoại. Tự động kết nối SePay API để đối soát biến động số dư tài khoản ngân hàng (`22678555999`), nếu khớp tiền sẽ **tự động chuyển trạng thái đơn sang `paid`**.
- **Input params:**
  - `order_code` (`string`, tuỳ chọn): Mã đơn hàng (ví dụ: `"LN1024"`).
  - `phone` (`string`, tuỳ chọn): Số điện thoại khách đặt hàng.
- **Output dự kiến:**
  ```json
  {
    "found": true,
    "order_code": "LN1024",
    "customer_name": "Nguyễn Văn A",
    "phone": "0988123456",
    "items": ["Set Lẩu Gia Đình (4-6 người)"],
    "amount": 399000,
    "amount_formatted": "399,000 đ",
    "status": "paid",
    "payment_verified": true,
    "transaction_details": {
      "transaction_id": "1849204",
      "amount_in": 399000,
      "transaction_date": "2026-09-04 11:15:00",
      "content": "LN1024 chuyen tien lau"
    }
  }
  ```
- **💬 Ví dụ câu nhắn Telegram sẽ trigger function này:**
  - *"Kiểm tra giúp anh đơn LN1024 xem khách chuyển khoản chưa"*
  - *"Khách bảo vừa chuyển tiền đơn LN1025 rồi, check giúp anh"*
  - *"Tra cứu đơn hàng của số điện thoại 0988123456"*
  - *"Check tiền về đơn LN1024"*

---

## 3. `create_manual_order` (Tạo Đơn Hàng Nhanh Cho Khách Qua Chat)
- **Mục đích:** Lên đơn trực tiếp khi nhận khách từ Zalo/Hotline/Facebook: lưu vào cơ sở dữ liệu `brain.db`, sinh đường link thanh toán mã QR VietQR / SePay, bắn thông báo tức thì vào nhóm Telegram của quán và gửi email hoá đơn tự động cho khách qua Resend.
- **Input params:**
  - `customer_name` (`string`, bắt buộc): Họ tên khách hàng.
  - `phone` (`string`, bắt buộc): Số điện thoại nhận hàng.
  - `address` (`string`, bắt buộc): Địa chỉ giao hàng.
  - `product_name` (`string`, tuỳ chọn): Tên set lẩu (mặc định: `"Set Lẩu Cặp Đôi (2-3 người)"`).
  - `amount` (`number`, tuỳ chọn): Giá trị đơn hàng (mặc định: `299000`).
  - `is_stove` (`boolean`, tuỳ chọn): Khách có mượn bếp cồn và nồi nhôm không (mặc định: `false`).
  - `email` (`string`, tuỳ chọn): Email khách hàng để nhận hoá đơn.
  - `note` (`string`, tuỳ chọn): Ghi chú khẩu vị, thời gian giao hàng.
- **Output dự kiến:**
  ```json
  {
    "success": true,
    "order_code": "LN1026",
    "order_id": 45,
    "customer_id": 12,
    "total_amount": 299000,
    "total_amount_formatted": "299,000 đ",
    "qr_payment_url": "https://qr.sepay.vn/img?acc=22678555999&bank=MBBank&amount=299000&des=LN1026",
    "telegram_notified": true,
    "email_sent": true,
    "message": "Đã tạo đơn thành công mã #LN1026 cho khách hàng Nguyễn Văn A!"
  }
  ```
- **💬 Ví dụ câu nhắn Telegram sẽ trigger function này:**
  - *"Lên đơn cho anh Nam 0912345678, 1 Set Cặp Đôi, giao 123 Lê Lợi, mượn bếp cồn"*
  - *"Tạo đơn: Chị Linh, sđt 0909888999, 1 Set Gia Đình vị Thái, địa chỉ 45 Nguyễn Huệ Q1, email linh@gmail.com, giao lúc 18h30"*
  - *"Khách đặt 1 set couple lẩu kim chi: Trần Văn B, 0987654321, Landmark 81 Bình Thạnh"*
