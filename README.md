# 🍲 LẨU NHÀ - HỆ THỐNG LANDING PAGE & QUẢN TRỊ ĐƠN HÀNG (laumangdi.com)

Hệ thống bán hàng và quản trị trực tuyến toàn diện cho thương hiệu **Lẩu Nhà** (Ăn lẩu tại nhà - Nước cốt hầm xương 12h, mượn bếp cồn miễn phí).

---

## 🌟 TÍNH NĂNG NỔI BẬT

1. **Landing Page Bán Hàng ([index.html](index.html)):**
   * Đặt lẩu tự chọn (Nước cốt 1L, Set Topping, Đồ nhúng thêm, Bếp cồn).
   * Tự động tính giá, áp dụng voucher giảm 50.000đ, miễn phí mượn bếp cho đơn từ 399k.
   * Thanh toán VietQR động kèm mã đơn hàng (`#LNxxxx`) và tự động kiểm tra trạng thái thanh toán qua SePay API.
   * Form khảo sát khách hàng (Survey/Waitlist) nhận mã ưu đãi 50k.
   * Trợ lý AI Bán Hàng thông minh (Gemini Hybrid Engine) tư vấn vị lẩu và chốt sale.

2. **Hệ Thống Quản Trị Toàn Diện ([admin/index.html](admin/index.html)):**
   * **Quản lý Sản phẩm:** Tạo, sửa, xóa món ăn, tự động kiểm soát và trừ tồn kho sản phẩm vật lý (`physical`).
   * **Quản lý Khách hàng & Phân loại:** Quản lý thông tin liên hệ, phân nhóm khách hàng (`customer`) và khách tiềm năng (`lead`).
   * **Quản lý Đơn hàng theo Hóa Đơn:** 1 Mã HĐ = 1 Dòng, hiển thị chi tiết danh sách món và tổng tiền, đổi trạng thái (`pending`, `paid`, `completed`, `cancelled`).
   * **Quản lý Khảo Sát Lead:** Xem câu trả lời khảo sát, mã ưu đãi, trạng thái đã dùng mã.
   * **Email Automation:** Quản lý chuỗi 3 email tự động nuôi dưỡng lead qua Resend API, gửi email test nhanh.

3. **Tự Động Hóa & Tích Hợp Đa Kênh:**
   * Gửi email xác nhận đơn hàng tức thì từ domain riêng (`cskh@order.laumangdi.com`).
   * Gửi thông báo đơn hàng & lead mới về nhóm Telegram tức thì.
   * Đồng bộ dữ liệu 2 chiều vào Google Sheets.
   * Webhook tự động đổi trạng thái đơn sang "Đã thanh toán" khi khách chuyển khoản thành công.

---

## 🏗️ KIẾN TRÚC CÔNG NGHỆ

* **Frontend:** HTML5, Tailwind CSS, Vanilla JS, FontAwesome, Canvas Confetti.
* **Backend:** Python 3.11, FastAPI, Uvicorn, SQLite3.
* **Database:** `My-Brain/brain.db` (SQLite relational schema).
* **Dịch vụ tích hợp:**
  * **Email:** Resend API (Domain DKIM/SPF: `order.laumangdi.com`).
  * **AI Chatbot:** Google Gemini API.
  * **Thanh toán:** Cổng SePay / VietQR.
  * **Thông báo:** Telegram Bot API.

---

## ⚙️ CẤU HÌNH BIẾN MÔI TRƯỜNG (.env)

Sao chép file `.env.example` thành file `.env` và điền các khóa bí mật của bạn:

```bash
cp .env.example .env
```

Nội dung cấu hình mẫu trong file `.env`:

```ini
# Cổng chạy Server Backend
PORT=8080

# Google Gemini API Key (Lấy tại aistudio.google.com)
GEMINI_API_KEY=your_gemini_api_key_here

# Resend Email Service (Lấy tại resend.com)
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_FROM=LẨU NHÀ <cskh@order.laumangdi.com>
RESEND_REPLY_TO=tangductri15@gmail.com
ADMIN_EMAIL=tangductri15@gmail.com

# Telegram Bot Notification (Tạo qua @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_or_group_id_here

# SePay / VietQR Auto Payment (Lấy tại my.sepay.vn)
SEPAY_API_TOKEN=your_sepay_api_token_here
SEPAY_ACCOUNT_NUMBER=your_bank_account_number_here

# Google Sheets Sync URL
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/your_script_id/exec

# Railway Production Backend URL
RAILWAY_URL=https://lau-nha-production.up.railway.app
```

> ⚠️ **Lưu ý bảo mật:** Tuyệt đối không commit file `.env` hoặc các file chứa API Key lên GitHub công khai. File `.gitignore` đã được cấu hình chặn file `.env`.

---

## 💻 HƯỚNG DẪN CHẠY DƯỚI LOCAL (LOCAL DEVELOPMENT)

### 1. Yêu cầu môi trường:
* Python 3.10+ (Khuyến nghị Python 3.11)
* Trình duyệt web hiện đại (Chrome, Edge, Firefox, Safari)

### 2. Cài đặt thư viện:
```bash
pip install fastapi uvicorn requests pydantic
```

