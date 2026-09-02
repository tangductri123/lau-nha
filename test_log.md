# 📋 NHẬT KÝ KIỂM THỬ & SỬA LỖI DỰ ÁN (TEST LOG)
**Dự án:** Lẩu Mang Đi (Lẩu Nhà - laumangdi.com)  
**Thời gian ghi nhận:** Từ 01/09/2026 đến 02/09/2026  
**Người thực hiện:** Antigravity Coding Assistant  

---

## 📑 MỤC LỤC TỔNG HỢP CÁC LỖI & GIẢI PHÁP

1. [Lỗi 1: Đơn hàng bị chia thành nhiều dòng rời rạc cho 1 Mã Hóa Đơn](#lỗi-1-đơn-hàng-bị-chia-thành-nhiều-dòng-rời-rạc-cho-1-mã-hóa-đơn)
2. [Lỗi 2: Trang Admin không nhận thay đổi do Server Python cũ chiếm RAM](#lỗi-2-trang-admin-không-nhận-thay-đổi-do-server-python-cũ-chiếm-ram)
3. [Lỗi 3: Lỗi mã hóa ký tự Tiếng Việt (UnicodeEncodeError) trên Windows Terminal](#lỗi-3-lỗi-mã-hóa-ký-tự-tiếng-việt-unicodeencodeerror-trên-windows-terminal)
4. [Lỗi 4: Đơn hàng từ Landing Page không tự động lưu vào Admin Database](#lỗi-4-đơn-hàng-từ-landing-page-không-tự-động-lưu-vào-admin-database)
5. [Lỗi 5: Quét mã QR VietQR/SePay thanh toán xong nhưng đơn không đổi trạng thái 'paid'](#lỗi-5-quét-mã-qr-vietqrsepay-thanh-toán-xong-nhưng-đơn-không-đổi-trạng-thái-paid)
6. [Lỗi 6: Lỗi cú pháp JavaScript khiến Admin Dashboard không hiển thị dữ liệu](#lỗi-6-lỗi-cú-pháp-javascript-khiến-admin-dashboard-không-hiển-thị-dữ-liệu)
7. [Lỗi 7: Vercel Build lỗi do ký tự BOM trong file `vercel.json`](#lỗi-7-vercel-build-lỗi-do-ký-tự-bom-trong-file-verceljson)
8. [Lỗi 8: Railway Deployment bị lỗi Port Binding và nhận diện Python Buildpack](#lỗi-8-railway-deployment-bị-lỗi-port-binding-và-nhận-diện-python-buildpack)
9. [Lỗi 9: Đồng bộ gửi Email xác nhận và Chuỗi 3 Email Sequence (Resend API)](#lỗi-9-đồng-bộ-gửi-email-xác-nhận-và-chuỗi-3-email-sequence-resend-api)

---

## 🛠️ CHI TIẾT TỪNG LỖI & CÁCH KHẮC PHỤC

### 🔴 Lỗi 1: Đơn hàng bị chia thành nhiều dòng rời rạc cho 1 Mã Hóa Đơn
* **Ngày phát hiện:** 02/09/2026
* **Hiện tượng:** Khách đặt 1 đơn gồm 3 món (ví dụ: 1 Lẩu Thái, 1 Set Topping, 1 Mì tươi) có cùng mã `#LN8206`, nhưng trong bảng Quản trị Đơn Hàng lại hiển thị thành 3 dòng riêng biệt, gây khó khăn cho việc quản lý hóa đơn và tính doanh thu.
* **Nguyên nhân:** 
  * Cấu trúc bảng `orders` trong SQLite lưu mỗi món là 1 dòng độc lập.
  * API `GET /api/orders` trước đó trả về danh sách thô (flat list) trực tiếp từ database mà không có cơ chế gom nhóm (`group by`).
* **Cách khắc phục:**
  1. **Backend (`server.py`):**
     * Viết lại hàm `list_orders()`: Thuật toán gom nhóm các dòng có cùng `order_code` thành 1 đối tượng Hóa Đơn duy nhất.
     * Cấu trúc trả về bao gồm: `order_code`, `customer_name`, `items` (mảng danh sách từng món), `total_amount` (tổng tiền của toàn bộ hóa đơn), `status`.
     * Nâng cấp `create_order`, `update_order`, `delete_order`: Tạo mã HĐ chung cho toàn bộ món trong đơn; cập nhật hoặc xóa đồng loạt tất cả các món thuộc mã HĐ đó.
  2. **Frontend ([admin/index.html](file:///c:/Users/Admin/.gemini/antigravity/scratch/lau-mang-di-landing/admin/index.html) & [admin.html](file:///c:/Users/Admin/.gemini/antigravity/scratch/lau-mang-di-landing/admin.html)):**
     * Cập nhật bảng Đơn hàng: 1 Hóa Đơn = 1 Dòng.
     * Cột "Danh Sách Món": Hiển thị danh sách các món kèm badge loại sản phẩm và giá từng món.
     * Cột "Tổng Tiền": Hiển thị tổng thanh toán của cả hóa đơn.
     * Cập nhật Modal Chỉnh Sửa để xem danh sách món và đổi trạng thái cho toàn bộ hóa đơn.

---

### 🔴 Lỗi 2: Trang Admin không nhận thay đổi do Server Python cũ chiếm RAM
* **Ngày phát hiện:** 02/09/2026
* **Hiện tượng:** Đã chỉnh sửa code `server.py` và `admin/index.html` nhưng khi truy cập `http://localhost:8080/admin` dữ liệu vẫn hiển thị dạng cũ (22 dòng chưa gộp).
* **Nguyên nhân:** Tiến trình Python trước đó (PID `19936`) đang chạy ngầm trên cổng 8080 mà không có tính năng live-reload, dẫn đến việc bộ nhớ RAM vẫn lưu mã nguồn cũ.
* **Cách khắc phục:**
  1. Kiểm tra port và tiến trình: `Get-NetTCPConnection -LocalPort 8080`.
  2. Buộc dừng tiến trình cũ: `Stop-Process -Id 19936 -Force`.
  3. Khởi động lại Server mới dưới dạng Daemon chạy nền.
  4. Hướng dẫn xóa cache trình duyệt bằng `Ctrl + F5`.

---

### 🔴 Lỗi 3: Lỗi mã hóa ký tự Tiếng Việt (UnicodeEncodeError) trên Windows Terminal
* **Ngày phát hiện:** 02/09/2026
* **Hiện tượng:** Khi chạy các file test Python hoặc script truy vấn dữ liệu có chứa tiếng Việt có dấu, console báo lỗi: `UnicodeEncodeError: 'charmap' codec can't encode character '\u1eaf' in position...`.
* **Nguyên nhân:** Môi trường Windows Console mặc định sử dụng bảng mã `CP1252` hoặc `CP936` thay vì chuẩn `UTF-8`.
* **Cách khắc phục:**
  * Thêm đoạn mã chuẩn hóa UTF-8 vào đầu tất cả các file Python (`server.py`, `email_service.py`, các file test):
    ```python
    import sys
    if sys.stdout.encoding != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
    ```

---

### 🔴 Lỗi 4: Đơn hàng từ Landing Page không tự động lưu vào Admin Database
* **Ngày phát hiện:** 01/09/2026
* **Hiện tượng:** Khách hàng điền form đặt lẩu và bấm "Xác Nhận Đặt Hàng" trên Landing Page, hệ thống thông báo thành công nhưng trong cơ sở dữ liệu `brain.db` không có bản ghi nào.
* **Nguyên nhân:** Landing Page ban đầu chỉ lưu dữ liệu vào LocalStorage/State tạm thời của JavaScript mà chưa gửi HTTP POST Request tới API backend.
* **Cách khắc phục:**
  1. Xây dựng endpoint `@app.post("/api/send-order")` trong `server.py`.
  2. Bổ sung logic:
     * Kiểm tra và tự động lưu/cập nhật thông tin khách vào bảng `customers`.
     * Lưu từng món vào bảng `orders` với mã hóa đơn `order_code`.
     * Tự động kiểm tra tồn kho và trừ số lượng sản phẩm vật lý (`physical`).
     * Kích hoạt gửi email xác nhận đơn tự động qua Resend API.
  3. Cập nhật `main.js` trên website để gửi payload chuẩn tới `/api/send-order`.

---

### 🔴 Lỗi 5: Quét mã QR VietQR/SePay thanh toán xong nhưng đơn không đổi trạng thái 'paid'
* **Ngày phát hiện:** 01/09/2026
* **Hiện tượng:** Khách chuyển khoản quét mã VietQR thành công, giao diện popup trên web báo "Đã nhận thanh toán", nhưng trạng thái trong database Admin vẫn giữ nguyên là `pending`.
* **Nguyên nhân:** File `api/check-payment.js` xác thực giao dịch thành công từ SePay API nhưng chưa có lệnh đồng bộ cập nhật ngược về cơ sở dữ liệu Backend.
* **Cách khắc phục:**
  1. Viết thêm endpoint `@app.post("/api/orders/mark-paid")` và `@app.post("/api/payment-webhook")` trong `server.py`.
  2. Khi `check-payment.js` phát hiện tiền vào khớp với mã đơn hàng (ví dụ: `LN3232`), script tự động gọi POST tới `/api/orders/mark-paid`.
  3. Hệ thống tự động chuyển tất cả các món thuộc mã hóa đơn đó sang trạng thái `paid` (`💳 Đã thanh toán`).

---

### 🔴 Lỗi 6: Lỗi cú pháp JavaScript khiến Admin Dashboard không hiển thị dữ liệu
* **Ngày phát hiện:** 01/09/2026
* **Hiện tượng:** Truy cập trang `/admin`, các thẻ thống kê tổng quan (Sản phẩm, Khách hàng, Đơn hàng, Lead) và bảng dữ liệu bị trống.
* **Nguyên nhân:** Lỗi cú pháp thiếu dấu ngoặc đóng trong hàm xử lý Promise và render HTML template trong file `admin/index.html`.
* **Cách khắc phục:**
  1. Kiểm tra Console log của trình duyệt để xác định chính xác dòng bị lỗi cú pháp.
  2. Cấu trúc lại toàn bộ các hàm bất đồng bộ: `loadProducts()`, `loadCustomers()`, `loadLeads()`, `loadOrders()`, `loadEmailSequences()`.
  3. Đảm bảo file [admin/index.html](file:///c:/Users/Admin/.gemini/antigravity/scratch/lau-mang-di-landing/admin/index.html) và [admin.html](file:///c:/Users/Admin/.gemini/antigravity/scratch/lau-mang-di-landing/admin.html) luôn đồng bộ 100%.

---

### 🔴 Lỗi 7: Vercel Build lỗi do ký tự BOM trong file `vercel.json`
* **Ngày phát hiện:** 01/09/2026
* **Hiện tượng:** Khi deploy frontend lên Vercel, quy trình build bị lỗi: `Error: Failed to parse vercel.json: Unexpected token...`.
* **Nguyên nhân:** File `vercel.json` được tạo trên Windows bị dính ký tự ẩn Byte Order Mark (`\ufeff` - UTF-8 with BOM), khiến trình phân tích cú pháp JSON của Vercel báo lỗi.
* **Cách khắc phục:**
  1. Đọc và ghi lại file `vercel.json` ở chuẩn UTF-8 Clean (No BOM).
  2. Tinh gọn cấu trúc `rewrites` trong `vercel.json` để trỏ toàn bộ API sang backend Railway (`https://lau-nha-production.up.railway.app`).
  3. Thêm file `.vercelignore` để loại trừ các file mã nguồn backend Python không cần thiết trên Vercel.

---

### 🔴 Lỗi 8: Railway Deployment bị lỗi Port Binding và nhận diện Python Buildpack
* **Ngày phát hiện:** 01/09/2026
* **Hiện tượng:** Deploy backend lên Railway bị crash hoặc báo lỗi `Application failed to respond` / `PORT is not assigned`.
* **Nguyên nhân:**
  * Railway chỉ định cổng chạy ngẫu nhiên qua biến môi trường `$PORT`, trong khi server trước đó fix cứng port `8000`.
  * Bộ buildpack Nixpacks mặc định không xác định được file khởi chạy chính.
* **Cách khắc phục:**
  1. Cập nhật `server.py`: `port = int(os.environ.get("PORT", 8080))`.
  2. Chuyển sang sử dụng `Dockerfile` chuẩn chuyên dụng cho FastAPI trên Railway để cố định môi trường Python 3.11 và cài đặt thư viện ổn định.
  3. Bổ sung endpoint kiểm tra sức khỏe hệ thống `@app.get("/health")`.

---

### 🔴 Lỗi 9: Đồng bộ gửi Email xác nhận và Chuỗi 3 Email Sequence (Resend API)
* **Ngày phát hiện:** 01/09/2026 - 02/09/2026
* **Hiện tượng:** Khách điền khảo sát nhận mã giảm giá hoặc đặt đơn thành công nhưng email xác nhận bị chậm hoặc không tự động lên lịch cho các email tiếp theo.
* **Nguyên nhân:** Thiếu luồng background worker kiểm tra và kích hoạt các email theo mốc thời gian (+2 ngày, +3 ngày).
* **Cách khắc phục:**
  1. Xây dựng module `email_service.py` tích hợp Resend API với Domain xác thực `cskh@order.laumangdi.com`.
  2. Thiết kế bảng `email_sequences` trong database `brain.db` để lưu trạng thái (`pending`, `sent`, `failed`) và thời gian gửi dự kiến (`scheduled_at`).
  3. Tích hợp background cron worker `email_sequence_cron_worker()` chạy ngầm định kỳ quét và gửi email khi đến lịch hẹn.
  4. Thêm tính năng gửi email test (`+test`) trực tiếp trên giao diện Admin Panel.

---

## 📊 TỔNG KẾT TRẠNG THÁI HIỆN TẠI (02/09/2026)

| Hạng mục | Trạng thái | Ghi chú |
| :--- | :---: | :--- |
| **Gộp hóa đơn theo đơn hàng** | ✅ Hoàn tất | 1 Mã HĐ = 1 Dòng, quản lý danh sách món & tổng tiền chuẩn xác |
| **Quản trị Admin Panel** | ✅ Hoàn tất | Đầy đủ 5 Tab: Sản phẩm, Khách hàng, Đơn hàng, Khảo sát Lead, Email Automation |
| **Đồng bộ Website -> Database** | ✅ Hoàn tất | Đơn đặt từ Landing page tự động vào DB và cập nhật tồn kho |
| **Thanh toán QR VietQR/SePay** | ✅ Hoàn tất | Tự động đổi trạng thái đơn hàng sang `paid` khi nhận thanh toán |
| **Hệ thống Email Tự Động** | ✅ Hoàn tất | Gửi email xác nhận đơn & chuỗi 3 email nuôi dưỡng lead qua Resend |
| **Backend Server** | ✅ Hoàn tất | FastAPI chạy ổn định trên cổng 8080 local và sẵn sàng cho Railway |
