# 🤖 Lau Nha MCP Server (Streamable HTTP)

MCP (Model Context Protocol) Server trang bị các công cụ (tools) tự động hóa cho AI Agent GoClaw để tương tác trực tiếp với hệ sinh thái **Lẩu Nhà** (SQLite `brain.db`, SePay VietQR, Telegram Bot, Resend Email).

---

## 1. Thông Tin Kỹ Thuật
- **Ngôn ngữ:** Python 3.11+ / FastAPI / Uvicorn
- **Giao thức:** Streamable HTTP / JSON-RPC 2.0 (`POST /mcp` hoặc `/tools/*`)
- **Port:** `3001` (Bind chặt vào `127.0.0.1` — **Localhost Only**, không public ra ngoài internet)
- **Cơ sở dữ liệu:** Dùng chung trực tiếp file SQLite `My-Brain/brain.db` với website chính

---

## 2. Danh Sách 3 MCP Functions

| Function Name | Phương Thức | Input Params | Mục Đích |
| :--- | :--- | :--- | :--- |
| `get_daily_summary` | GET / POST | `date` (mặc định "today") | Báo cáo doanh thu, số đơn, lead khảo sát mới trong ngày |
| `check_order_and_payment` | GET / POST | `order_code` hoặc `phone` | Tra cứu đơn & tự động check biến động số dư SePay để chuyển `paid` |
| `create_manual_order` | POST | `customer_name`, `phone`, `address`, `product_name`, `amount`, `is_stove`, `email`, `note` | Lên đơn hàng nhanh, tạo QR VietQR, gửi thông báo Telegram & Email |

---

## 3. Hướng Dẫn Triển Khai Trên VPS (Systemd Service)

### Bước 1: Tạo file cấu hình Systemd Service
Tạo file `/etc/systemd/system/launha-mcp.service`:

```ini
[Unit]
Description=Lau Nha MCP Streamable HTTP Server
After=network.target mywebsite.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/my-website
ExecStart=/usr/bin/python3 /opt/my-website/mcp/server.py
Restart=always
RestartSec=3
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

### Bước 2: Kích hoạt và Chạy Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable launha-mcp.service
sudo systemctl start launha-mcp.service
sudo systemctl status launha-mcp.service
```

---

## 4. Kiểm Thử Nhanh (Curl Examples)

### Kiểm tra sức khỏe Server:
```bash
curl http://127.0.0.1:3001/health
```

### 1. Test `get_daily_summary`:
```bash
curl -X POST http://127.0.0.1:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_daily_summary","arguments":{"date":"today"}}}'
```

### 2. Test `check_order_and_payment`:
```bash
curl -X POST http://127.0.0.1:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"check_order_and_payment","arguments":{"order_code":"LN1024"}}}'
```

### 3. Test `create_manual_order`:
```bash
curl -X POST http://127.0.0.1:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"create_manual_order","arguments":{"customer_name":"Nguyễn Văn Test","phone":"0988000111","address":"123 Test Street","product_name":"Set Lẩu Cặp Đôi (2-3 người)","amount":299000,"is_stove":true}}}'
```
