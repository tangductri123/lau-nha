# 🛠️ Bản Thảo Thiết Kế 5 MCP Functions Cho Website Lẩu Nhà (laumangdi.com)

Dựa trên toàn bộ cấu trúc mã nguồn đã xây dựng (SQLite `brain.db`, FastAPI `server.py`, SePay VietQR, Resend Email Sequences, Bảng Leads khảo sát, Objections script), dưới đây là 5 MCP Function hữu ích nhất giúp chủ quán quản lý và vận hành trực tiếp qua Telegram / AI Agent hàng ngày.

---

## 1. `get_daily_summary` (Báo Cáo Tổng Quan Ngày)
- **Độ ưu tiên:** ⭐⭐⭐⭐⭐ (5/5)
- **Tình huống dùng hàng ngày:** Mỗi sáng hoặc cuối ngày, chỉ cần nhắn: *"Báo cáo doanh thu và đơn hàng hôm nay"* để AI Agent thống kê tức thì toàn bộ doanh số, số đơn đã thanh toán/chưa giao và lead mới.
- **Input params:**
  - `date` (`string`, tuỳ chọn, định dạng `YYYY-MM-DD` hoặc `"today"`, mặc định là `"today"`).
- **Output dự kiến:**
  ```json
  {
    "date": "2026-09-04",
    "total_revenue": 2450000,
    "total_orders": 8,
    "orders_by_status": {
      "paid": 6,
      "pending": 2,
      "completed": 5
    },
    "new_leads_count": 4,
    "top_selling_products": [
      {"name": "Set Lẩu Cặp Đôi (2-3 người)", "quantity": 5, "revenue": 1495000},
      {"name": "Set Lẩu Gia Đình (4-6 người)", "quantity": 3, "revenue": 1197000}
    ]
  }
  ```

---

## 2. `check_order_and_payment` (Tra Cứu Đơn & Đối Soát Thanh Toán Tức Thì)
- **Độ ưu tiên:** ⭐⭐⭐⭐⭐ (5/5)
- **Tình huống dùng hàng ngày:** Khi khách nhắn *"Anh vừa chuyển khoản cho đơn LN1024 rồi em check giúp anh"*, bạn chỉ cần nhắn bot: *"Kiểm tra thanh toán đơn LN1024"* để AI tự gọi SePay check biến động số dư và cập nhật trạng thái đơn sang `paid`.
- **Input params:**
  - `order_code` (`string`, tuỳ chọn): Mã đơn hàng (ví dụ: `"LN1024"`).
  - `phone` (`string`, tuỳ chọn): Số điện thoại khách hàng (nếu khách không nhớ mã đơn).
- **Output dự kiến:**
  ```json
  {
    "order_code": "LN1024",
    "customer": {
      "name": "Nguyễn Văn A",
      "phone": "0988123456",
      "address": "123 Lê Lợi, P. Bến Thành, Q.1"
    },
    "items": [
      {"name": "Set Lẩu Gia Đình", "quantity": 1, "price": 399000}
    ],
    "total_amount": 399000,
    "current_status": "paid",
    "payment_verified": true,
    "transaction_info": {
      "transaction_id": "1849204",
      "amount_in": 399000,
      "time": "2026-09-04 11:15:00",
      "content": "LN1024 chuyen tien lau"
    }
  }
  ```

---