### 3. Khởi chạy Server:
```bash
python server.py
```
Server sẽ chạy tại:
* **Trang Landing Page Khách Hàng:** [http://localhost:8080/](http://localhost:8080/)
* **Trang Quản Trị Admin Panel:** [http://localhost:8080/admin](http://localhost:8080/admin)
* **Tài liệu API Swagger:** [http://localhost:8080/docs](http://localhost:8080/docs)

---

## 🚀 HƯỚNG DẪN DEPLOY LÊN SERVER THẬT (PRODUCTION)

Hệ thống được thiết kế tối ưu để triển khai tách biệt (Decoupled Architecture) hoặc triển khai trọn gói (All-in-One):

### Cách 1: Triển khai All-in-One trên Railway / Render / VPS (Khuyến nghị)
Hệ thống đã có sẵn [Dockerfile](Dockerfile) chuẩn:

1. **Đưa mã nguồn lên GitHub (Private Repository).**
2. **Tạo Project mới trên Railway (hoặc Render):**
   * Chọn `Deploy from GitHub repo`.
   * Railway sẽ tự động nhận diện `Dockerfile` và build container Python 3.11.
3. **Cấu hình Environment Variables trên Railway:**
   * Thêm toàn bộ các biến từ file `.env` vào tab `Variables` trên dashboard của Railway.
4. **Tạo Volume lưu Database (Persistent Storage):**
   * Gắn Volume vào thư mục `/app/My-Brain` để dữ liệu SQLite không bị mất khi redeploy server.
5. **Gán Domain riêng:**
   * Trong mục `Networking` -> `Custom Domain`, trỏ domain `api.laumangdi.com` hoặc `admin.laumangdi.com` về CNAME của Railway.

---

### Cách 2: Triển khai Frontend trên Vercel + Backend trên Railway
1. **Frontend trên Vercel:**
   * Import repository vào Vercel.
   * File [vercel.json](vercel.json) đã được cấu hình sẵn các rewrite rules để trỏ các request `/api/*` và `/admin` sang backend Railway.
   * Gán Custom Domain `laumangdi.com` trên Vercel.
2. **Backend trên Railway:**
   * Chạy FastAPI và phục vụ cơ sở dữ liệu SQLite theo hướng dẫn ở Cách 1.

---

## 💾 HƯỚNG DẪN SAO LƯU & KHÔI PHỤC DATABASE

Cơ sở dữ liệu SQLite được lưu trữ tại đường dẫn: `My-Brain/brain.db`.

### 1. Tạo bản sao lưu (Backup):
Chạy lệnh sao lưu an toàn bằng Python:
```bash
python -c "import sqlite3, shutil, datetime; ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S'); shutil.copy('My-Brain/brain.db', f'My-Brain/brain_backup_{ts}.db'); print(f'Đã tạo backup: brain_backup_{ts}.db')"
```

### 2. Khôi phục từ bản sao lưu (Restore):
1. Dừng tiến trình server: `Stop-Process` hoặc `systemctl stop launha`.
2. Sao chép file backup đè lên `My-Brain/brain.db`.
3. Khởi động lại server.

---

## 📡 TÀI LIỆU CÁC API ENDPOINTS CHÍNH

| Method | Endpoint | Mô tả chức năng |
| :--- | :--- | :--- |
| `GET` | `/health` | Kiểm tra trạng thái hoạt động của hệ thống |
| `POST` | `/api/send-order` | Đặt hàng từ Landing Page, tạo khách, trừ tồn kho, gửi email xác nhận |
| `POST` | `/api/survey` | Gửi khảo sát nhu cầu, lưu lead, cấp mã ưu đãi 50k & kích hoạt email |
| `GET` | `/api/orders` | Danh sách đơn hàng gom nhóm theo Mã Hóa Đơn (1 Mã HĐ = 1 dòng) |
| `POST` | `/api/orders` | Tạo đơn hàng mới từ trang Admin (hỗ trợ nhiều món) |
| `PUT` | `/api/orders/{id}` | Cập nhật trạng thái đơn hàng (áp dụng đồng loạt cho cả hóa đơn) |
| `DELETE` | `/api/orders/{id}` | Xóa toàn bộ hóa đơn và các món trong đơn |
| `POST` | `/api/orders/mark-paid`| Tự động cập nhật đơn sang `paid` khi nhận thanh toán VietQR/SePay |
| `GET` | `/api/products` | Danh sách sản phẩm và số lượng tồn kho |
| `GET` | `/api/customers` | Danh sách khách hàng và thông tin liên hệ |
| `GET` | `/api/leads` | Danh sách lead khảo sát và trạng thái dùng mã giảm giá |
| `POST` | `/api/chat` | Trợ lý AI Bán Hàng tư vấn lẩu qua Google Gemini |

---

## 📞 HỖ TRỢ VẬN HÀNH
* **Thương hiệu:** Lẩu Nhà - Ăn lẩu tại nhà
* **Hotline / Zalo:** 0819 943 904
* **Website:** [laumangdi.com](https://laumangdi.com)
* **Email CSKH:** cskh@order.laumangdi.com