## 3. `create_manual_order` (Lên Đơn Nhanh Cho Khách Qua Chat)
- **Độ ưu tiên:** ⭐⭐⭐⭐ (4/5)
- **Tình huống dùng hàng ngày:** Khi khách gọi hotline hoặc nhắn qua Zalo/Facebook, bạn chỉ cần gõ cho bot: *"Lên đơn cho chị Mai 0909123456, 1 Set Cặp Đôi vị Thái, mượn bếp cồn, giao 45 Nguyễn Huệ lúc 6h tối"*, AI sẽ tự động tạo đơn vào `brain.db`, sinh mã QR thanh toán và gửi email/Telegram xác nhận.
- **Input params:**
  - `customer_name` (`string`, bắt buộc): Tên khách hàng.
  - `phone` (`string`, bắt buộc): Số điện thoại nhận hàng.
  - `address` (`string`, bắt buộc): Địa chỉ giao hàng.
  - `items` (`array of objects`, bắt buộc): Danh sách món `[{"product_id": 1, "quantity": 1}]` hoặc tên sản phẩm.
  - `is_stove` (`boolean`, tuỳ chọn, mặc định `false`): Mượn bếp cồn và nồi nhôm.
  - `email` (`string`, tuỳ chọn): Email khách hàng (để gửi hoá đơn tự động).
  - `note` (`string`, tuỳ chọn): Ghi chú giao hàng / khẩu vị.
- **Output dự kiến:**
  ```json
  {
    "success": true,
    "order_code": "LN1025",
    "total_amount": 299000,
    "customer_id": 42,
    "qr_payment_url": "https://qr.sepay.vn/img?acc=22678555999&bank=MBBank&amount=299000&des=LN1025",
    "email_sent": true,
    "message": "Đã tạo đơn thành công LN1025 và gửi thông báo Telegram!"
  }
  ```

---

## 4. `search_leads_and_followup` (Quản Lý Lead Khảo Sát & Gợi Ý Chốt Sale)
- **Độ ưu tiên:** ⭐⭐⭐⭐ (4/5)
- **Tình huống dùng hàng ngày:** Bạn hỏi: *"Có khách nào mới điền khảo sát nhận mã giảm giá 50k chưa mua không?"*, AI trả về danh sách kèm theo nỗi bận tâm của khách (sợ cay, sợ nước lẩu không ngon...) để bạn gửi đúng thông điệp chốt sale.
- **Input params:**
  - `status` (`string`, tuỳ chọn, `"unused_code"` | `"all"` | `"recent"`, mặc định: `"unused_code"`).
  - `limit` (`integer`, tuỳ chọn, mặc định: 10).
- **Output dự kiến:**
  ```json
  {
    "total_leads": 12,
    "leads": [
      {
        "id": 15,
        "name": "Trần Thị B",
        "phone": "0912345678",
        "email": "ttb@gmail.com",
        "eat_with": "Gia đình có trẻ nhỏ",
        "main_concern": "Khẩu vị không cay cho bé",
        "discount_code": "LAUNHA50K",
        "code_used": 0,
        "created_at": "2026-09-04 09:30:00",
        "suggested_script": "Tư vấn Nước Lẩu Nấm Thanh Ngọt / Lẩu Collagen không cay, an toàn cho trẻ nhỏ."
      }
    ]
  }
  ```

---

## 5. `update_product_stock_price` (Cập Nhật Giá & Bật/Tắt Tồn Kho Nhanh)
- **Độ ưu tiên:** ⭐⭐⭐ (3/5)
- **Tình huống dùng hàng ngày:** Khi quán đột ngột hết nguyên liệu hoặc muốn điều chỉnh nhanh giá bán, chỉ cần nhắn: *"Tạm tắt Set Lẩu Hải Sản"* hoặc *"Cập nhật giá Set Cặp Đôi thành 279k"* mà không cần mở máy tính vào web admin.
- **Input params:**
  - `product_id` (`integer`, tuỳ chọn): ID sản phẩm (hoặc `product_name`).
  - `product_name` (`string`, tuỳ chọn): Tên sản phẩm cần tìm.
  - `price` (`number`, tuỳ chọn): Giá mới cần cập nhật.
  - `stock` (`integer`, tuỳ chọn): Số lượng tồn kho mới.
  - `is_available` (`boolean`, tuỳ chọn): `true` (còn hàng) / `false` (hết hàng).
- **Output dự kiến:**
  ```json
  {
    "success": true,
    "product_id": 1,
    "product_name": "Set Lẩu Cặp Đôi (2-3 người)",
    "old_price": 299000,
    "new_price": 279000,
    "stock": 50,
    "message": "Đã cập nhật giá bán mới thành công!"
  }
  ```
